import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  useQuerySolicitacoesLiveWhen,
  useMutationCreateSolicitacao,
} from "../helpers/useSolicitacoes";
import { useAuth } from "../helpers/useAuth";
import { useQuerySetores } from "../helpers/useSetores";
import { useQueryCategorias } from "../helpers/useCategorias";
import { hasAccessGroup } from "../helpers/accessGroups";
import {
  formatEmpresa,
  formatCurrency,
  formatStatus,
  getStatusBadgeVariant,
  formatPrioridade,
  getPrioridadeBadgeVariant,
  formatDate,
} from "../helpers/formatters";
import { calculateEstimatedTotal } from "../helpers/monetary";
import {
  SolicitacaoStatusArrayValues,
} from "../helpers/schema";
import { EMPRESA_OPTIONS } from "../helpers/solicitacoesDomain";

import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/Dialog";
import { Input } from "../components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "../components/Form";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";

import {
  schema as createSchema,
  InputType as CreateSolicitacaoInput,
} from "../endpoints/solicitacoes/create_POST.schema";

import styles from "./solicitacoes.module.css";

type OptionItem = {
  id: number;
  nome: string;
};

type FormValues = {
  titulo: string;
  descricao: string;
  valorEstimado: number;
  quantidade: number;
  prioridade: CreateSolicitacaoInput["prioridade"];
  empresa: CreateSolicitacaoInput["empresa"] | "";
  setorId: number;
  categoriaId: number;
  linkProduto: string;
};

const EMPTY_FORM_VALUES: FormValues = {
  titulo: "",
  descricao: "",
  valorEstimado: 0,
  quantidade: 1,
  prioridade: "media",
  empresa: "",
  setorId: 0,
  categoriaId: 0,
  linkProduto: "",
};

const PRIORIDADE_OPTIONS: CreateSolicitacaoInput["prioridade"][] = [
  "emergencial",
  "urgente",
  "alta",
  "media",
  "baixa",
];

const ITEMS_PER_PAGE = 10;

function extractOptions(data: unknown): OptionItem[] {
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.json)
      ? (data as any).json
      : [];

  return rawItems
    .map((item: any) => ({
      id: Number(item?.id ?? 0),
      nome: String(item?.nome ?? "").trim(),
    }))
    .filter((item: OptionItem) => item.id > 0 && item.nome.length > 0);
}

function mapFormToPayload(values: FormValues): CreateSolicitacaoInput {
  return {
    titulo: values.titulo,
    descricao: values.descricao,
    valorEstimado: values.valorEstimado,
    quantidade: values.quantidade,
    prioridade: values.prioridade,
    empresa: values.empresa as CreateSolicitacaoInput["empresa"],
    setorId: values.setorId,
    categoriaId: values.categoriaId,
    linkProduto: values.linkProduto,
  };
}

export default function Solicitacoes() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  const isTecnologiaView = user ? hasAccessGroup(user.role, "tecnologia") : false;
  const isFinanceiroView = user ? hasAccessGroup(user.role, "financeiro") : false;
  const canViewSolicitacoesList = isTecnologiaView || isFinanceiroView;
  const canCreateSolicitacao = user?.role !== "financeiro";

  const [statusFilter, setStatusFilter] = useState<string>("_empty");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: statusFilter === "_empty" ? undefined : (statusFilter as any),
    }),
    [statusFilter]
  );

  const { data: solicitacoes, isLoading } = useQuerySolicitacoesLiveWhen(
    filters,
    canViewSolicitacoesList
  );

  const { data: setores } = useQuerySetores();
  const { data: categorias } = useQueryCategorias();
  const { mutate: createSolicitacao, isPending } =
    useMutationCreateSolicitacao();

  const setoresOptions = useMemo(() => extractOptions(setores), [setores]);
  const categoriasOptions = useMemo(() => extractOptions(categorias), [categorias]);

  const form = useForm({
    defaultValues: EMPTY_FORM_VALUES,
    schema: createSchema,
  });

  const filteredData = useMemo(() => {
    if (!solicitacoes) return [];

    const query = searchQuery.trim().toLowerCase();
    const base =
      !query
        ? solicitacoes
        : solicitacoes.filter((item) => {
            const haystack = [
              item.titulo,
              item.setorNome,
              item.categoriaNome,
              formatStatus(item.status),
              formatPrioridade(item.prioridade),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(query);
          });

    return base;
  }, [solicitacoes, searchQuery]);

  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  const paginatedData = useMemo(() => {
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, startIndex, endIndex]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    form.setValues(EMPTY_FORM_VALUES);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);

    if (!open) {
      resetForm();
    }
  };

  const onSubmit = (values: FormValues) => {
    const payload = mapFormToPayload(values);

    createSolicitacao(payload, {
      onSuccess: () => {
        setDialogOpen(false);
        resetForm();
        toast.success("Solicitação registrada com sucesso.");
      },
      onError: (err: any) => {
        toast.error(err?.message || "Ocorreu um erro ao registrar a solicitação.");
      },
    });
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Solicitações - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>Solicitações</h1>

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          {canCreateSolicitacao ? (
            <DialogTrigger asChild>
              <Button>
                <Plus size={16} /> Nova solicitação
              </Button>
            </DialogTrigger>
          ) : null}

          <DialogContent className={styles.dialogContent}>
            <DialogHeader>
              <DialogTitle>Registrar nova solicitacao</DialogTitle>
              <p className={styles.dialogSubtitle}>
                Preencha os dados essenciais para iniciar o fluxo de compras.
              </p>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={styles.formLayout}
              >
                <div className={styles.formScrollArea}>
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Identificacao</h3>
                    </div>
                    <div className={styles.formGridTwo}>
                      <FormItem name="titulo" className={styles.spanTwo}>
                        <FormLabel>Item solicitado</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Notebook Dell Inspiron"
                            value={form.values.titulo}
                            onChange={(e) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                titulo: e.target.value,
                              }))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="setorId">
                        <FormLabel>Setor solicitante</FormLabel>
                        <FormControl>
                          <Select
                            value={
                              form.values.setorId > 0
                                ? String(form.values.setorId)
                                : "_empty"
                            }
                            onValueChange={(val) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                setorId: val === "_empty" ? 0 : Number(val),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um setor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_empty">Selecione...</SelectItem>
                              {setoresOptions.map((setor) => (
                                <SelectItem key={setor.id} value={String(setor.id)}>
                                  {setor.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="categoriaId">
                        <FormLabel>Categoria</FormLabel>
                        <FormControl>
                          <Select
                            value={
                              form.values.categoriaId > 0
                                ? String(form.values.categoriaId)
                                : "_empty"
                            }
                            onValueChange={(val) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                categoriaId: val === "_empty" ? 0 : Number(val),
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_empty">Selecione...</SelectItem>
                              {categoriasOptions.map((categoria) => (
                                <SelectItem key={categoria.id} value={String(categoria.id)}>
                                  {categoria.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="empresa" className={styles.spanTwo}>
                        <FormLabel>Empresa</FormLabel>
                        <FormControl>
                          <div className={styles.empresaChooser} role="radiogroup" aria-label="Empresa">
                            {EMPRESA_OPTIONS.map((empresa) => {
                              const isActive = form.values.empresa === empresa.value;
                              return (
                                <button
                                  key={empresa.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={isActive}
                                  className={`${styles.empresaOption} ${isActive ? styles.empresaOptionActive : ""}`}
                                  onClick={() =>
                                    form.setValues((prev: FormValues) => ({
                                      ...prev,
                                      empresa: empresa.value,
                                    }))
                                  }
                                >
                                  <span className={styles.empresaOptionLabel}>{empresa.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                  </section>
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Classificacao</h3>
                    </div>
                    <div className={styles.formGridThree}>
                      <FormItem name="prioridade">
                        <FormLabel>Prioridade</FormLabel>
                        <FormControl>
                          <Select
                            value={form.values.prioridade}
                            onValueChange={(val) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                prioridade: val as FormValues["prioridade"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORIDADE_OPTIONS.map((prioridade) => (
                                <SelectItem key={prioridade} value={prioridade}>
                                  {formatPrioridade(prioridade)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="quantidade">
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            value={
                              form.values.quantidade === 0
                                ? ""
                                : form.values.quantidade
                            }
                            onChange={(e) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                quantidade:
                                  Number.parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                      <FormItem name="valorEstimado">
                        <FormLabel>Valor estimado unitario (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={
                              form.values.valorEstimado === 0
                                ? ""
                                : form.values.valorEstimado
                            }
                            onChange={(e) =>
                              form.setValues((prev: FormValues) => ({
                                ...prev,
                                valorEstimado:
                                  Number.parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <strong>Total estimado:</strong>{" "}
                      {formatCurrency(
                        calculateEstimatedTotal({
                          valorEstimadoUnitario: form.values.valorEstimado,
                          quantidade: form.values.quantidade,
                        })
                      )}
                    </div>
                  </section>
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Referencia</h3>
                    </div>
                    <FormItem name="linkProduto">
                      <FormLabel>Link de referencia</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://..."
                          value={form.values.linkProduto}
                          onChange={(e) =>
                            form.setValues((prev: FormValues) => ({
                              ...prev,
                              linkProduto: e.target.value,
                            }))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </section>
                  <section className={styles.formSection}>
                    <div className={styles.sectionHeader}>
                      <h3>Detalhamento</h3>
                    </div>
                    <FormItem name="descricao">
                      <FormLabel>Descricao completa da necessidade</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Contexto, especificacoes e observacoes uteis para a compra..."
                          value={form.values.descricao}
                          onChange={(e) =>
                            form.setValues((prev: FormValues) => ({
                              ...prev,
                              descricao: e.target.value,
                            }))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </section>
                </div>
                <div className={styles.formFooter}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDialogChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Salvando..." : "Registrar solicitacao"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!canViewSolicitacoesList ? (
        <div className={styles.emptyCell} style={{ marginTop: 12 }}>
          Use o botao <strong>Nova solicitacao</strong> para registrar uma nova demanda.
          Seu historico fica em <strong>Minhas solicitacoes</strong>.
        </div>
      ) : (
        <>
      <div className={styles.filterBar}>
        <Input
          placeholder="Buscar por item, setor, categoria, prioridade ou status..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className={styles.searchInput}
        />

        <div className={styles.statusFilter}>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_empty">Todos os status</SelectItem>
              {SolicitacaoStatusArrayValues.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Item</th>
              <th>Setor</th>
              <th>Categoria</th>
              <th>Qtd</th>
              <th>Valor Unit.</th>
              <th>Valor Total</th>
              <th className={styles.priorityHeader}>Prioridade</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                  <td><Skeleton className={styles.skeletonCell} /></td>
                </tr>
              ))
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.emptyCell}>
                  Nenhuma solicitação encontrada para os filtros aplicados.
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className={styles.clickableRow}
                  onClick={() => navigate(`/solicitacoes/${item.id}`)}
                >
                  <td>{formatDate(item.createdAt)}</td>
                  <td className={styles.boldCell}>
                    <div>{item.titulo}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
                      {formatEmpresa(item.empresa)}
                    </div>
                  </td>
                  <td>{item.setorNome || "-"}</td>
                  <td>{item.categoriaNome || "-"}</td>
                  <td>{item.quantidade}</td>
                  <td>{formatCurrency(item.valorEstimado)}</td>
                  <td>
                    {formatCurrency(
                      calculateEstimatedTotal({
                        valorEstimadoUnitario: item.valorEstimado,
                        quantidade: item.quantidade,
                      })
                    )}
                  </td>
                  <td className={styles.priorityCell}>
                    <span
                      className={`${styles.priorityInline} ${styles[`priority_${item.prioridade}`] || ""}`}
                      title={formatPrioridade(item.prioridade)}
                      aria-label={`Prioridade: ${formatPrioridade(item.prioridade)}`}
                    >
                      <span className={styles.priorityDot} aria-hidden="true" />
                      <span className={styles.priorityText}>{formatPrioridade(item.prioridade)}</span>
                    </span>
                  </td>
                  <td>
                    <Badge variant={getStatusBadgeVariant(item.status)} size="compact">
                      {formatStatus(item.status)}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!isLoading && filteredData.length > 0 ? (
        <div className={styles.paginationBar}>
          <span className={styles.paginationInfo}>
            Mostrando {startIndex + 1}-{endIndex} de {totalItems}
          </span>

          <div className={styles.paginationControls}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>

            <span className={styles.paginationPageLabel}>
              Página {currentPage} de {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}

