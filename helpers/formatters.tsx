import type { SolicitacaoStatus } from "./schema";
import {
  formatCanalCompraLabel,
  formatEmpresaLabel,
  formatMetodoPagamentoLabel,
  SOLICITACAO_STATUS_LABELS,
} from "./solicitacoesDomain";

type BadgeVariant =
  | "primary"
  | "destructive"
  | "outline"
  | "secondary"
  | "success"
  | "warning"
  | "priorityEmergencial"
  | "priorityUrgente"
  | "priorityAlta"
  | "priorityMedia"
  | "priorityBaixa"
  | "statusPendingFinance"
  | "statusPendingBoard"
  | "statusApprovedPurchase"
  | "statusReturnedAdjust"
  | "statusRejected"
  | "statusInPurchase"
  | "statusPurchased"
  | "statusConcluded"
  | "statusCanceled";

const PRIORIDADE_WEIGHT: Record<string, number> = {
  emergencial: 5,
  urgente: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

function toHumanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  const safeValue = Number.isFinite(num) ? num : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
};

export const formatDate = (date: string | Date | null) => {
  if (!date) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
};

export const formatStatus = (status: string) => {
  if (!status) return "-";

  const statusLabel = SOLICITACAO_STATUS_LABELS[status as SolicitacaoStatus];

  return statusLabel || toHumanLabel(status);
};

export const getStatusBadgeVariant = (status: string): BadgeVariant => {
  switch (status) {
    case "pendente_financeiro":
      return "statusPendingFinance";
    case "pendente_diretoria":
      return "statusPendingBoard";
    case "aprovado_para_compra":
      return "statusApprovedPurchase";
    case "devolvido":
      return "statusReturnedAdjust";
    case "em_compra":
      return "statusInPurchase";
    case "comprado":
      return "statusPurchased";
    case "concluido":
      return "statusConcluded";
    case "cancelado":
      return "statusCanceled";

    case "rejeitado":
    case "inviavel_operacional":
      return "statusRejected";
    case "rascunho":
      return "secondary";

    default:
      return "outline";
  }
};

export const formatPrioridade = (prioridade: string) => {
  if (!prioridade) return "-";

  const map: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    urgente: "Urgente",
    emergencial: "Emergencial",
  };

  return map[prioridade] || toHumanLabel(prioridade);
};

export const getPrioridadeBadgeVariant = (
  prioridade: string
): BadgeVariant => {
  switch (prioridade) {
    case "emergencial":
      return "priorityEmergencial";
    case "urgente":
      return "priorityUrgente";
    case "alta":
      return "priorityAlta";
    case "media":
      return "priorityMedia";
    case "baixa":
      return "priorityBaixa";
    default:
      return "outline";
  }
};

export const formatMetodoPagamento = (value: string | null | undefined) => {
  return formatMetodoPagamentoLabel(value);
};

export const formatCanalCompra = (value: string | null | undefined) => {
  return formatCanalCompraLabel(value);
};

export const formatEmpresa = (value: string | null | undefined) => {
  return formatEmpresaLabel(value);
};

export const formatUserRole = (role: string | null | undefined) => {
  if (!role) return "-";

  const map: Record<string, string> = {
    admin: "Administrador",
    user: "Usuário",
    lider_setor: "Líder de Setor",
    diretora_financeiro: "Diretoria Financeira",
    diretora_empresa: "Diretoria",
    financeiro: "Financeiro",
    ti: "TI",
  };

  return map[role] || toHumanLabel(role);
};

export function sortSolicitacoesByPriorityAndDate<
  T extends { prioridade: string; createdAt: string | Date | null }
>(items: T[]) {
  return [...items].sort((a, b) => {
    const prioridadeA = PRIORIDADE_WEIGHT[a.prioridade] ?? 0;
    const prioridadeB = PRIORIDADE_WEIGHT[b.prioridade] ?? 0;

    if (prioridadeA !== prioridadeB) {
      return prioridadeB - prioridadeA;
    }

    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    return dateB - dateA;
  });
}

