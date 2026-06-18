import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleX, Eye, RefreshCcw } from 'lucide-react';

import { useAuth } from '../helpers/useAuth';
import { toastError, toastSuccess } from '../helpers/toast';
import {
  useMutationUpdateStatus,
  useQuerySolicitacoesOperational,
} from '../helpers/useSolicitacoes';
import { calculateEstimatedTotal } from '../helpers/monetary';
import {
  formatCurrency,
  formatDate,
  formatEmpresa,
  formatPrioridade,
  formatStatus,
  getPrioridadeBadgeVariant,
  getStatusBadgeVariant,
} from '../helpers/formatters';
import {
  APPROVAL_FLOW_BY_ROLE as APPROVAL_FLOW_BY_ROLE_SHARED,
  isCardPaymentMethod,
  METODO_PAGAMENTO_OPTIONS as METODO_PAGAMENTO_OPTIONS_SHARED,
} from '../helpers/solicitacoesDomain';

import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { Textarea } from '../components/Textarea';

import styles from './aprovacoes.module.css';

type ActionType = 'approve' | 'reject';
type ApprovalFlow = {
  pendingStatus: 'pendente_financeiro' | 'pendente_diretoria';
  pageTitle: string;
  pageSubtitle: string;
  emptyStateMessage: string;
  successMessage: string;
  requiresPaymentDetails: boolean;
  approveTitle: string;
  approveDescription: string;
  approveConfirmText: string;
};

const METODO_PAGAMENTO_OPTIONS = [
  { value: '_empty', label: 'Selecione' },
  ...METODO_PAGAMENTO_OPTIONS_SHARED,
] as const;

const PARCELAS_OPTIONS = Array.from({ length: 12 }).map((_, index) => ({
  value: String(index + 1),
  label: `${index + 1}x`,
}));

const APPROVAL_FLOW_BY_ROLE: Partial<Record<string, ApprovalFlow>> = APPROVAL_FLOW_BY_ROLE_SHARED;

const PRIORITY_BADGE_INLINE: Record<string, React.CSSProperties> = {
  baixa:       { background: '#1a1f2e', color: '#93c5fd', border: '1px solid #1d4ed8' },
  media:       { background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534' },
  alta:        { background: '#3d2000', color: '#fb923c', border: '1px solid #7c3500' },
  urgente:     { background: '#3d0000', color: '#f87171', border: '1px solid #7c0000' },
  emergencial: { background: '#3d0000', color: '#f87171', border: '1px solid #7c0000' },
};

const STATUS_BADGE_INLINE: Record<string, React.CSSProperties> = {
  pendente_financeiro:  { background: '#1e2433', color: '#93c5fd', border: '1px solid #1d4ed8' },
  pendente_diretoria:   { background: '#1e2433', color: '#93c5fd', border: '1px solid #1d4ed8' },
  aprovado_para_compra: { background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534' },
  em_compra:            { background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534' },
  comprado:             { background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534' },
  concluido:            { background: '#1a2e1a', color: '#4ade80', border: '1px solid #166534' },
  rejeitado:            { background: '#3d0000', color: '#f87171', border: '1px solid #7c0000' },
  cancelado:            { background: '#3d0000', color: '#f87171', border: '1px solid #7c0000' },
  inviavel_operacional: { background: '#3d0000', color: '#f87171', border: '1px solid #7c0000' },
};

const resolveMotivoCompra = (item: {
  justificativa?: string | null;
  descricao?: string | null;
  detalhamento?: string | null;
  observacao?: string | null;
}) => {
  const candidates = [
    item.justificativa,
    item.descricao,
    item.detalhamento,
    item.observacao,
  ];

  return candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0) ?? null;
};

export default function Aprovacoes() {
  const { authState } = useAuth();
  const user = authState.type === 'authenticated' ? authState.user : null;
  const currentFlow = user ? APPROVAL_FLOW_BY_ROLE[user.role] : undefined;

  const { data, isLoading, isFetching } = useQuerySolicitacoesOperational(
    currentFlow ? ({ status: currentFlow.pendingStatus as any }) : {}
  );

  const pendingData = useMemo(() => {
    if (!data || !currentFlow) return [];
    return data.filter((item) => item.status === currentFlow.pendingStatus);
  }, [data, currentFlow]);

  const [selectedAction, setSelectedAction] = useState<{
    id: number | string;
    type: ActionType;
  } | null>(null);

  const selectedApproval = useMemo(() => {
    if (!selectedAction) return null;
    return pendingData.find((item) => Number(item.id) === Number(selectedAction.id)) ?? null;
  }, [pendingData, selectedAction]);

  const getEstimatedTotal = (item: {
    valorEstimadoTotal?: string | number | null;
    valorEstimado: string | number;
    quantidade: number | null | undefined;
  }) => {
    const totalFromApi =
      item.valorEstimadoTotal !== undefined && item.valorEstimadoTotal !== null
        ? Number(item.valorEstimadoTotal)
        : NaN;

    if (Number.isFinite(totalFromApi) && totalFromApi > 0) {
      return totalFromApi;
    }

    return calculateEstimatedTotal({
      valorEstimadoUnitario: item.valorEstimado,
      quantidade: item.quantidade,
    });
  };

  const [comentario, setComentario] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<string>('_empty');
  const [parcelas, setParcelas] = useState('1');
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const { mutate: updateStatus, isPending } = useMutationUpdateStatus();

  const resetDialog = () => {
    setSelectedAction(null);
    setComentario('');
    setMetodoPagamento('_empty');
    setParcelas('1');
  };

  const isCardPayment = isCardPaymentMethod(
    metodoPagamento === '_empty' ? null : metodoPagamento
  );

  const executeStatusUpdate = (statusNovo: string) => {
    if (!selectedAction || !user || !currentFlow) return;

    updateStatus(
      {
        solicitacaoId: Number(selectedAction.id),
        statusNovo: statusNovo as any,
        comentario: comentario.trim() || undefined,
        metodoPagamento:
          selectedAction.type === 'approve' && currentFlow.requiresPaymentDetails
            ? (metodoPagamento as any)
            : undefined,
        parcelas:
          selectedAction.type === 'approve' &&
          currentFlow.requiresPaymentDetails &&
          isCardPayment
            ? Number(parcelas)
            : undefined,
      },
      {
        onSuccess: () => {
          const actionType = selectedAction.type;
          setRejectConfirmOpen(false);
          resetDialog();
          toastSuccess(
            actionType === 'approve'
              ? 'Solicitação aprovada com sucesso.'
              : 'Solicitação reprovada.'
          );
        },
        onError: () => {
          toastError(
            selectedAction.type === 'approve'
              ? 'Erro ao aprovar. Tente novamente.'
              : 'Erro ao reprovar. Tente novamente.'
          );
        },
      }
    );
  };

  const handleConfirm = () => {
    if (!selectedAction || !user || !currentFlow) return;

    if (selectedAction.type === 'approve') {
      if (currentFlow.requiresPaymentDetails && metodoPagamento === '_empty') {
        toastError('Selecione o método de pagamento para aprovar.');
        return;
      }

      if (
        currentFlow.requiresPaymentDetails &&
        isCardPayment &&
        (!parcelas || Number(parcelas) < 1)
      ) {
        toastError('Selecione o parcelamento para pagamento no cartão.');
        return;
      }

      executeStatusUpdate('aprovado_para_compra');
    } else {
      if (!comentario.trim()) {
        toastError('Informe a justificativa da reprovação.');
        return;
      }

      setRejectConfirmOpen(true);
    }
  };

  const isCommentRequired = selectedAction?.type === 'reject';

  const isConfirmDisabled =
    isPending ||
    (selectedAction?.type === 'approve' &&
      currentFlow?.requiresPaymentDetails &&
      metodoPagamento === '_empty') ||
    (selectedAction?.type === 'approve' &&
      currentFlow?.requiresPaymentDetails &&
      isCardPayment &&
      !parcelas) ||
    (isCommentRequired && !comentario.trim());

  const getDialogContent = () => {
    switch (selectedAction?.type) {
      case 'approve':
        return {
          title: currentFlow?.approveTitle ?? 'Aprovar Solicitação',
          desc:
            currentFlow?.approveDescription ??
            'Confirme a aprovação desta solicitação.',
          confirmText:
            currentFlow?.approveConfirmText ?? 'Confirmar Aprovação',
          confirmVariant: 'primary' as const,
        };
      case 'reject':
        return {
          title: 'Reprovar Solicitação',
          desc: 'Por favor, adicione uma justificativa para a reprovação. (Obrigatório)',
          confirmText: 'Confirmar Reprovação',
          confirmVariant: 'destructive' as const,
        };
      default:
        return null;
    }
  };

  const dialogContent = getDialogContent();

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{currentFlow?.pageTitle ?? 'Aprovações'} - Portal de Compras</title>
      </Helmet>

      <header className={styles.deskHeader}>
        <h1 className={styles.deskTitle}>{currentFlow?.pageTitle ?? 'Aprovações'}</h1>
        <p className={styles.deskSubtitle}>
          {currentFlow?.pageSubtitle ?? 'Analise e processe as solicitações pendentes.'}
        </p>
      </header>

      {currentFlow && (
        <section className={styles.operationalStrip} aria-label="Resumo operacional da fila">
          <div className={styles.stripItem}>
            <span className={styles.stripLabel}>Pendentes</span>
            <strong className={styles.stripValue}>{pendingData.length}</strong>
          </div>

          <div className={styles.stripItem}>
            <span className={styles.stripLabel}>Etapa atual</span>
            <Badge variant={getStatusBadgeVariant(currentFlow.pendingStatus)} size="compact">
              {formatStatus(currentFlow.pendingStatus)}
            </Badge>
          </div>

          <div className={styles.stripItem}>
            <span className={styles.stripLabel}>Sincronização</span>
            <span className={styles.refreshBadge}>
              <RefreshCcw size={14} className={isFetching ? styles.spinning : undefined} />
              {isFetching ? 'Atualizando fila...' : 'Atualização automática'}
            </span>
          </div>
        </section>
      )}

      <section className={styles.queueWorkspace} aria-label="Fila principal de aprovações">
        <div className={styles.queueHeader}>
          <h2 className={styles.queueTitle}>Fila de aprovação</h2>
          {currentFlow ? <span className={styles.queueHeaderMeta}>{pendingData.length} pendente(s)</span> : null}
        </div>

        {isLoading ? (
          <div className={styles.cardsGrid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className={styles.skeletonCard} />
            ))}
          </div>
        ) : !currentFlow ? (
          <div className={styles.queueEmpty}>
            <p className={styles.queueEmptyTitle}>Sem permissão para aprovações</p>
            <p className={styles.queueEmptyText}>Você não possui aprovações disponíveis para processar.</p>
          </div>
        ) : pendingData.length === 0 ? (
          <div className={styles.queueEmpty}>
            <p className={styles.queueEmptyTitle}>Fila sem itens pendentes</p>
            <p className={styles.queueEmptyText}>{currentFlow.emptyStateMessage}</p>
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {pendingData.map((item) => {
              const valorEstimadoTotal = getEstimatedTotal(item);
              const motivoCompra = resolveMotivoCompra(item);

              return (
              <article key={item.id} className={styles.approvalCard}>
                {/* Linha 1: ID · Título [Prioridade] [Status] */}
                <div className={styles.cardHeaderLine}>
                  <div className={styles.cardTitleGroup}>
                    <span className={styles.cardId}>#{item.id} ·</span>
                    <span className={styles.cardTitleText}>{item.titulo}</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <span
                      className={styles.chipBadge}
                      style={PRIORITY_BADGE_INLINE[item.prioridade ?? ''] ?? {}}
                    >
                      {formatPrioridade(item.prioridade)}
                    </span>
                    <span
                      className={styles.chipBadge}
                      style={STATUS_BADGE_INLINE[item.status] ?? {}}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Solicitante · Setor · Empresa · Data */}
                <div className={styles.cardMetaLine}>
                  {[
                    item.solicitanteNome,
                    item.setorNome,
                    formatEmpresa(item.empresa),
                    item.createdAt ? formatDate(item.createdAt) : 'Data não informada',
                  ].filter(Boolean).join(' · ')}
                </div>

                {/* Linha 3: Valor total, Qtd, Unitário */}
                <div className={styles.cardFinancialLine}>
                  <strong className={styles.cardTotalValue}>{formatCurrency(valorEstimadoTotal)}</strong>
                  <span className={styles.cardFinancialSecondary}>
                    Qtd: {item.quantidade ?? 1}{item.unidade ? ` ${item.unidade}` : ''}
                  </span>
                  <span className={styles.cardFinancialSecondary}>
                    {formatCurrency(item.valorEstimado)} unit.
                  </span>
                </div>

                {/* Linha 4: Motivo */}
                {motivoCompra && (
                  <div className={styles.cardMotivoLine}>
                    <span className={styles.cardMotivoLabel}>Motivo</span>
                    <p className={styles.cardMotivoText}>{motivoCompra}</p>
                  </div>
                )}

                {/* Footer */}
                <div className={styles.cardFooter}>
                  <Link to={`/solicitacoes/${item.id}`} className={styles.cardDetailBtn}>
                    <Eye size={14} />
                    Ver detalhes
                  </Link>
                  <div className={styles.cardActionGroup}>
                    <button
                      type="button"
                      className={styles.cardRejectBtn}
                      onClick={() => setSelectedAction({ id: item.id, type: 'reject' })}
                    >
                      Reprovar
                    </button>
                    <button
                      type="button"
                      className={styles.cardApproveBtn}
                      onClick={() => setSelectedAction({ id: item.id, type: 'approve' })}
                    >
                      Aprovar agora
                    </button>
                  </div>
                </div>
              </article>
            )})}
          </div>
        )}
      </section>

      <Dialog
        open={!!selectedAction}
        onOpenChange={(open) => {
          if (!open) resetDialog();
        }}
      >
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>{dialogContent?.title}</DialogTitle>
            <DialogDescription>{dialogContent?.desc}</DialogDescription>
          </DialogHeader>

          <div className={styles.dialogBody}>
            {selectedApproval && (
              <div className={styles.dialogSummary}>
                <div className={styles.dialogSummaryHeader}>
                  <div>
                    <span className={styles.sectionLabel}>Solicitação em análise</span>
                    <p className={styles.dialogSummaryTitle}>{selectedApproval.titulo}</p>
                  </div>

                  <Badge variant={getPrioridadeBadgeVariant(selectedApproval.prioridade)}>
                    {formatPrioridade(selectedApproval.prioridade)}
                  </Badge>
                </div>

                <div className={styles.dialogSummaryGrid}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Valor unitário estimado</span>
                    <span className={styles.infoValue}>
                      {formatCurrency(selectedApproval.valorEstimado)}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Quantidade</span>
                    <span className={styles.infoValue}>
                      {selectedApproval.quantidade}
                      {selectedApproval.unidade ? ` ${selectedApproval.unidade}` : ''}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Valor estimado total</span>
                    <span className={styles.infoValue}>
                      {formatCurrency(getEstimatedTotal(selectedApproval))}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Solicitante</span>
                    <span className={styles.infoValue}>{selectedApproval.solicitanteNome}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Setor</span>
                    <span className={styles.infoValue}>{selectedApproval.setorNome}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Categoria</span>
                    <span className={styles.infoValue}>{selectedApproval.categoriaNome}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedAction?.type === 'approve' && currentFlow?.requiresPaymentDetails && (
              <div className={styles.fieldBlock}>
                <label className={styles.textareaLabel}>Método de pagamento</label>
                <Select
                  value={metodoPagamento}
                  onValueChange={(value) => {
                    setMetodoPagamento(value);
                    if (
                      value !== 'cartao_acseg' &&
                      value !== 'cartao_acontrans' &&
                      value !== 'cartao_sp'
                    ) {
                      setParcelas('1');
                    }
                  }}
                >
                  <SelectTrigger className={styles.paymentSelectTrigger}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className={styles.paymentSelectContent}>
                    {METODO_PAGAMENTO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isCardPayment && (
                  <div className={styles.fieldBlock}>
                    <label className={styles.textareaLabel}>Parcelamento</label>
                    <Select value={parcelas} onValueChange={setParcelas}>
                      <SelectTrigger className={styles.paymentSelectTrigger}>
                        <SelectValue placeholder="Selecione as parcelas" />
                      </SelectTrigger>
                      <SelectContent className={styles.paymentSelectContent}>
                        {PARCELAS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className={styles.fieldBlock}>
              <label className={styles.textareaLabel}>
                {isCommentRequired ? 'Comentário (obrigatório)' : 'Comentário (opcional)'}
              </label>

              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Digite aqui o seu comentário..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" className={styles.footerBtnCancel} onClick={resetDialog}>
              Cancelar
            </Button>
            <Button
              variant={dialogContent?.confirmVariant}
              className={dialogContent?.confirmVariant === 'destructive' ? styles.footerBtnDestructive : styles.footerBtnSubmit}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
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
        onConfirm={() => executeStatusUpdate('rejeitado')}
      />
    </div>
  );
}


