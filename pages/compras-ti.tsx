import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  RotateCcw,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../helpers/useAuth";
import {
  useMutationUpdateStatus,
  useQuerySolicitacoesOperational,
} from "../helpers/useSolicitacoes";
import {
  formatCanalCompra,
  formatCurrency,
  formatDate,
  formatEmpresa,
  formatPrioridade,
  formatStatus,
  getStatusBadgeVariant,
  getPrioridadeBadgeVariant,
} from "../helpers/formatters";
import {
  calculateEstimatedTotal,
  calculateRealTotal,
  resolveRealUnitario,
  toFiniteNumber,
} from "../helpers/monetary";
import {
  CANAL_COMPRA_OPTIONS,
  TI_OPERATIONAL_VISIBLE_STATUSES,
} from "../helpers/solicitacoesDomain";
import { type SolicitacaoListItem } from "../endpoints/solicitacoes/list_GET.schema";

import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";

import styles from "./aprovacoes.module.css";

const ITEMS_PER_GROUP = 10;

export default function ComprasTI() {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  const canAccess = user?.role === "ti" || user?.role === "admin";
  const [showAllAguardando, setShowAllAguardando] = useState(false);
  const [showAllEmCompra, setShowAllEmCompra] = useState(false);
  const [showAllAguardandoEntrega, setShowAllAguardandoEntrega] = useState(false);
  const [showAllConcluidas, setShowAllConcluidas] = useState(false);
  const [compraTarget, setCompraTarget] = useState<SolicitacaoListItem | null>(null);
  const [valorRealCompraUnitario, setValorRealCompraUnitario] = useState<string>("");
  const [dataCompra, setDataCompra] = useState<string>("");
  const [canalCompra, setCanalCompra] = useState<string>("");
  const [observacaoCompra, setObservacaoCompra] = useState<string>("");
  const [ajusteTarget, setAjusteTarget] = useState<SolicitacaoListItem | null>(null);
  const [ajusteQuantidade, setAjusteQuantidade] = useState<string>("1");
  const [ajusteValorUnitario, setAjusteValorUnitario] = useState<string>("");
  const [ajusteCanalCompra, setAjusteCanalCompra] = useState<string>("");
  const [ajusteObservacaoCompra, setAjusteObservacaoCompra] = useState<string>("");
  const [ajusteJustificativa, setAjusteJustificativa] = useState<string>("");

  const { data, isLoading } = useQuerySolicitacoesOperational({});
  const { mutate: updateStatus, isPending: isUpdatingStatus } =
    useMutationUpdateStatus();

  const comprasData = useMemo(() => {
    if (!data || !canAccess) return [];

    const filtered = data.filter((item) =>
      TI_OPERATIONAL_VISIBLE_STATUSES.includes(item.status as any)
    );

    return filtered;
  }, [data, canAccess]);

  const aguardandoCompra = useMemo(() => {
    return comprasData.filter((item) => item.status === "aprovado_para_compra");
  }, [comprasData]);

  const emCompra = useMemo(() => {
    return comprasData.filter((item) => item.status === "em_compra");
  }, [comprasData]);

  const aguardandoEntrega = useMemo(() => {
    return comprasData.filter((item) => item.status === "comprado");
  }, [comprasData]);

  const concluidas = useMemo(() => {
    return comprasData.filter((item) => item.status === "concluido");
  }, [comprasData]);

  const visibleAguardandoCompra = useMemo(() => {
    return showAllAguardando
      ? aguardandoCompra
      : aguardandoCompra.slice(0, ITEMS_PER_GROUP);
  }, [aguardandoCompra, showAllAguardando]);

  const visibleEmCompra = useMemo(() => {
    return showAllEmCompra ? emCompra : emCompra.slice(0, ITEMS_PER_GROUP);
  }, [emCompra, showAllEmCompra]);

  const visibleAguardandoEntrega = useMemo(() => {
    return showAllAguardandoEntrega
      ? aguardandoEntrega
      : aguardandoEntrega.slice(0, ITEMS_PER_GROUP);
  }, [aguardandoEntrega, showAllAguardandoEntrega]);

  const visibleConcluidas = useMemo(() => {
    return showAllConcluidas ? concluidas : concluidas.slice(0, ITEMS_PER_GROUP);
  }, [concluidas, showAllConcluidas]);

  const compraQuantidade = compraTarget ? Number(compraTarget.quantidade || 1) : 1;
  const compraTotalEstimado = compraTarget
    ? calculateEstimatedTotal({
        valorEstimadoUnitario: compraTarget.valorEstimado,
        quantidade: compraTarget.quantidade,
      })
    : 0;
  const compraTotalRealPreview = calculateRealTotal({
    valorRealCompraUnitario: toFiniteNumber(valorRealCompraUnitario, 0),
    quantidade: compraQuantidade,
  });

  const ajusteQuantidadeValor = Number.parseInt(ajusteQuantidade, 10) || 1;
  const ajusteTotalRealPreview = calculateRealTotal({
    valorRealCompraUnitario: toFiniteNumber(ajusteValorUnitario, 0),
    quantidade: ajusteQuantidadeValor,
    valorRealCompraLegado: ajusteTarget?.valorRealCompra ?? undefined,
  });

  const openProductLink = (link?: string | null) => {
    if (!link) {
      toast.error("Esta solicitação não possui link de referência.");
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleIniciarCompra = (item: SolicitacaoListItem) => {
    const confirmed = window.confirm(
      `Confirmar que a solicitação "${item.titulo}" entrou em processo de compra?`
    );

    if (!confirmed) return;

    const comentario =
      user?.role === "ti"
        ? "Compra iniciada pelo TI."
        : "Compra iniciada pelo administrador.";

    updateStatus(
      {
        solicitacaoId: item.id,
        statusNovo: "em_compra",
        comentario,
      },
      {
        onSuccess: () => {
          toast.success("Solicitação movida para Em Compra.");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Não foi possível iniciar a compra.");
        },
      }
    );
  };

  const handleOpenCompraDialog = (item: SolicitacaoListItem) => {
    setCompraTarget(item);
    setValorRealCompraUnitario("");
    setDataCompra(new Date().toISOString().slice(0, 10));
    setCanalCompra("");
    setObservacaoCompra("");
  };

  const handleCloseCompraDialog = () => {
    setCompraTarget(null);
    setValorRealCompraUnitario("");
    setDataCompra("");
    setCanalCompra("");
    setObservacaoCompra("");
  };

  const handleOpenAjusteDialog = (item: SolicitacaoListItem) => {
    setAjusteTarget(item);
    setAjusteQuantidade(String(item.quantidade || 1));
    const unitarioAtual = resolveRealUnitario({
      valorRealCompraUnitario: item.valorRealCompraUnitario,
      valorRealCompraLegado: item.valorRealCompra,
      quantidade: item.quantidade,
    });
    setAjusteValorUnitario(unitarioAtual !== null ? String(unitarioAtual) : "");
    setAjusteCanalCompra(item.canalCompra || "");
    setAjusteObservacaoCompra(item.observacaoCompra || "");
    setAjusteJustificativa("");
  };

  const handleCloseAjusteDialog = () => {
    setAjusteTarget(null);
    setAjusteQuantidade("1");
    setAjusteValorUnitario("");
    setAjusteCanalCompra("");
    setAjusteObservacaoCompra("");
    setAjusteJustificativa("");
  };

  const handleMarcarComoComprado = () => {
    if (!compraTarget) return;

    if (!valorRealCompraUnitario || Number(valorRealCompraUnitario) <= 0) {
      toast.error("Informe o valor real unitário da compra.");
      return;
    }

    if (!dataCompra) {
      toast.error("Informe a data da compra.");
      return;
    }

    if (!canalCompra) {
      toast.error("Selecione o canal da compra.");
      return;
    }

    const comentario =
      user?.role === "ti"
        ? "Item marcado como comprado pelo TI."
        : "Item marcado como comprado pelo administrador.";

    updateStatus(
      {
        solicitacaoId: compraTarget.id,
        statusNovo: "comprado",
        comentario,
        valorRealCompraUnitario: Number(valorRealCompraUnitario),
        valorRealCompra: compraTotalRealPreview,
        dataCompra: new Date(`${dataCompra}T00:00:00`).toISOString(),
        canalCompra,
        observacaoCompra: observacaoCompra.trim() || undefined,
      },
      {
        onSuccess: () => {
          handleCloseCompraDialog();
          toast.success("Compra registrada e solicitação marcada como comprada.");
        },
        onError: (error: any) => {
          toast.error(
            error?.message || "Não foi possível registrar a compra."
          );
        },
      }
    );
  };

  const handleSalvarAjusteOperacional = () => {
    if (!ajusteTarget) return;

    if (!ajusteQuantidade || Number(ajusteQuantidade) < 1) {
      toast.error("Informe uma quantidade válida para o ajuste.");
      return;
    }

    if (!ajusteValorUnitario || Number(ajusteValorUnitario) <= 0) {
      toast.error("Informe o valor real unitário para recalcular o total.");
      return;
    }

    if (!ajusteJustificativa.trim()) {
      toast.error("A justificativa do ajuste é obrigatória.");
      return;
    }

    updateStatus(
      {
        solicitacaoId: ajusteTarget.id,
        statusNovo: ajusteTarget.status as any,
        comentario: ajusteJustificativa.trim(),
        quantidadeAjustada: Number(ajusteQuantidade),
        valorRealCompraUnitario: Number(ajusteValorUnitario),
        valorRealCompra: ajusteTotalRealPreview,
        canalCompra: ajusteCanalCompra || undefined,
        observacaoCompra: ajusteObservacaoCompra.trim() || undefined,
      },
      {
        onSuccess: () => {
          handleCloseAjusteDialog();
          toast.success("Ajuste operacional registrado com sucesso.");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Não foi possível salvar o ajuste operacional.");
        },
      }
    );
  };

  const handleConfirmarEntrega = (item: SolicitacaoListItem) => {
    const confirmed = window.confirm(
      `Confirmar entrega da solicitação "${item.titulo}"?`
    );

    if (!confirmed) return;

    const comentario =
      user?.role === "ti"
        ? "Entrega confirmada pelo TI."
        : "Entrega confirmada pelo administrador.";

    updateStatus(
      {
        solicitacaoId: item.id,
        statusNovo: "concluido",
        comentario,
      },
      {
        onSuccess: () => {
          toast.success("Entrega confirmada. Solicitação movida para Compras Finalizadas.");
        },
        onError: (error: any) => {
          toast.error(error?.message || "Não foi possível confirmar a entrega.");
        },
      }
    );
  };

  const renderCommonInfo = (item: SolicitacaoListItem) => {
    const valorEstimadoTotal = calculateEstimatedTotal({
      valorEstimadoUnitario: item.valorEstimado,
      quantidade: item.quantidade,
    });
    const valorRealUnitario = resolveRealUnitario({
      valorRealCompraUnitario: item.valorRealCompraUnitario,
      valorRealCompraLegado: item.valorRealCompra,
      quantidade: item.quantidade,
    });
    const valorRealTotal = calculateRealTotal({
      valorRealCompraUnitario: item.valorRealCompraUnitario,
      valorRealCompraLegado: item.valorRealCompra,
      quantidade: item.quantidade,
    });

    return (
      <div className={styles.compactCardBody}>
        <div className={styles.compactMetaGrid}>
          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Solicitante</span>
            <span className={styles.infoValue}>{item.solicitanteNome}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Data</span>
            <span className={styles.infoValue}>{formatDate(item.createdAt)}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Setor</span>
            <span className={styles.infoValue}>{item.setorNome || "-"}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Empresa</span>
            <span className={styles.infoValue}>{formatEmpresa(item.empresa)}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Categoria</span>
            <span className={styles.infoValue}>{item.categoriaNome || "-"}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Quantidade</span>
            <span className={styles.infoValue}>{item.quantidade}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Estimado Unitário</span>
            <span className={styles.infoValue}>{formatCurrency(item.valorEstimado)}</span>
          </div>

          <div className={styles.compactInfoRow}>
            <span className={styles.infoLabel}>Estimado Total</span>
            <span className={styles.compactValue}>{formatCurrency(valorEstimadoTotal)}</span>
          </div>

          {(item.status === "comprado" || item.status === "concluido") && (
            <>
              <div className={styles.compactInfoRow}>
                <span className={styles.infoLabel}>Real Unitário</span>
                <span className={styles.infoValue}>
                  {valorRealUnitario !== null ? formatCurrency(valorRealUnitario) : "-"}
                </span>
              </div>

              <div className={styles.compactInfoRow}>
                <span className={styles.infoLabel}>Real Total</span>
                <span className={styles.compactValue}>{formatCurrency(valorRealTotal)}</span>
              </div>

              <div className={styles.compactInfoRow}>
                <span className={styles.infoLabel}>Data da Compra</span>
                <span className={styles.infoValue}>{formatDate(item.dataCompra)}</span>
              </div>

              <div className={styles.compactInfoRow}>
                <span className={styles.infoLabel}>Canal</span>
                <span className={styles.infoValue}>{formatCanalCompra(item.canalCompra)}</span>
              </div>
            </>
          )}
        </div>

        {(item.status === "comprado" || item.status === "concluido") &&
        item.observacaoCompra?.trim() ? (
          <div className={styles.compraObservacao}>
            <h3 className={styles.compraObservacaoLabel}>Observação da Compra</h3>
            <p className={styles.compraObservacaoText}>{item.observacaoCompra}</p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderBaseActions = (item: SolicitacaoListItem) => (
    <>
      <Button variant="link" asChild>
        <Link to={`/solicitacoes/${item.id}`}>Ver solicitação</Link>
      </Button>

      {item.linkProduto ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => openProductLink(item.linkProduto)}
        >
          <ExternalLink size={16} /> Abrir referência
        </Button>
      ) : null}
    </>
  );

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Operação de Compras TI - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>Operação de Compras TI</h1>
        <p className={styles.subtitle}>
          Acompanhe as solicitações liberadas para compra, em andamento e finalizadas pelo TI.
        </p>
      </div>

      {!canAccess ? (
        <div className={styles.emptyState}>
          <ShoppingCart size={48} className={styles.emptyIcon} />
          <p>Você não possui acesso a esta área.</p>
        </div>
      ) : isLoading ? (
        <>
          <h2 style={{ marginBottom: 12 }}>Prontas para Compra</h2>
          <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className={styles.skeletonCard} />
            ))}
          </div>

          <h2 style={{ margin: "24px 0 12px" }}>Em Processo de Compra</h2>
          <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className={styles.skeletonCard} />
            ))}
          </div>

          <h2 style={{ margin: "24px 0 12px" }}>Aguardando Entrega</h2>
          <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className={styles.skeletonCard} />
            ))}
          </div>

          <h2 style={{ margin: "24px 0 12px" }}>Compras Finalizadas</h2>
          <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className={styles.skeletonCard} />
            ))}
          </div>
        </>
      ) : comprasData.length === 0 ? (
        <div className={styles.emptyState}>
          <ShoppingCart size={48} className={styles.emptyIcon} />
          <p>Nenhuma solicitação disponível para o TI no momento.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ marginBottom: 12 }}>
              Prontas para Compra ({aguardandoCompra.length})
            </h2>

            {aguardandoCompra.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nenhuma solicitação pronta para compra.</p>
              </div>
            ) : (
              <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
                {visibleAguardandoCompra.map((item) => (
                  <div key={item.id} className={`${styles.approvalCard} ${styles.compactApprovalCard}`}>
                    <div className={`${styles.cardHeader} ${styles.compactCardHeader}`}>
                      <h3 className={styles.cardTitle}>{item.titulo}</h3>

                      <div className={styles.compactHeaderBadges}>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatStatus(item.status)}
                        </Badge>
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade)}>
                          {formatPrioridade(item.prioridade)}
                        </Badge>
                      </div>
                    </div>

                    {renderCommonInfo(item)}

                    <div className={`${styles.cardFooter} ${styles.compactCardFooter}`}>
                      {renderBaseActions(item)}

                      <Button
                        type="button"
                        onClick={() => handleIniciarCompra(item)}
                        disabled={isUpdatingStatus}
                      >
                        <PlayCircle size={16} />
                        {isUpdatingStatus ? "Processando..." : "Assumir compra"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aguardandoCompra.length > ITEMS_PER_GROUP ? (
              <div className={styles.groupPagination}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllAguardando((prev) => !prev)}
                >
                  {showAllAguardando
                    ? "Ver menos"
                    : `Ver mais (${aguardandoCompra.length - ITEMS_PER_GROUP})`}
                </Button>
              </div>
            ) : null}
          </div>

          <div style={{ marginBottom: 28 }}>
            <h2 style={{ marginBottom: 12 }}>
              Em Processo de Compra ({emCompra.length})
            </h2>

            {emCompra.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nenhuma solicitação em processo de compra.</p>
              </div>
            ) : (
              <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
                {visibleEmCompra.map((item) => (
                  <div key={item.id} className={`${styles.approvalCard} ${styles.compactApprovalCard}`}>
                    <div className={`${styles.cardHeader} ${styles.compactCardHeader}`}>
                      <h3 className={styles.cardTitle}>{item.titulo}</h3>

                      <div className={styles.compactHeaderBadges}>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatStatus(item.status)}
                        </Badge>
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade)}>
                          {formatPrioridade(item.prioridade)}
                        </Badge>
                      </div>
                    </div>

                    {renderCommonInfo(item)}

                    <div className={`${styles.cardFooter} ${styles.compactCardFooter}`}>
                      {renderBaseActions(item)}

                      <Button
                        type="button"
                        onClick={() => handleOpenCompraDialog(item)}
                        disabled={isUpdatingStatus}
                      >
                        <CheckCircle2 size={16} />
                        Registrar compra
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {emCompra.length > ITEMS_PER_GROUP ? (
              <div className={styles.groupPagination}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllEmCompra((prev) => !prev)}
                >
                  {showAllEmCompra
                    ? "Ver menos"
                    : `Ver mais (${emCompra.length - ITEMS_PER_GROUP})`}
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <h2 style={{ marginBottom: 12 }}>
              Aguardando Entrega ({aguardandoEntrega.length})
            </h2>

            {aguardandoEntrega.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nenhuma compra aguardando entrega.</p>
              </div>
            ) : (
              <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
                {visibleAguardandoEntrega.map((item) => (
                  <div key={item.id} className={`${styles.approvalCard} ${styles.compactApprovalCard}`}>
                    <div className={`${styles.cardHeader} ${styles.compactCardHeader}`}>
                      <h3 className={styles.cardTitle}>{item.titulo}</h3>

                      <div className={styles.compactHeaderBadges}>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatStatus(item.status)}
                        </Badge>
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade)}>
                          {formatPrioridade(item.prioridade)}
                        </Badge>
                      </div>
                    </div>

                    {renderCommonInfo(item)}

                    <div className={`${styles.cardFooter} ${styles.compactCardFooter}`}>
                      {renderBaseActions(item)}

                      <Button
                        type="button"
                        onClick={() => handleConfirmarEntrega(item)}
                        disabled={isUpdatingStatus}
                      >
                        <CheckCircle2 size={16} />
                        Confirmar entrega
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenAjusteDialog(item)}
                        disabled={isUpdatingStatus}
                      >
                        <RotateCcw size={16} />
                        Ajuste operacional
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aguardandoEntrega.length > ITEMS_PER_GROUP ? (
              <div className={styles.groupPagination}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllAguardandoEntrega((prev) => !prev)}
                >
                  {showAllAguardandoEntrega
                    ? "Ver menos"
                    : `Ver mais (${aguardandoEntrega.length - ITEMS_PER_GROUP})`}
                </Button>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 28 }}>
            <h2 style={{ marginBottom: 12 }}>
              Compras Finalizadas ({concluidas.length})
            </h2>

            {concluidas.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Nenhuma compra finalizada ainda.</p>
              </div>
            ) : (
              <div className={`${styles.cardsGrid} ${styles.comprasTiCardsGrid}`}>
                {visibleConcluidas.map((item) => (
                  <div key={item.id} className={`${styles.approvalCard} ${styles.compactApprovalCard}`}>
                    <div className={`${styles.cardHeader} ${styles.compactCardHeader}`}>
                      <h3 className={styles.cardTitle}>{item.titulo}</h3>

                      <div className={styles.compactHeaderBadges}>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatStatus(item.status)}
                        </Badge>
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade)}>
                          {formatPrioridade(item.prioridade)}
                        </Badge>
                      </div>
                    </div>

                    {renderCommonInfo(item)}

                    <div className={`${styles.cardFooter} ${styles.compactCardFooter}`}>
                      {renderBaseActions(item)}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenAjusteDialog(item)}
                        disabled={isUpdatingStatus}
                      >
                        <RotateCcw size={16} />
                        Ajuste operacional
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {concluidas.length > ITEMS_PER_GROUP ? (
              <div className={styles.groupPagination}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllConcluidas((prev) => !prev)}
                >
                  {showAllConcluidas
                    ? "Ver menos"
                    : `Ver mais (${concluidas.length - ITEMS_PER_GROUP})`}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <Dialog
        open={!!compraTarget}
        onOpenChange={(open) => {
          if (!open) handleCloseCompraDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compra real</DialogTitle>
            <DialogDescription>
              Informe o valor unitário real e valide o total calculado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            {compraTarget ? (
              <div style={{ marginBottom: 12, display: "grid", gap: 6 }}>
                <strong>{compraTarget.titulo}</strong>
                <span>Quantidade: {compraTarget.quantidade}</span>
                <span>Estimado unitário: {formatCurrency(compraTarget.valorEstimado)}</span>
                <span>Estimado total: {formatCurrency(compraTotalEstimado)}</span>
              </div>
            ) : null}

            <div className={styles.compraGridTwo}>
              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Valor real unitário (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorRealCompraUnitario}
                  onChange={(e) => setValorRealCompraUnitario(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Total real calculado</label>
                <Input type="text" value={formatCurrency(compraTotalRealPreview)} readOnly />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Data da compra</label>
                <Input
                  type="date"
                  value={dataCompra}
                  onChange={(e) => setDataCompra(e.target.value)}
                />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Canal / Plataforma da compra</label>
                <Select value={canalCompra} onValueChange={setCanalCompra}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_COMPRA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={`${styles.compraField} ${styles.spanTwo}`}>
                <label className={styles.textareaLabel}>Observação da compra (opcional)</label>
                <Textarea
                  value={observacaoCompra}
                  onChange={(e) => setObservacaoCompra(e.target.value)}
                  placeholder="Informações complementares sobre a execução da compra..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseCompraDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarcarComoComprado}
              disabled={
                isUpdatingStatus ||
                !valorRealCompraUnitario ||
                Number(valorRealCompraUnitario) <= 0 ||
                !dataCompra ||
                !canalCompra
              }
            >
              {isUpdatingStatus ? "Salvando..." : "Registrar e marcar como comprado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!ajusteTarget}
        onOpenChange={(open) => {
          if (!open) handleCloseAjusteDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste operacional de compra</DialogTitle>
            <DialogDescription>
              Ajuste quantidade e/ou valor unitário real com justificativa obrigatória.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            {ajusteTarget ? (
              <div style={{ marginBottom: 12, display: "grid", gap: 6 }}>
                <strong>{ajusteTarget.titulo}</strong>
                <span>Status atual: {formatStatus(ajusteTarget.status)}</span>
              </div>
            ) : null}

            <div className={styles.compraGridTwo}>
              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Quantidade</label>
                <Input
                  type="number"
                  min="1"
                  value={ajusteQuantidade}
                  onChange={(e) => setAjusteQuantidade(e.target.value)}
                />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Valor real unitário (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={ajusteValorUnitario}
                  onChange={(e) => setAjusteValorUnitario(e.target.value)}
                />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Total real recalculado</label>
                <Input type="text" value={formatCurrency(ajusteTotalRealPreview)} readOnly />
              </div>

              <div className={styles.compraField}>
                <label className={styles.textareaLabel}>Canal / Plataforma</label>
                <Select value={ajusteCanalCompra} onValueChange={setAjusteCanalCompra}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_COMPRA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={`${styles.compraField} ${styles.spanTwo}`}>
                <label className={styles.textareaLabel}>Observação operacional (opcional)</label>
                <Textarea
                  value={ajusteObservacaoCompra}
                  onChange={(e) => setAjusteObservacaoCompra(e.target.value)}
                  placeholder="Detalhe técnico do ajuste realizado..."
                />
              </div>

              <div className={`${styles.compraField} ${styles.spanTwo}`}>
                <label className={styles.textareaLabel}>Justificativa do ajuste (obrigatória)</label>
                <Textarea
                  value={ajusteJustificativa}
                  onChange={(e) => setAjusteJustificativa(e.target.value)}
                  placeholder="Explique por que este ajuste operacional foi necessário..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseAjusteDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarAjusteOperacional}
              disabled={
                isUpdatingStatus ||
                !ajusteQuantidade ||
                Number(ajusteQuantidade) < 1 ||
                !ajusteValorUnitario ||
                Number(ajusteValorUnitario) <= 0 ||
                !ajusteJustificativa.trim()
              }
            >
              {isUpdatingStatus ? "Salvando..." : "Salvar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

