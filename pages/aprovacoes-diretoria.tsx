import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";

import { useAuth } from "../helpers/useAuth";
import { toastError, toastSuccess } from "../helpers/toast";
import {
  useMutationUpdateStatus,
  useQuerySolicitacoes,
} from "../helpers/useSolicitacoes";
import {
  formatCurrency,
  formatPrioridade,
  formatStatus,
  getPrioridadeBadgeVariant,
  getStatusBadgeVariant,
} from "../helpers/formatters";

import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";

import styles from "./aprovacoes-diretoria.module.css";

type ActionType = "approve" | "reject" | "return";

const DIRECTORIA_THRESHOLD = 500;

export default function AprovacoesDiretoria() {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;

  const canAccess = user?.role === "diretora_empresa" || user?.role === "admin";

  const { data, isLoading } = useQuerySolicitacoes({
    status: "pendente_diretoria" as any,
  });

  const pendingData = useMemo(() => {
    if (!data || !canAccess) return [];

    const filtered = data.filter((item) => {
      const valor = Number.parseFloat(String(item.valorEstimado || 0)) || 0;
      return item.status === "pendente_diretoria" && valor > DIRECTORIA_THRESHOLD;
    });

    return filtered;
  }, [data, canAccess]);

  const [selectedAction, setSelectedAction] = useState<{
    id: number;
    type: ActionType;
    titulo: string;
  } | null>(null);
  const [comentario, setComentario] = useState("");
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const { mutate: updateStatus, isPending } = useMutationUpdateStatus();

  const executeStatusUpdate = () => {
    if (!selectedAction) return;

    let statusNovo: string;

    if (selectedAction.type === "return") {
      statusNovo = "devolvido";
    } else if (selectedAction.type === "reject") {
      statusNovo = "rejeitado";
    } else {
      statusNovo = "aprovado_para_compra";
    }

    updateStatus(
      {
        solicitacaoId: selectedAction.id,
        statusNovo: statusNovo as any,
        comentario: comentario || undefined,
      },
      {
        onSuccess: () => {
          const actionType = selectedAction.type;
          setSelectedAction(null);
          setRejectConfirmOpen(false);
          setComentario("");
          toastSuccess(
            actionType === "approve"
              ? "Solicitação aprovada com sucesso."
              : actionType === "reject"
                ? "Solicitação reprovada."
                : "Deliberação registrada com sucesso."
          );
        },
        onError: () => {
          toastError(
            selectedAction.type === "approve"
              ? "Erro ao aprovar. Tente novamente."
              : selectedAction.type === "reject"
                ? "Erro ao reprovar. Tente novamente."
                : "Ocorreu um erro ao processar a solicitação."
          );
        },
      }
    );
  };

  const handleConfirm = () => {
    if (!selectedAction) return;

    if (selectedAction.type === "reject") {
      setRejectConfirmOpen(true);
      return;
    }

    executeStatusUpdate();
  };

  const closeDialog = () => {
    setSelectedAction(null);
    setComentario("");
  };

  const isCommentRequired =
    selectedAction?.type === "reject" || selectedAction?.type === "return";

  const isConfirmDisabled =
    isPending || (isCommentRequired && !comentario.trim());

  const getDialogContent = () => {
    switch (selectedAction?.type) {
      case "approve":
        return {
          title: "Liberar para compra",
          desc: "A solicitação seguirá para a operação do TI. Você pode adicionar um comentário opcional.",
          confirmText: "Confirmar liberação",
          confirmVariant: "primary" as const,
        };
      case "reject":
        return {
          title: "Reprovar solicitação",
          desc: "Informe a justificativa da reprovação. Esse comentário é obrigatório.",
          confirmText: "Confirmar reprovação",
          confirmVariant: "destructive" as const,
        };
      case "return":
        return {
          title: "Devolver para ajuste",
          desc: "Informe o que precisa ser ajustado antes da continuidade. Esse comentário é obrigatório.",
          confirmText: "Confirmar devolução",
          confirmVariant: "outline" as const,
        };
      default:
        return null;
    }
  };

  const dialogContent = getDialogContent();

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Deliberação da Diretoria - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>Deliberação da Diretoria</h1>
        <p className={styles.subtitle}>
          Avalie solicitações acima de {formatCurrency(DIRECTORIA_THRESHOLD)} já analisadas pelo Financeiro.
        </p>
      </div>

      <div className={styles.summaryBox}>
        <p className={styles.summaryTitle}>Critério atual</p>
        <p className={styles.summaryText}>
          Solicitações acima de {formatCurrency(DIRECTORIA_THRESHOLD)} passam pela etapa de diretoria
          antes de seguirem para compra.
        </p>
      </div>

      {!canAccess ? (
        <div className={styles.emptyState}>
          <Briefcase size={48} className={styles.emptyIcon} />
          <p>Você não possui acesso a esta área.</p>
        </div>
      ) : isLoading ? (
        <div className={styles.cardsGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : pendingData.length === 0 ? (
        <div className={styles.emptyState}>
          <Briefcase size={48} className={styles.emptyIcon} />
          <p>Nenhuma deliberação pendente no momento.</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {pendingData.map((item) => (
            <div key={item.id} className={styles.approvalCard}>
              <div className={styles.cardHeader}>
                <div className={styles.headerContent}>
                  <h3 className={styles.cardTitle}>{item.titulo}</h3>
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {formatStatus(item.status)}
                  </Badge>
                </div>

                <Badge variant={getPrioridadeBadgeVariant(item.prioridade)}>
                  {formatPrioridade(item.prioridade)}
                </Badge>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Solicitante:</span>
                  <span className={styles.infoValue}>{item.solicitanteNome}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Setor:</span>
                  <span className={styles.infoValue}>{item.setorNome}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Categoria:</span>
                  <span className={styles.infoValue}>{item.categoriaNome}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Valor estimado:</span>
                  <span className={styles.infoValue}>
                    {formatCurrency(item.valorEstimado)}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Justificativa:</span>
                  <span className={styles.infoValue}>
                    {item.justificativa || "Não informada"}
                  </span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <Button variant="link" asChild>
                  <Link to={`/solicitacoes/${item.id}`}>Abrir análise</Link>
                </Button>

                <div className={styles.actionButtons}>
                  <Button
                    variant="outline"
                    className={styles.warningButton}
                    onClick={() =>
                      setSelectedAction({
                        id: item.id,
                        type: "return",
                        titulo: item.titulo,
                      })
                    }
                  >
                    Devolver para ajuste
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() =>
                      setSelectedAction({
                        id: item.id,
                        type: "reject",
                        titulo: item.titulo,
                      })
                    }
                  >
                    Reprovar
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() =>
                      setSelectedAction({
                        id: item.id,
                        type: "approve",
                        titulo: item.titulo,
                      })
                    }
                  >
                    Liberar para compra
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogContent?.title}</DialogTitle>
            <DialogDescription>{dialogContent?.desc}</DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            <label className={styles.textareaLabel}>
              {isCommentRequired ? "Comentário obrigatório" : "Comentário opcional"}
            </label>

            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={
                selectedAction
                  ? `Comentário sobre "${selectedAction.titulo}"...`
                  : "Digite aqui o seu comentário..."
              }
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancelar
            </Button>

            <Button
              variant={dialogContent?.confirmVariant}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={selectedAction?.type === "return" ? styles.warningButton : undefined}
            >
              {dialogContent?.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectConfirmOpen}
        onOpenChange={setRejectConfirmOpen}
        title="Reprovar solicitação"
        description="Confirma a reprovação desta solicitação?"
        confirmLabel="Reprovar"
        variant="danger"
        loading={isPending}
        onConfirm={executeStatusUpdate}
      />
    </div>
  );
}
