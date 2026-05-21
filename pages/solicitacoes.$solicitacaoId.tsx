import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  RotateCcw,
  SquarePen,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../helpers/useAuth";
import { useQuerySolicitacaoDetailLive, SOLICITACAO_DETAIL_KEYS } from "../helpers/useSolicitacaoDetail";
import {
  SOLICITACOES_KEYS,
  useMutationAdminAdjustSolicitacao,
  useMutationUpdateStatus,
} from "../helpers/useSolicitacoes";
import { useQuerySetores } from "../helpers/useSetores";
import { useQueryCategorias } from "../helpers/useCategorias";
import {
  formatCanalCompra,
  formatCurrency,
  formatEmpresa,
  formatStatus,
  getStatusBadgeVariant,
  formatPrioridade,
  getPrioridadeBadgeVariant,
  formatDate,
  formatMetodoPagamento,
} from "../helpers/formatters";
import {
  calculateEstimatedTotal,
  calculateRealTotal,
  resolveRealUnitario,
} from "../helpers/monetary";
import { postUpdateSolicitacao } from "../endpoints/solicitacoes/update_POST.schema";
import { postDeleteSolicitacao } from "../endpoints/solicitacoes/delete_POST.schema";
import {
  ADMINISTRATIVE_ADJUSTABLE_STATUSES,
  CANAL_COMPRA_OPTIONS,
  EMPRESA_OPTIONS,
  formatAdministrativeAuditFieldLabel,
  METODO_PAGAMENTO_OPTIONS,
} from "../helpers/solicitacoesDomain";

import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Textarea } from "../components/Textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";

import styles from "./solicitacoes.$solicitacaoId.module.css";

type OptionItem = {
  id: number;
  nome: string;
};

type ReturnedEditForm = {
  titulo: string;
  descricao: string;
  valorEstimado: number;
  quantidade: number;
  prioridade: string;
  empresa: string;
  setorId: number;
  categoriaId: number;
  linkProduto: string;
};

type AdminOperationalForm = {
  titulo: string;
  descricao: string;
  empresa: string;
  setorId: number;
  categoriaId: number;
  quantidade: number;
  valorEstimado: number;
  valorRealCompraUnitario: string;
  metodoPagamento: string;
  parcelas: string;
  fornecedor: string;
  canalCompra: string;
  dataCompra: string;
  observacaoCompra: string;
  referenciaPedido: string;
  linkProduto: string;
  justificativa: string;
};

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

function buildAdminOperationalForm(data: any): AdminOperationalForm {
  const valorRealUnitario = resolveRealUnitario({
    valorRealCompraUnitario: data.valorRealCompraUnitario,
    valorRealCompraLegado: data.valorRealCompra,
    quantidade: data.quantidade,
  });

  return {
    titulo: data.titulo || "",
    descricao: data.descricao || "",
    empresa: data.empresa || "",
    setorId: data.setorId || 0,
    categoriaId: data.categoriaId || 0,
    quantidade: data.quantidade || 1,
    valorEstimado: Number.parseFloat(String(data.valorEstimado || 0)) || 0,
    valorRealCompraUnitario:
      valorRealUnitario !== null ? String(valorRealUnitario) : "",
    metodoPagamento: data.metodoPagamento || "",
    parcelas: data.parcelas ? String(data.parcelas) : "1",
    fornecedor: data.fornecedor || "",
    canalCompra: data.canalCompra || "",
    dataCompra: data.dataCompra ? new Date(data.dataCompra).toISOString().slice(0, 10) : "",
    observacaoCompra: data.observacaoCompra || "",
    referenciaPedido: data.referenciaPedido || "",
    linkProduto: data.linkProduto || "",
    justificativa: "",
  };
}

export default function SolicitacaoDetail() {
  const { solicitacaoId } = useParams();
  const id = Number(solicitacaoId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  const [isEditingReturned, setIsEditingReturned] = useState(false);
  const [formValues, setFormValues] = useState<ReturnedEditForm>({
    titulo: "",
    descricao: "",
    valorEstimado: 0,
    quantidade: 1,
    prioridade: "media",
    empresa: "",
    setorId: 0,
    categoriaId: 0,
    linkProduto: "",
  });
  const [isEditingAdminOperational, setIsEditingAdminOperational] = useState(false);
  const [adminFormValues, setAdminFormValues] = useState<AdminOperationalForm>({
    titulo: "",
    descricao: "",
    empresa: "",
    setorId: 0,
    categoriaId: 0,
    quantidade: 1,
    valorEstimado: 0,
    valorRealCompraUnitario: "",
    metodoPagamento: "",
    parcelas: "1",
    fornecedor: "",
    canalCompra: "",
    dataCompra: "",
    observacaoCompra: "",
    referenciaPedido: "",
    linkProduto: "",
    justificativa: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteJustificativa, setDeleteJustificativa] = useState("");

  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useMutationUpdateStatus();
  const {
    mutate: adminAdjustSolicitacao,
    isPending: isAdminAdjusting,
  } = useMutationAdminAdjustSolicitacao();

  const isAdminDetailRefreshPaused =
    isEditingAdminOperational || isAdminAdjusting;

  const { data, isLoading, error } = useQuerySolicitacaoDetailLive(id, {
    enabled: !isAdminDetailRefreshPaused,
    refetchOnWindowFocus: !isAdminDetailRefreshPaused,
  });
  const { data: setores } = useQuerySetores();
  const { data: categorias } = useQueryCategorias();

  const setoresOptions = useMemo(() => extractOptions(setores), [setores]);
  const categoriasOptions = useMemo(() => extractOptions(categorias), [categorias]);

  useEffect(() => {
    if (!data) return;

    setFormValues({
      titulo: data.titulo || "",
      descricao: data.descricao || "",
      valorEstimado: Number.parseFloat(String(data.valorEstimado || 0)) || 0,
      quantidade: data.quantidade || 1,
      prioridade: data.prioridade || "media",
      empresa: data.empresa || "",
      setorId: data.setorId || 0,
      categoriaId: data.categoriaId || 0,
      linkProduto: data.linkProduto || "",
    });
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (isEditingAdminOperational || isAdminAdjusting) return;

    setAdminFormValues(buildAdminOperationalForm(data));
  }, [data, isAdminAdjusting, isEditingAdminOperational]);

  const updateSolicitacaoMutation = useMutation({
    mutationFn: (payload: Parameters<typeof postUpdateSolicitacao>[0]) =>
      postUpdateSolicitacao(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.all,
      });
      await queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.detail(id),
      });
    },
  });
  const deleteSolicitacaoMutation = useMutation({
    mutationFn: (payload: Parameters<typeof postDeleteSolicitacao>[0]) =>
      postDeleteSolicitacao(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.all,
      });
      await queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.detail(id),
      });
    },
  });

  const canManagePurchase = user?.role === "admin" || user?.role === "ti";
  const canAdminOperationalAdjust =
    !!data &&
    user?.role === "admin" &&
    ADMINISTRATIVE_ADJUSTABLE_STATUSES.includes(data.status as any);
  const canDeleteSolicitacaoAdministrativa = !!data && user?.role === "admin";

  const canStartPurchase =
    !!data &&
    canManagePurchase &&
    data.status === "aprovado_para_compra";

  const canMarkAsComprado =
    !!data &&
    canManagePurchase &&
    data.status === "em_compra";

  const canAdjustReturned =
    !!data &&
    data.status === "devolvido" &&
    !!user &&
    (
      user.role === "admin" ||
      user.id === data.solicitanteId ||
      (user.role === "lider_setor" && user.setorId === data.setorId)
    );

  const canCancelReturned = canAdjustReturned;

  const latestReturnComment = useMemo(() => {
    if (!data?.historico?.length) return null;

    const devolucao = data.historico.find(
      (item) => item.statusNovo === "devolvido" && item.comentario?.trim()
    );

    return devolucao?.comentario || null;
  }, [data]);

  const isProcessingReturnedAction =
    isUpdatingStatus || updateSolicitacaoMutation.isPending;
  const isCardPaymentInAdminForm =
    adminFormValues.metodoPagamento === "cartao_acseg" ||
    adminFormValues.metodoPagamento === "cartao_acontrans" ||
    adminFormValues.metodoPagamento === "cartao_sp";
  const adminEstimatedTotalPreview = calculateEstimatedTotal({
    valorEstimadoUnitario: adminFormValues.valorEstimado,
    quantidade: adminFormValues.quantidade,
  });
  const adminRealTotalPreview =
    adminFormValues.valorRealCompraUnitario.trim() === ""
      ? 0
      : calculateRealTotal({
          valorRealCompraUnitario: adminFormValues.valorRealCompraUnitario,
          quantidade: adminFormValues.quantidade,
        });
  const detailValorRealUnitario = data
    ? resolveRealUnitario({
        valorRealCompraUnitario: data.valorRealCompraUnitario,
        valorRealCompraLegado: data.valorRealCompra,
        quantidade: data.quantidade,
      })
    : null;
  const adminAdjustmentSummary = useMemo(() => {
    if (!data) return [];

    const findNome = (items: OptionItem[], id: number) =>
      items.find((item) => item.id === id)?.nome ?? String(id || "-");
    const normalizeText = (value: string | null | undefined) => {
      const trimmed = String(value ?? "").trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    const normalizeDate = (value: string | Date | null | undefined) => {
      if (!value) return null;
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      return new Date(value).toISOString().slice(0, 10);
    };
    const normalizeNumericText = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed.replace(",", "."));
      return Number.isFinite(parsed) ? parsed.toFixed(2) : trimmed;
    };

    const changes = [
      {
        key: "titulo",
        label: "Título",
        previous: normalizeText(data.titulo) ?? "-",
        next: normalizeText(adminFormValues.titulo) ?? "-",
      },
      {
        key: "descricao",
        label: "Descrição",
        previous: normalizeText(data.descricao) ?? "-",
        next: normalizeText(adminFormValues.descricao) ?? "-",
      },
      {
        key: "empresa",
        label: "Empresa",
        previous: formatEmpresa(data.empresa),
        next: formatEmpresa(adminFormValues.empresa),
      },
      {
        key: "setor",
        label: "Setor",
        previous: data.setorNome,
        next: findNome(setoresOptions, adminFormValues.setorId),
      },
      {
        key: "categoria",
        label: "Categoria",
        previous: data.categoriaNome,
        next: findNome(categoriasOptions, adminFormValues.categoriaId),
      },
      {
        key: "quantidade",
        label: "Quantidade",
        previous: String(data.quantidade),
        next: String(adminFormValues.quantidade),
      },
      {
        key: "valor_estimado_unitario",
        label: "Valor estimado unitário",
        previous: Number(data.valorEstimado).toFixed(2),
        next: Number(adminFormValues.valorEstimado).toFixed(2),
      },
      {
        key: "link_produto",
        label: "Link do produto",
        previous: normalizeText(data.linkProduto) ?? "-",
        next: normalizeText(adminFormValues.linkProduto) ?? "-",
      },
      {
        key: "metodo_pagamento",
        label: "Método de pagamento",
        previous: formatMetodoPagamento(data.metodoPagamento || data.formaPagamento),
        next: formatMetodoPagamento(adminFormValues.metodoPagamento),
      },
      {
        key: "parcelas",
        label: "Parcelas",
        previous: data.parcelas ? `${data.parcelas}x` : "-",
        next:
          adminFormValues.metodoPagamento &&
          (adminFormValues.metodoPagamento === "cartao_acseg" ||
            adminFormValues.metodoPagamento === "cartao_acontrans" ||
            adminFormValues.metodoPagamento === "cartao_sp")
            ? `${adminFormValues.parcelas || "1"}x`
            : "-",
      },
      {
        key: "valor_real_compra_unitario",
        label: "Valor real unitário",
        previous:
          detailValorRealUnitario !== null
            ? Number(detailValorRealUnitario).toFixed(2)
            : "-",
        next: normalizeNumericText(adminFormValues.valorRealCompraUnitario) ?? "-",
      },
      {
        key: "data_compra",
        label: "Data da compra",
        previous: normalizeDate(data.dataCompra) ?? "-",
        next: normalizeDate(adminFormValues.dataCompra) ?? "-",
      },
      {
        key: "canal_compra",
        label: "Canal / Plataforma",
        previous: formatCanalCompra(data.canalCompra),
        next: formatCanalCompra(adminFormValues.canalCompra),
      },
      {
        key: "fornecedor",
        label: "Fornecedor",
        previous: normalizeText(data.fornecedor) ?? "-",
        next: normalizeText(adminFormValues.fornecedor) ?? "-",
      },
      {
        key: "observacao_compra",
        label: "Observação da compra",
        previous: normalizeText(data.observacaoCompra) ?? "-",
        next: normalizeText(adminFormValues.observacaoCompra) ?? "-",
      },
      {
        key: "referencia_pedido",
        label: "Referência do pedido",
        previous: normalizeText(data.referenciaPedido) ?? "-",
        next: normalizeText(adminFormValues.referenciaPedido) ?? "-",
      },
    ];

    return changes.filter((item) => item.previous !== item.next);
  }, [adminFormValues, categoriasOptions, data, detailValorRealUnitario, setoresOptions]);
  const formatAuditValue = (campo: string, valor: string | null) => {
    if (!valor) return "-";

    if (campo === "empresa") return formatEmpresa(valor);
    if (campo === "metodo_pagamento") return formatMetodoPagamento(valor);
    if (campo === "canal_compra") return formatCanalCompra(valor);
    if (campo === "setor") {
      const setor = setoresOptions.find((item) => item.id === Number(valor));
      return setor?.nome ?? valor;
    }
    if (campo === "categoria") {
      const categoria = categoriasOptions.find((item) => item.id === Number(valor));
      return categoria?.nome ?? valor;
    }
    if (campo === "parcelas") return `${valor}x`;
    if (
      campo === "valor_estimado_unitario" ||
      campo === "valor_real_compra_unitario"
    ) {
      return formatCurrency(valor);
    }
    if (campo === "data_compra") return formatDate(valor);

    return valor;
  };

  const handleOpenLink = () => {
    if (!data?.linkProduto) {
      toast.error("Esta solicitação não possui link do produto.");
      return;
    }

    window.open(data.linkProduto, "_blank", "noopener,noreferrer");
  };

  const handleStartPurchase = () => {
    if (!data) return;

    const confirmed = window.confirm(
      `Confirmar que a solicitação "${data.titulo}" entrou em processo de compra?`
    );

    if (!confirmed) return;

    const comentario =
      user?.role === "ti"
        ? "Compra iniciada pelo TI."
        : "Compra iniciada pelo administrador.";

    updateStatus(
      {
        solicitacaoId: data.id,
        statusNovo: "em_compra",
        comentario,
      },
      {
        onSuccess: () => {
          toast.success("Solicitação movida para Em Compra.");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Não foi possível iniciar a compra.");
        },
      }
    );
  };

  const handleMarkAsComprado = () => {
    if (!data) return;

    toast.message(
      "Use o fluxo de Compras TI para registrar valor unitário real, canal e data da compra."
    );
    navigate("/compras-ti");
  };


  const handleSaveReturnedAdjustments = () => {
    if (!data) return;

    updateSolicitacaoMutation.mutate(
      {
        solicitacaoId: data.id,
        titulo: formValues.titulo,
        descricao: formValues.descricao,
        valorEstimado: formValues.valorEstimado,
        quantidade: formValues.quantidade,
        prioridade: formValues.prioridade as any,
        empresa: formValues.empresa as any,
        setorId: formValues.setorId,
        categoriaId: formValues.categoriaId,
        linkProduto: formValues.linkProduto,
        acao: "salvar",
      },
      {
        onSuccess: () => {
          setIsEditingReturned(false);
          toast.success("Ajustes salvos com sucesso.");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Não foi possível salvar os ajustes.");
        },
      }
    );
  };

  const handleResendReturnedSolicitacao = () => {
    if (!data) return;

    const confirmed = window.confirm(
      `Confirmar o reenvio da solicitação "${data.titulo}" para aprovação?`
    );

    if (!confirmed) return;

    updateSolicitacaoMutation.mutate(
      {
        solicitacaoId: data.id,
        titulo: formValues.titulo,
        descricao: formValues.descricao,
        valorEstimado: formValues.valorEstimado,
        quantidade: formValues.quantidade,
        prioridade: formValues.prioridade as any,
        empresa: formValues.empresa as any,
        setorId: formValues.setorId,
        categoriaId: formValues.categoriaId,
        linkProduto: formValues.linkProduto,
        acao: "reenviar",
      },
      {
        onSuccess: () => {
          setIsEditingReturned(false);
          toast.success("Solicitação reenviada para aprovação.");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Não foi possível reenviar a solicitação.");
        },
      }
    );
  };

  const handleCancelReturnedSolicitacao = () => {
    if (!data) return;

    const confirmed = window.confirm(
      `Cancelar a solicitação "${data.titulo}"? Essa ação manterá o histórico, mas encerrará o fluxo.`
    );

    if (!confirmed) return;

    updateStatus(
      {
        solicitacaoId: data.id,
        statusNovo: "cancelado",
        comentario: "Solicitação cancelada pelo solicitante após devolução.",
      },
      {
        onSuccess: () => {
          setIsEditingReturned(false);
          toast.success("Solicitação cancelada com sucesso.");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Não foi possível cancelar a solicitação.");
        },
      }
    );
  };

  const handleToggleAdminOperationalEdit = () => {
    if (!data || isAdminAdjusting) return;

    setIsEditingAdminOperational((prev) => {
      const next = !prev;

      if (next || prev) {
        setAdminFormValues(buildAdminOperationalForm(data));
      }

      return next;
    });
  };

  const handleSaveAdminOperationalAdjustments = () => {
    if (!data || !canAdminOperationalAdjust) return;

    if (!adminFormValues.justificativa.trim()) {
      toast.error("A justificativa administrativa e obrigatoria.");
      return;
    }

    if (!adminFormValues.titulo.trim() || adminFormValues.titulo.trim().length < 3) {
      toast.error("Informe um titulo valido para a solicitacao.");
      return;
    }

    if (!adminFormValues.empresa) {
      toast.error("Selecione a empresa da solicitacao.");
      return;
    }

    if (adminFormValues.setorId < 1) {
      toast.error("Selecione um setor valido.");
      return;
    }

    if (adminFormValues.categoriaId < 1) {
      toast.error("Selecione uma categoria valida.");
      return;
    }

    if (adminFormValues.quantidade < 1) {
      toast.error("Informe uma quantidade valida.");
      return;
    }

    if (adminFormValues.valorEstimado <= 0) {
      toast.error("Informe um valor estimado unitario maior que zero.");
      return;
    }

    if (
      isCardPaymentInAdminForm &&
      (!adminFormValues.parcelas || Number(adminFormValues.parcelas) < 1)
    ) {
      toast.error("Informe o parcelamento para metodo de pagamento em cartao.");
      return;
    }

    const valorRealUnitarioInformado = adminFormValues.valorRealCompraUnitario.trim();
    if (
      valorRealUnitarioInformado &&
      (!Number.isFinite(Number(valorRealUnitarioInformado)) ||
        Number(valorRealUnitarioInformado) <= 0)
    ) {
      toast.error("Valor real unitario invalido.");
      return;
    }

    adminAdjustSolicitacao(
      {
        solicitacaoId: data.id,
        justificativa: adminFormValues.justificativa.trim(),
        titulo: adminFormValues.titulo.trim(),
        descricao: adminFormValues.descricao,
        empresa: adminFormValues.empresa as any,
        setorId: adminFormValues.setorId,
        categoriaId: adminFormValues.categoriaId,
        quantidade: adminFormValues.quantidade,
        valorEstimado: adminFormValues.valorEstimado,
        valorRealCompraUnitario: valorRealUnitarioInformado
          ? Number(valorRealUnitarioInformado)
          : null,
        metodoPagamento: adminFormValues.metodoPagamento
          ? (adminFormValues.metodoPagamento as any)
          : null,
        parcelas: isCardPaymentInAdminForm
          ? Number(adminFormValues.parcelas)
          : null,
        fornecedor: adminFormValues.fornecedor.trim() || null,
        canalCompra: adminFormValues.canalCompra || null,
        dataCompra: adminFormValues.dataCompra
          ? new Date(`${adminFormValues.dataCompra}T00:00:00`).toISOString()
          : null,
        observacaoCompra: adminFormValues.observacaoCompra || null,
        referenciaPedido: adminFormValues.referenciaPedido || null,
        linkProduto: adminFormValues.linkProduto || null,
      },
      {
        onSuccess: async (result) => {
          setIsEditingAdminOperational(false);
          setAdminFormValues((prev) => ({ ...prev, justificativa: "" }));
          await queryClient.invalidateQueries({
            queryKey: SOLICITACOES_KEYS.all,
            refetchType: "active",
          });
          await queryClient.invalidateQueries({
            queryKey: SOLICITACAO_DETAIL_KEYS.detail(data.id),
          });
          toast.success(
            `Ajuste administrativo aplicado com sucesso (${result.changedFields.length} campo(s)).`
          );
        },
        onError: (err: any) => {
          toast.error(err?.message || "Nao foi possivel aplicar o ajuste administrativo.");
        },
      }
    );
  };

  const handleDeleteAdministrativo = () => {
    if (!data || user?.role !== "admin") return;

    const justificativa = deleteJustificativa.trim();
    if (!justificativa) {
      toast.error("Informe a justificativa para exclusao administrativa.");
      return;
    }

    deleteSolicitacaoMutation.mutate(
      {
        solicitacaoId: data.id,
        justificativa,
      },
      {
        onSuccess: async (result) => {
          const deletedId = Number(result.deletedId);

          queryClient.setQueriesData(
            { queryKey: SOLICITACOES_KEYS.lists() },
            (current: any) => {
              if (!Array.isArray(current)) return current;
              return current.filter((item: any) => Number(item?.id) !== deletedId);
            }
          );

          queryClient.removeQueries({
            queryKey: SOLICITACAO_DETAIL_KEYS.detail(deletedId),
          });

          await queryClient.invalidateQueries({
            queryKey: SOLICITACOES_KEYS.all,
            refetchType: "active",
          });

          setDeleteDialogOpen(false);
          setDeleteJustificativa("");
          toast.success("Solicitacao excluida permanentemente.");

          // Forca sincronizacao visual completa da listagem apos hard delete.
          window.location.replace(`/solicitacoes?refresh=${Date.now()}`);
        },
        onError: (err: any) => {
          toast.error(err?.message || "Nao foi possivel excluir a solicitacao.");
        },
      }
    );
  };

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>Erro ao carregar a solicitação</h2>
          <p>{error instanceof Error ? error.message : "Não foi possível carregar os dados."}</p>
          <Button onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={styles.container}>
        <Skeleton className={styles.headerSkeleton} />
        <Skeleton className={styles.cardSkeleton} />
        <Skeleton className={styles.cardSkeleton} />
        <Skeleton className={styles.cardSkeleton} />
      </div>
    );
  }

  const valorEstimadoTotalFromApi = Number(data.valorEstimadoTotal);
  const valorEstimadoTotal =
    Number.isFinite(valorEstimadoTotalFromApi) && valorEstimadoTotalFromApi > 0
      ? valorEstimadoTotalFromApi
      : calculateEstimatedTotal({
          valorEstimadoUnitario: data.valorEstimado,
          quantidade: data.quantidade,
        });
  const valorRealTotal = calculateRealTotal({
    valorRealCompraUnitario: data.valorRealCompraUnitario,
    valorRealCompraLegado: data.valorRealCompra,
    quantidade: data.quantidade,
  });
  const hasRealCompra = valorRealTotal > 0;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{data.titulo} - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft size={20} />
        </Button>
        <h1 className={styles.title}>{data.titulo}</h1>
        <Badge variant={getStatusBadgeVariant(data.status)} className={styles.headerBadge}>
          {formatStatus(data.status)}
        </Badge>
        <Badge variant={getPrioridadeBadgeVariant(data.prioridade)} className={styles.headerBadge}>
          {formatPrioridade(data.prioridade)}
        </Badge>
      </div>

      <div className={styles.contentGrid}>
        {canAdjustReturned ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tratativa da Solicitação Devolvida</h2>

            {latestReturnComment ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "color-mix(in srgb, var(--warning) 14%, transparent)",
                }}
              >
                <strong style={{ display: "block", marginBottom: 6 }}>
                  Motivo da devolução
                </strong>
                <span>{latestReturnComment}</span>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <Button
                type="button"
                variant={isEditingReturned ? "ghost" : "outline"}
                onClick={() => setIsEditingReturned((prev) => !prev)}
                disabled={isProcessingReturnedAction}
              >
                <SquarePen size={16} />
                {isEditingReturned ? "Cancelar edição" : "Editar solicitação"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSaveReturnedAdjustments}
                disabled={!isEditingReturned || isProcessingReturnedAction}
              >
                <RotateCcw size={16} />
                {updateSolicitacaoMutation.isPending ? "Processando..." : "Salvar ajustes"}
              </Button>

              <Button
                type="button"
                onClick={handleResendReturnedSolicitacao}
                disabled={isProcessingReturnedAction}
              >
                <RotateCcw size={16} />
                {updateSolicitacaoMutation.isPending ? "Processando..." : "Reenviar para aprovação"}
              </Button>

              {canCancelReturned ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelReturnedSolicitacao}
                  disabled={isProcessingReturnedAction}
                >
                  <XCircle size={16} />
                  {isUpdatingStatus ? "Processando..." : "Cancelar solicitação"}
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {canAdjustReturned && isEditingReturned ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Editar Solicitação</h2>

            <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Item solicitado</label>
                <Input
                  value={formValues.titulo}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, titulo: e.target.value }))
                  }
                  placeholder="Ex: Notebook Dell Inspiron"
                />
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Empresa</label>
                  <Select
                    value={formValues.empresa || "_empty"}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        empresa: value === "_empty" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Selecione...</SelectItem>
                      {EMPRESA_OPTIONS.map((empresa) => (
                        <SelectItem key={empresa.value} value={empresa.value}>
                          {formatEmpresa(empresa.value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div />
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Setor</label>
                  <Select
                    value={formValues.setorId ? String(formValues.setorId) : "_empty"}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        setorId: value === "_empty" ? 0 : Number(value),
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
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Categoria</label>
                  <Select
                    value={formValues.categoriaId ? String(formValues.categoriaId) : "_empty"}
                    onValueChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        categoriaId: value === "_empty" ? 0 : Number(value),
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
                </div>
              </div>

              <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Valor estimado unitário</label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formValues.valorEstimado === 0 ? "" : formValues.valorEstimado}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        valorEstimado: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6 }}>Quantidade</label>
                  <Input
                    type="number"
                    min="1"
                    value={formValues.quantidade === 0 ? "" : formValues.quantidade}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        quantidade: Number.parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Prioridade</label>
                <Select
                  value={formValues.prioridade}
                  onValueChange={(value) =>
                    setFormValues((prev) => ({ ...prev, prioridade: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="emergencial">Emergencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Link de referência</label>
                <Input
                  value={formValues.linkProduto}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, linkProduto: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Detalhamento</label>
                <Textarea
                  value={formValues.descricao}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, descricao: e.target.value }))
                  }
                  placeholder="Descreva melhor o item e os ajustes realizados..."
                />
              </div>
            </div>
          </section>
        ) : null}

        {canAdminOperationalAdjust || canDeleteSolicitacaoAdministrativa ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Ajuste administrativo</h2>

            <p className={styles.emptyText}>
              Somente administradores podem corrigir dados da solicitação e da compra sem alterar o status atual.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              {canAdminOperationalAdjust ? (
                <Button
                  type="button"
                  variant={isEditingAdminOperational ? "ghost" : "outline"}
                  onClick={handleToggleAdminOperationalEdit}
                  disabled={isAdminAdjusting || deleteSolicitacaoMutation.isPending}
                >
                  <SquarePen size={16} />
                  {isEditingAdminOperational ? "Cancelar ajuste" : "Editar dados administrativos"}
                </Button>
              ) : null}

              {canAdminOperationalAdjust ? (
                <Button
                  type="button"
                  onClick={handleSaveAdminOperationalAdjustments}
                  disabled={
                    !isEditingAdminOperational ||
                    isAdminAdjusting ||
                    deleteSolicitacaoMutation.isPending ||
                    adminAdjustmentSummary.length === 0
                  }
                >
                  <RotateCcw size={16} />
                  {isAdminAdjusting ? "Aplicando..." : "Aplicar ajuste administrativo"}
                </Button>
              ) : null}

              {canDeleteSolicitacaoAdministrativa ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isUpdatingStatus || deleteSolicitacaoMutation.isPending}
                >
                  <XCircle size={16} />
                  Excluir solicitacao
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {canAdminOperationalAdjust && isEditingAdminOperational ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Ajuste administrativo da compra</h2>

            <div className={styles.adminAdjustForm}>
              <div className={styles.adminAdjustGroup}>
                <h3 className={styles.textLabel}>Dados da solicitação</h3>
                <div className={styles.formGridTwo}>
                  <div>
                    <label className={styles.formLabel}>Título</label>
                    <Input
                      value={adminFormValues.titulo}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, titulo: e.target.value }))
                      }
                      placeholder="Título da solicitação"
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Link do produto</label>
                    <Input
                      value={adminFormValues.linkProduto}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, linkProduto: e.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className={styles.formLabel}>Descrição</label>
                  <Textarea
                    value={adminFormValues.descricao}
                    onChange={(e) =>
                      setAdminFormValues((prev) => ({ ...prev, descricao: e.target.value }))
                    }
                    placeholder="Detalhes da solicitação"
                  />
                </div>

                <div className={styles.formGridThree}>
                  <div>
                    <label className={styles.formLabel}>Empresa</label>
                    <Select
                      value={adminFormValues.empresa}
                      onValueChange={(value) =>
                        setAdminFormValues((prev) => ({ ...prev, empresa: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPRESA_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className={styles.formLabel}>Setor</label>
                    <Select
                      value={adminFormValues.setorId ? String(adminFormValues.setorId) : "_none"}
                      onValueChange={(value) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          setorId: value === "_none" ? 0 : Number(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Selecione...</SelectItem>
                        {setoresOptions.map((setor) => (
                          <SelectItem key={setor.id} value={String(setor.id)}>
                            {setor.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className={styles.formLabel}>Categoria</label>
                    <Select
                      value={
                        adminFormValues.categoriaId ? String(adminFormValues.categoriaId) : "_none"
                      }
                      onValueChange={(value) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          categoriaId: value === "_none" ? 0 : Number(value),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Selecione...</SelectItem>
                        {categoriasOptions.map((categoria) => (
                          <SelectItem key={categoria.id} value={String(categoria.id)}>
                            {categoria.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className={styles.formGridTwo}>
                  <div>
                    <label className={styles.formLabel}>Quantidade</label>
                    <Input
                      type="number"
                      min="1"
                      value={adminFormValues.quantidade}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          quantidade: Number.parseInt(e.target.value, 10) || 1,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Valor estimado unitário (R$)</label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={adminFormValues.valorEstimado}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          valorEstimado: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={styles.adminAdjustGroup}>
                <h3 className={styles.textLabel}>Dados da compra</h3>

                <div className={styles.formGridTwo}>
                  <div>
                    <label className={styles.formLabel}>Método de pagamento</label>
                    <Select
                      value={adminFormValues.metodoPagamento || "_none"}
                      onValueChange={(value) => {
                        setAdminFormValues((prev) => ({
                          ...prev,
                          metodoPagamento: value === "_none" ? "" : value,
                          parcelas:
                            value === "cartao_acseg" ||
                            value === "cartao_acontrans" ||
                            value === "cartao_sp"
                              ? prev.parcelas || "1"
                              : "1",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Não informado</SelectItem>
                        {METODO_PAGAMENTO_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className={styles.formLabel}>Parcelas</label>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={adminFormValues.parcelas}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, parcelas: e.target.value }))
                      }
                      disabled={!isCardPaymentInAdminForm}
                    />
                  </div>
                </div>

                <div className={styles.formGridThree}>
                  <div>
                    <label className={styles.formLabel}>Valor real unitário (R$)</label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={adminFormValues.valorRealCompraUnitario}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          valorRealCompraUnitario: e.target.value,
                        }))
                      }
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Total estimado recalculado</label>
                    <Input type="text" value={formatCurrency(adminEstimatedTotalPreview)} readOnly />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Total real recalculado</label>
                    <Input type="text" value={formatCurrency(adminRealTotalPreview)} readOnly />
                  </div>
                </div>

                <div className={styles.formGridTwo}>
                  <div>
                    <label className={styles.formLabel}>Canal / Plataforma</label>
                    <Select
                      value={adminFormValues.canalCompra || "_none"}
                      onValueChange={(value) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          canalCompra: value === "_none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Não informado</SelectItem>
                        {CANAL_COMPRA_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className={styles.formLabel}>Fornecedor</label>
                    <Input
                      value={adminFormValues.fornecedor}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, fornecedor: e.target.value }))
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className={styles.formGridThree}>
                  <div>
                    <label className={styles.formLabel}>Data da compra</label>
                    <Input
                      type="date"
                      value={adminFormValues.dataCompra}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, dataCompra: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Referência do pedido</label>
                    <Input
                      value={adminFormValues.referenciaPedido}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({
                          ...prev,
                          referenciaPedido: e.target.value,
                        }))
                      }
                      placeholder="Opcional"
                    />
                  </div>

                  <div>
                    <label className={styles.formLabel}>Link do produto</label>
                    <Input
                      value={adminFormValues.linkProduto}
                      onChange={(e) =>
                        setAdminFormValues((prev) => ({ ...prev, linkProduto: e.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className={styles.formLabel}>Observação da compra</label>
                  <Textarea
                    value={adminFormValues.observacaoCompra}
                    onChange={(e) =>
                      setAdminFormValues((prev) => ({
                        ...prev,
                        observacaoCompra: e.target.value,
                      }))
                    }
                    placeholder="Observações complementares"
                  />
                </div>
              </div>

              <div className={styles.adminAdjustGroup}>
                <h3 className={styles.textLabel}>Justificativa do ajuste</h3>
                <div>
                  <label className={styles.formLabel}>Justificativa obrigatória</label>
                  <Textarea
                    value={adminFormValues.justificativa}
                    onChange={(e) =>
                      setAdminFormValues((prev) => ({
                        ...prev,
                        justificativa: e.target.value,
                      }))
                    }
                    placeholder="Explique o motivo do ajuste administrativo..."
                  />
                </div>
              </div>

              <div className={styles.adminSummaryBox}>
                <div className={styles.adminSummaryHeader}>
                  <strong>Resumo das alterações</strong>
                  <span>{adminAdjustmentSummary.length} campo(s) alterado(s)</span>
                </div>

                {adminAdjustmentSummary.length === 0 ? (
                  <p className={styles.emptyText}>Nenhuma alteração pendente para aplicar.</p>
                ) : (
                  <div className={styles.adminSummaryList}>
                    {adminAdjustmentSummary.map((change) => (
                      <div key={change.key} className={styles.adminSummaryItem}>
                        <span className={styles.adminSummaryLabel}>{change.label}</span>
                        <span className={styles.adminSummaryValues}>
                          {change.previous} {" -> "} {change.next}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {canManagePurchase ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Ações Operacionais do TI</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              {data.linkProduto ? (
                <Button type="button" variant="ghost" onClick={handleOpenLink}>
                  <ExternalLink size={16} /> Abrir link do produto
                </Button>
              ) : null}

              {canStartPurchase ? (
                <Button
                  type="button"
                  onClick={handleStartPurchase}
                  disabled={isUpdatingStatus}
                >
                  <PlayCircle size={16} />
                  {isUpdatingStatus ? "Processando..." : "Iniciar compra"}
                </Button>
              ) : null}

              {canMarkAsComprado ? (
                <Button
                  type="button"
                  onClick={handleMarkAsComprado}
                  disabled={isUpdatingStatus}
                >
                  <CheckCircle2 size={16} />
                  {isUpdatingStatus ? "Processando..." : "Marcar como comprado"}
                </Button>
              ) : null}

              {!canStartPurchase && !canMarkAsComprado ? (
                <span className={styles.emptyText}>
                  Nenhuma ação operacional disponível para o status atual.
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Informações Principais</h2>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Setor</span>
              <span className={styles.infoValue}>{data.setorNome}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Categoria</span>
              <span className={styles.infoValue}>{data.categoriaNome}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Solicitante</span>
              <span className={styles.infoValue}>{data.solicitanteNome}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Empresa</span>
              <span className={styles.infoValue}>{formatEmpresa(data.empresa)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{data.solicitanteEmail}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Quantidade</span>
              <span className={styles.infoValue}>
                {data.quantidade} {data.unidade || ""}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Valor Estimado Unitário</span>
              <span className={styles.infoValue}>{formatCurrency(data.valorEstimado)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Valor Estimado Total</span>
              <span className={styles.infoValue}>{formatCurrency(valorEstimadoTotal)}</span>
            </div>
            {hasRealCompra ? (
              <>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Valor Real Unitário</span>
                  <span className={styles.infoValue}>
                    {detailValorRealUnitario !== null
                      ? formatCurrency(detailValorRealUnitario)
                      : "-"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Valor Real Total</span>
                  <span className={styles.infoValue}>{formatCurrency(valorRealTotal)}</span>
                </div>
              </>
            ) : null}
            {hasRealCompra ? (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Data da Compra</span>
                <span className={styles.infoValue}>{formatDate(data.dataCompra)}</span>
              </div>
            ) : null}
            {hasRealCompra ? (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fornecedor</span>
                <span className={styles.infoValue}>{data.fornecedor || "Nao informado"}</span>
              </div>
            ) : null}
            {hasRealCompra ? (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Canal / Plataforma</span>
                <span className={styles.infoValue}>{formatCanalCompra(data.canalCompra)}</span>
              </div>
            ) : null}
            {hasRealCompra ? (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Observação da Compra</span>
                <span className={styles.infoValue}>
                  {data.observacaoCompra?.trim() || "Não informada"}
                </span>
              </div>
            ) : null}
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Prioridade</span>
              <span className={styles.infoValue}>{formatPrioridade(data.prioridade)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data de Criação</span>
              <span className={styles.infoValue}>{formatDate(data.createdAt)}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Link do Produto</span>
              <span className={styles.infoValue}>
                {data.linkProduto ? (
                  <a href={data.linkProduto} target="_blank" rel="noreferrer">
                    Abrir link
                  </a>
                ) : (
                  "Não informado"
                )}
              </span>
            </div>
          </div>

          <div className={styles.textSection}>
            <h3 className={styles.textLabel}>Descrição</h3>
            <p className={styles.textContent}>
              {data.descricao || "Nenhuma descrição fornecida."}
            </p>
          </div>

          <div className={styles.textSection}>
            <h3 className={styles.textLabel}>Justificativa</h3>
            <p className={styles.textContent}>
              {data.justificativa || "Não informada."}
            </p>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Auditoria de ajustes</h2>
          {data.ajustesOperacionais.length === 0 ? (
            <p className={styles.emptyText}>Nenhum ajuste registrado.</p>
          ) : (
            <div className={styles.timeline}>
              {data.ajustesOperacionais.map((ajuste) => (
                <div key={ajuste.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineUser}>{ajuste.usuarioNome}</span>
                      <span className={styles.timelineDate}>{formatDate(ajuste.createdAt)}</span>
                    </div>
                    <div className={styles.timelineStatus}>
                      <span className={styles.oldStatus}>
                        {formatAdministrativeAuditFieldLabel(ajuste.campo)}
                      </span>
                    </div>
                    <div className={styles.timelineComment}>
                      {formatAuditValue(ajuste.campo, ajuste.valorAnterior)} {" -> "}{" "}
                      {formatAuditValue(ajuste.campo, ajuste.valorNovo)}
                    </div>
                    <div className={styles.timelineComment}>
                      Justificativa: {ajuste.justificativa}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Financeiro</h2>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Método de pagamento</span>
              <span className={styles.infoValue}>
                {formatMetodoPagamento(data.metodoPagamento || data.formaPagamento)}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Parcelamento</span>
              <span className={styles.infoValue}>
                {data.parcelas ? `${data.parcelas}x` : "Não informado"}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Aprovado por</span>
              <span className={styles.infoValue}>
                {data.financeiroAprovadorNome || "Não informado"}
              </span>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data da aprovação financeira</span>
              <span className={styles.infoValue}>
                {data.financeiroAprovadoEm
                  ? formatDate(data.financeiroAprovadoEm)
                  : "Não informada"}
              </span>
            </div>
          </div>

          <div className={styles.textSection}>
            <h3 className={styles.textLabel}>Justificativa financeira</h3>
            <p className={styles.textContent}>
              {data.financeiroJustificativa || "Nenhuma justificativa financeira registrada."}
            </p>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Aprovações</h2>
          {data.aprovacoes.length === 0 ? (
            <p className={styles.emptyText}>Nenhuma aprovação registrada.</p>
          ) : (
            <div className={styles.approvalList}>
              {data.aprovacoes.map((aprovacao) => (
                <div key={aprovacao.id} className={styles.approvalItem}>
                  <div className={styles.approvalHeader}>
                    <span className={styles.approvalName}>{aprovacao.aprovadorNome}</span>
                    <Badge variant={getStatusBadgeVariant(aprovacao.status)}>
                      {formatStatus(aprovacao.status)}
                    </Badge>
                  </div>
                  <div className={styles.approvalMeta}>
                    <span className={styles.approvalDate}>
                      {formatDate(aprovacao.createdAt)}
                    </span>
                  </div>
                  {aprovacao.comentario && (
                    <div className={styles.approvalComment}>{aprovacao.comentario}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Histórico de Alterações</h2>
          {data.historico.length === 0 ? (
            <p className={styles.emptyText}>Nenhum histórico registrado.</p>
          ) : (
            <div className={styles.timeline}>
              {data.historico.map((h) => (
                <div key={h.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineUser}>{h.usuarioNome}</span>
                      <span className={styles.timelineDate}>{formatDate(h.createdAt)}</span>
                    </div>
                    <div className={styles.timelineStatus}>
                      {h.statusAnterior ? (
                        <>
                          <span className={styles.oldStatus}>
                            {formatStatus(h.statusAnterior)}
                          </span>
                          <span className={styles.arrow}>→</span>
                        </>
                      ) : null}
                      <span className={styles.newStatus}>{formatStatus(h.statusNovo)}</span>
                    </div>
                    {h.comentario && (
                      <div className={styles.timelineComment}>{h.comentario}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteJustificativa("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir solicitação definitivamente</DialogTitle>
            <DialogDescription>
              Esta ação remove a solicitação do sistema de forma permanente.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border)",
                backgroundColor: "var(--muted)",
                display: "grid",
                gap: 6,
              }}
            >
              <div><strong>ID:</strong> {data.id}</div>
              <div><strong>Título:</strong> {data.titulo}</div>
              <div><strong>Status atual:</strong> {formatStatus(data.status)}</div>
              <div style={{ color: "var(--warning)" }}>
                Exclusão definitiva: esta ação não poderá ser desfeita.
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6 }}>
                Justificativa da exclusão (obrigatória)
              </label>
              <Textarea
                value={deleteJustificativa}
                onChange={(e) => setDeleteJustificativa(e.target.value)}
                placeholder="Descreva o motivo da exclusão definitiva..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteJustificativa("");
              }}
              disabled={deleteSolicitacaoMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAdministrativo}
              disabled={
                deleteSolicitacaoMutation.isPending ||
                deleteJustificativa.trim().length === 0
              }
            >
              {deleteSolicitacaoMutation.isPending
                ? "Excluindo..."
                : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

