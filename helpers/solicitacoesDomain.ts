import {
  SolicitacaoStatusArrayValues,
} from "./schema";
import type { Empresa, MetodoPagamento, SolicitacaoStatus } from "./schema";
import type { User } from "./User";
import { calculateEstimatedTotal, type NumericInput } from "./monetary";

export const SOLICITACAO_STATUS_CANONICOS = [...SolicitacaoStatusArrayValues] as const;

export const SOLICITACAO_STATUS_LABELS: Record<SolicitacaoStatus, string> = {
  rascunho: "Rascunho",
  pendente_financeiro: "Pendente Financeiro",
  pendente_diretoria: "Pendente Diretoria",
  aprovado_para_compra: "Aprovado para Compra",
  devolvido: "Devolvido para Ajuste",
  rejeitado: "Rejeitado",
  em_compra: "Em Compra",
  comprado: "Comprado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  inviavel_operacional: "Inviável Operacional",
};

export const SOLICITACAO_STATUS_DISPLAY_ORDER: SolicitacaoStatus[] = [
  "pendente_financeiro",
  "pendente_diretoria",
  "aprovado_para_compra",
  "em_compra",
  "comprado",
  "concluido",
  "devolvido",
  "rejeitado",
  "cancelado",
  "inviavel_operacional",
  "rascunho",
];

export const DIRECTORIA_THRESHOLD = 500;

export type ApprovalFlow = {
  pendingStatus: "pendente_financeiro" | "pendente_diretoria";
  pageTitle: string;
  pageSubtitle: string;
  emptyStateMessage: string;
  successMessage: string;
  requiresPaymentDetails: boolean;
  approveTitle: string;
  approveDescription: string;
  approveConfirmText: string;
};

export const APPROVAL_FLOW_BY_ROLE: Partial<Record<User["role"], ApprovalFlow>> = {
  admin: {
    pendingStatus: "pendente_financeiro",
    pageTitle: "Aprovações Financeiras",
    pageSubtitle: "Analise e processe as solicitações pendentes de aprovação financeira.",
    emptyStateMessage: "Nenhuma aprovação financeira pendente no momento.",
    successMessage: "Fluxo financeiro processado com sucesso.",
    requiresPaymentDetails: true,
    approveTitle: "Aprovar para Compra",
    approveDescription: "Defina o método de pagamento e, se for cartão, escolha o parcelamento.",
    approveConfirmText: "Confirmar Aprovação",
  },
  diretora_financeiro: {
    pendingStatus: "pendente_financeiro",
    pageTitle: "Aprovações Financeiras",
    pageSubtitle: "Analise e processe as solicitações pendentes de aprovação financeira.",
    emptyStateMessage: "Nenhuma aprovação financeira pendente no momento.",
    successMessage: "Fluxo financeiro processado com sucesso.",
    requiresPaymentDetails: true,
    approveTitle: "Aprovar para Compra",
    approveDescription: "Defina o método de pagamento e, se for cartão, escolha o parcelamento.",
    approveConfirmText: "Confirmar Aprovação",
  },
  diretora_empresa: {
    pendingStatus: "pendente_diretoria",
    pageTitle: "Deliberações da Diretoria",
    pageSubtitle: "Analise e delibere sobre as solicitações que exigem aprovação da diretoria.",
    emptyStateMessage: "Nenhuma deliberação pendente no momento.",
    successMessage: "Deliberação da diretoria processada com sucesso.",
    requiresPaymentDetails: false,
    approveTitle: "Aprovar Solicitação",
    approveDescription: "Confirme a aprovação final desta solicitação para seguir no fluxo operacional.",
    approveConfirmText: "Confirmar Deliberação",
  },
};

export type MetodoPagamentoOptionValue = Exclude<
  MetodoPagamento,
  "boleto" | "transferencia" | "cartao" | "outro"
>;

export type CanalCompraOptionValue =
  | "loja_fisica"
  | "mercado_livre"
  | "amazon"
  | "fornecedor_direto"
  | "telefone_whatsapp"
  | "outro";

export type EmpresaOptionValue = Empresa;

export const METODO_PAGAMENTO_OPTIONS: ReadonlyArray<{
  value: MetodoPagamentoOptionValue;
  label: string;
}> = [
  { value: "cartao_acseg", label: "Cartão ACSEG - Final 2985" },
  { value: "cartao_acontrans", label: "Cartão Acontrans - Final 1611" },
  { value: "cartao_sp", label: "Cartão SP - Final 1611" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

export const CANAL_COMPRA_OPTIONS: ReadonlyArray<{
  value: CanalCompraOptionValue;
  label: string;
}> = [
  { value: "loja_fisica", label: "Loja Física" },
  { value: "mercado_livre", label: "Mercado Livre" },
  { value: "amazon", label: "Amazon" },
  { value: "fornecedor_direto", label: "Fornecedor Direto" },
  { value: "telefone_whatsapp", label: "Telefone / WhatsApp" },
  { value: "outro", label: "Outro" },
] as const;

export const EMPRESA_OPTIONS: ReadonlyArray<{
  value: EmpresaOptionValue;
  label: string;
}> = [
  { value: "grupo_acontrans", label: "Grupo Acontrans" },
  { value: "acontrans", label: "Acontrans" },
  { value: "acontrans_sp", label: "Acontrans SP" },
  { value: "acseg", label: "ACSEG" },
] as const;

export const TI_OPERATIONAL_VISIBLE_STATUSES: SolicitacaoStatus[] = [
  "aprovado_para_compra",
  "em_compra",
  "comprado",
  "concluido",
];

export const OPERATIONAL_ADJUSTABLE_STATUSES: SolicitacaoStatus[] = [
  "comprado",
  "concluido",
];

export const ADMIN_OPERATIONAL_ADJUSTABLE_STATUSES: SolicitacaoStatus[] = [
  "aprovado_para_compra",
  "em_compra",
  "comprado",
  "concluido",
];

export const ADMINISTRATIVE_ADJUSTABLE_STATUSES: SolicitacaoStatus[] = [
  "aprovado_para_compra",
  "em_compra",
  "comprado",
  "concluido",
  "devolvido",
];

export const ADMINISTRATIVE_ADJUSTABLE_FIELDS = [
  "titulo",
  "descricao",
  "empresa",
  "setor",
  "categoria",
  "quantidade",
  "valor_estimado_unitario",
  "link_produto",
  "metodo_pagamento",
  "parcelas",
  "valor_real_compra_unitario",
  "data_compra",
  "canal_compra",
  "fornecedor",
  "observacao_compra",
  "referencia_pedido",
] as const;

export const ADMINISTRATIVE_AUDIT_FIELD_LABELS: Record<
  (typeof ADMINISTRATIVE_ADJUSTABLE_FIELDS)[number],
  string
> = {
  titulo: "Título",
  descricao: "Descrição",
  empresa: "Empresa",
  setor: "Setor",
  categoria: "Categoria",
  quantidade: "Quantidade",
  valor_estimado_unitario: "Valor estimado unitário",
  link_produto: "Link do produto",
  metodo_pagamento: "Método de pagamento",
  parcelas: "Parcelas",
  valor_real_compra_unitario: "Valor real unitário",
  data_compra: "Data da compra",
  canal_compra: "Canal / Plataforma",
  fornecedor: "Fornecedor",
  observacao_compra: "Observação da compra",
  referencia_pedido: "Referência do pedido",
};

export const ADMIN_OPERATIONAL_EDITABLE_FIELDS = [
  "titulo",
  "descricao",
  "quantidade",
  "valor_estimado_unitario",
  "valor_estimado_total",
  "valor_real_compra_unitario",
  "valor_real_compra_total",
  "metodo_pagamento",
  "parcelas",
  "fornecedor",
  "canal_compra",
  "data_compra",
  "observacao_compra",
  "link_produto",
] as const;

export function canRunAdminOperationalAdjustment(args: {
  statusAtual: SolicitacaoStatus;
  statusNovo: SolicitacaoStatus;
}) {
  return (
    args.statusAtual === args.statusNovo &&
    ADMIN_OPERATIONAL_ADJUSTABLE_STATUSES.includes(args.statusAtual)
  );
}

export function canRunAdministrativeAdjustment(statusAtual: SolicitacaoStatus) {
  return ADMINISTRATIVE_ADJUSTABLE_STATUSES.includes(statusAtual);
}

export function formatAdministrativeAuditFieldLabel(value: string | null | undefined) {
  if (!value) return "Campo não informado";

  return (
    ADMINISTRATIVE_AUDIT_FIELD_LABELS[
      value as keyof typeof ADMINISTRATIVE_AUDIT_FIELD_LABELS
    ] ?? value.replace(/_/g, " ")
  );
}

export function isCardPaymentMethod(
  metodoPagamento?: string | null
): metodoPagamento is "cartao_acseg" | "cartao_acontrans" | "cartao_sp" {
  return (
    metodoPagamento === "cartao_acseg" ||
    metodoPagamento === "cartao_acontrans" ||
    metodoPagamento === "cartao_sp"
  );
}

export function formatMetodoPagamentoLabel(value: string | null | undefined) {
  if (!value) return "Não informado";

  const map: Record<string, string> = {
    pix: "PIX",
    cartao_acseg: "Cartão ACSEG - Final 2985",
    cartao_acontrans: "Cartão Acontrans - Final 1611",
    cartao_sp: "Cartão SP - Final 1611",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    transferencia: "Transferência",
    cartao: "Cartão",
    outro: "Outro",
  };

  return map[value] ?? value.replace(/_/g, " ");
}

export function normalizeCanalCompra(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const lookup = trimmed.toLowerCase();

  const canonicalMap: Record<string, string> = {
    loja_fisica: "loja_fisica",
    "loja fisica": "loja_fisica",
    mercado_livre: "mercado_livre",
    "mercado livre": "mercado_livre",
    marketplace: "mercado_livre",
    amazon: "amazon",
    fornecedor_direto: "fornecedor_direto",
    "fornecedor direto": "fornecedor_direto",
    telefone_whatsapp: "telefone_whatsapp",
    "telefone / whatsapp": "telefone_whatsapp",
    whatsapp: "telefone_whatsapp",
    outro: "outro",
  };

  return canonicalMap[lookup] ?? trimmed;
}

export function formatCanalCompraLabel(value: string | null | undefined) {
  const normalized = normalizeCanalCompra(value);

  if (!normalized) return "Não informado";

  const map: Record<string, string> = {
    loja_fisica: "Loja Física",
    mercado_livre: "Mercado Livre",
    amazon: "Amazon",
    fornecedor_direto: "Fornecedor Direto",
    telefone_whatsapp: "Telefone / WhatsApp",
    outro: "Outro",
  };

  return map[normalized] ?? normalized.replace(/_/g, " ");
}

export function normalizeEmpresa(
  value?: string | null
): EmpresaOptionValue | null {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const canonicalMap: Record<string, EmpresaOptionValue> = {
    grupo_acontrans: "grupo_acontrans",
    "grupo acontrans": "grupo_acontrans",
    acontrans: "acontrans",
    acontrans_sp: "acontrans_sp",
    "acontrans sp": "acontrans_sp",
    acseg: "acseg",
  };

  return canonicalMap[trimmed] ?? null;
}

export function formatEmpresaLabel(value: string | null | undefined) {
  const normalized = normalizeEmpresa(value);
  if (!normalized) return "Nao informado";

  const map: Record<EmpresaOptionValue, string> = {
    grupo_acontrans: "Grupo Acontrans",
    acontrans: "Acontrans",
    acontrans_sp: "Acontrans SP",
    acseg: "ACSEG",
  };

  return map[normalized];
}

export function isFinancialTransition(
  statusAtual: SolicitacaoStatus,
  finalStatus: SolicitacaoStatus
) {
  return (
    statusAtual === "pendente_financeiro" &&
    (finalStatus === "aprovado_para_compra" ||
      finalStatus === "pendente_diretoria" ||
      finalStatus === "rejeitado")
  );
}

export function isBoardTransition(
  statusAtual: SolicitacaoStatus,
  finalStatus: SolicitacaoStatus
) {
  return (
    statusAtual === "pendente_diretoria" &&
    (finalStatus === "aprovado_para_compra" || finalStatus === "rejeitado")
  );
}

export function isTiCompraTransition(
  statusAtual: SolicitacaoStatus,
  finalStatus: SolicitacaoStatus
) {
  return statusAtual === "em_compra" && finalStatus === "comprado";
}

export function isFinancialApprovalPath(finalStatus: SolicitacaoStatus) {
  return finalStatus === "aprovado_para_compra" || finalStatus === "pendente_diretoria";
}

export function resolveFinanceApprovalStatus(args: {
  valorEstimadoUnitario: NumericInput;
  quantidade: number | null | undefined;
}): SolicitacaoStatus {
  const valorEstimadoTotal = calculateEstimatedTotal({
    valorEstimadoUnitario: args.valorEstimadoUnitario,
    quantidade: args.quantidade,
  });

  return valorEstimadoTotal > DIRECTORIA_THRESHOLD
    ? "pendente_diretoria"
    : "aprovado_para_compra";
}

export const LIST_AND_DETAIL_ALLOWED_STATUSES_BY_ROLE: Partial<
  Record<User["role"], SolicitacaoStatus[]>
> = {
  diretora_financeiro: [
    "pendente_financeiro",
    "pendente_diretoria",
    "aprovado_para_compra",
    "em_compra",
    "comprado",
    "concluido",
    "rejeitado",
    "cancelado",
    "devolvido",
    "inviavel_operacional",
  ],
  diretora_empresa: [
    "pendente_diretoria",
    "aprovado_para_compra",
    "em_compra",
    "comprado",
    "concluido",
    "rejeitado",
    "cancelado",
    "devolvido",
    "inviavel_operacional",
  ],
  ti: [
    "aprovado_para_compra",
    "em_compra",
    "comprado",
    "concluido",
    "devolvido",
    "inviavel_operacional",
  ],
};

export const STATS_ALLOWED_STATUSES_BY_ROLE: Partial<
  Record<User["role"], SolicitacaoStatus[]>
> = {
  diretora_financeiro:
    LIST_AND_DETAIL_ALLOWED_STATUSES_BY_ROLE.diretora_financeiro ?? [
      "pendente_financeiro",
    ],
  diretora_empresa: ["pendente_diretoria"],
  ti: ["aprovado_para_compra", "em_compra", "comprado"],
};

export const UPDATE_STATUS_ALLOWED_NEXT_BY_ROLE: Partial<
  Record<User["role"], SolicitacaoStatus[]>
> = {
  admin: ["aprovado_para_compra", "pendente_diretoria", "rejeitado"],
  diretora_financeiro: ["aprovado_para_compra", "pendente_diretoria", "rejeitado"],
  diretora_empresa: ["aprovado_para_compra", "rejeitado"],
};

export const TI_STATUS_TRANSITIONS: Partial<
  Record<SolicitacaoStatus, SolicitacaoStatus[]>
> = {
  aprovado_para_compra: ["em_compra", "devolvido", "inviavel_operacional"],
  em_compra: ["comprado", "devolvido", "inviavel_operacional"],
  comprado: ["concluido"],
};

export const REQUESTER_CANCEL_ALLOWED_CURRENT_STATUSES: SolicitacaoStatus[] = [
  "pendente_financeiro",
  "devolvido",
];

export type SolicitacaoVisibilityFilters = {
  isEmptyResult?: boolean;
  solicitanteId?: number;
  setorId?: number;
  allowedStatuses?: SolicitacaoStatus[];
  minValorEstimadoExclusive?: number;
};

export function getListAndDetailVisibilityFilters(
  user: Pick<User, "id" | "role" | "setorId">
): SolicitacaoVisibilityFilters {
  if (user.role === "admin") return {};
  if (user.role === "financeiro") return {};

  if (user.role === "user") {
    return { solicitanteId: user.id };
  }

  if (user.role === "lider_setor") {
    if (!user.setorId) {
      return { isEmptyResult: true };
    }

    return { setorId: user.setorId };
  }

  if (user.role === "diretora_empresa") {
    return {
      allowedStatuses: LIST_AND_DETAIL_ALLOWED_STATUSES_BY_ROLE.diretora_empresa,
      minValorEstimadoExclusive: DIRECTORIA_THRESHOLD,
    };
  }

  if (
    user.role === "diretora_financeiro" ||
    user.role === "ti"
  ) {
    return {
      allowedStatuses: LIST_AND_DETAIL_ALLOWED_STATUSES_BY_ROLE[user.role],
    };
  }

  return { isEmptyResult: true };
}

export function getStatsVisibilityFilters(
  user: Pick<User, "id" | "role" | "setorId">
): SolicitacaoVisibilityFilters {
  if (user.role === "admin") return {};
  if (user.role === "financeiro") return {};
  if (user.role === "diretora_financeiro") return {};
  if (user.role === "diretora_empresa") return {};

  if (user.role === "user") {
    return { solicitanteId: user.id };
  }

  if (user.role === "lider_setor") {
    if (!user.setorId) {
      return { isEmptyResult: true };
    }

    return { setorId: user.setorId };
  }

  if (user.role === "ti") {
    return {
      allowedStatuses: STATS_ALLOWED_STATUSES_BY_ROLE[user.role],
    };
  }

  return { isEmptyResult: true };
}

export function canAccessSolicitacaoWithFilters(
  filters: SolicitacaoVisibilityFilters,
  solicitacao: {
    solicitanteId: number;
    setorId: number;
    status: string;
    valorEstimadoTotal: string | number;
  }
) {
  if (filters.isEmptyResult) return false;

  if (
    typeof filters.solicitanteId === "number" &&
    solicitacao.solicitanteId !== filters.solicitanteId
  ) {
    return false;
  }

  if (
    typeof filters.setorId === "number" &&
    solicitacao.setorId !== filters.setorId
  ) {
    return false;
  }

  if (
    filters.allowedStatuses &&
    !filters.allowedStatuses.includes(solicitacao.status as SolicitacaoStatus)
  ) {
    return false;
  }

  if (typeof filters.minValorEstimadoExclusive === "number") {
    const valorEstimado = Number(solicitacao.valorEstimadoTotal);
    if (!Number.isFinite(valorEstimado) || valorEstimado <= filters.minValorEstimadoExclusive) {
      return false;
    }
  }

  return true;
}
