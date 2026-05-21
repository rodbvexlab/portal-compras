import { db } from "./db";
import {
  isValidEmail,
  normalizeEmail,
  resolveEmailTestRecipient,
  sendEmail,
} from "./email";
import { calculateEstimatedTotal, normalizeQuantity, toFiniteNumber } from "./monetary";
import type { JsonValue, SolicitacaoStatus, UserRole } from "./schema";
import { SOLICITACAO_STATUS_LABELS } from "./solicitacoesDomain";

type EmailNotificationEvent =
  | "solicitacao_criada"
  | "solicitacao_pendente_diretoria"
  | "solicitacao_aprovada_para_compra"
  | "solicitacao_em_compra"
  | "solicitacao_comprada"
  | "solicitacao_concluida"
  | "solicitacao_devolvida"
  | "solicitacao_rejeitada";

type NotifySolicitacaoCreatedEmailInput = {
  solicitacaoId: number;
  usuarioId: number;
};

type NotifySolicitacaoStatusEmailChangeInput = {
  solicitacaoId: number;
  statusAnterior: SolicitacaoStatus;
  statusNovo: SolicitacaoStatus;
  usuarioId: number;
  comentario?: string | null;
};

type NotificationResult =
  | {
      handled: false;
      reason:
        | "event_not_enabled"
        | "solicitacao_not_found"
        | "same_status_no_transition";
    }
  | {
      handled: true;
      event: EmailNotificationEvent;
      successCount: number;
      failureCount: number;
    };

type SolicitacaoContext = {
  id: number;
  titulo: string;
  quantidade: number;
  valorEstimadoUnitario: string | number;
  statusAtual: SolicitacaoStatus;
  solicitanteId: number;
  solicitanteNome: string;
  solicitanteEmail: string | null;
  solicitanteAtivo: boolean;
  setorNome: string;
};

type RecipientCandidate = {
  userId: number | null;
  email: string | null;
  source: string;
};

type RecipientPolicy = {
  roles?: UserRole[];
  includeRequester?: boolean;
};

const RECIPIENT_POLICY_BY_EVENT: Partial<
  Record<EmailNotificationEvent, RecipientPolicy>
> = {
  solicitacao_criada: {
    roles: ["admin", "diretora_financeiro"],
    includeRequester: true,
  },
  solicitacao_pendente_diretoria: {
    roles: ["diretora_empresa"],
  },
  solicitacao_aprovada_para_compra: {
    roles: ["admin", "ti"],
    includeRequester: true,
  },
  solicitacao_comprada: {
    includeRequester: true,
  },
  solicitacao_concluida: {
    includeRequester: true,
  },
  solicitacao_devolvida: {
    includeRequester: true,
  },
  solicitacao_rejeitada: {
    includeRequester: true,
  },
};

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatCurrencyBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildSolicitacaoLink(solicitacaoId: number) {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, "")}/solicitacoes/${solicitacaoId}`;
}

async function loadSolicitacaoContext(solicitacaoId: number): Promise<SolicitacaoContext | null> {
  const row = await db
    .selectFrom("solicitacoes as s")
    .innerJoin("users as solicitante", "solicitante.id", "s.solicitanteId")
    .innerJoin("setores as setor", "setor.id", "s.setorId")
    .select([
      "s.id as id",
      "s.titulo as titulo",
      "s.quantidade as quantidade",
      "s.valorEstimado as valorEstimadoUnitario",
      "s.status as statusAtual",
      "solicitante.id as solicitanteId",
      "solicitante.displayName as solicitanteNome",
      "solicitante.email as solicitanteEmail",
      "solicitante.isActive as solicitanteAtivo",
      "setor.nome as setorNome",
    ])
    .where("s.id", "=", solicitacaoId)
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: Number(row.id),
    titulo: String(row.titulo ?? ""),
    quantidade: normalizeQuantity(Number(row.quantidade ?? 1)),
    valorEstimadoUnitario: row.valorEstimadoUnitario,
    statusAtual: row.statusAtual as SolicitacaoStatus,
    solicitanteId: Number(row.solicitanteId),
    solicitanteNome: String(row.solicitanteNome ?? "Solicitante"),
    solicitanteEmail: row.solicitanteEmail ? String(row.solicitanteEmail) : null,
    solicitanteAtivo: Boolean(row.solicitanteAtivo),
    setorNome: String(row.setorNome ?? "Nao informado"),
  };
}

function buildSubject(event: EmailNotificationEvent, solicitacao: SolicitacaoContext) {
  const idPart = `#${solicitacao.id}`;

  if (event === "solicitacao_criada") {
    return `[Portal Compras] Nova solicitacao ${idPart} pendente de aprovacao financeira`;
  }

  if (event === "solicitacao_pendente_diretoria") {
    return `[Portal Compras] Solicitacao ${idPart} enviada para diretoria`;
  }

  if (event === "solicitacao_aprovada_para_compra") {
    return `[Portal Compras] Solicitacao ${idPart} aprovada para compra`;
  }

  if (event === "solicitacao_em_compra") {
    return `[Portal Compras] Solicitacao ${idPart} em compra`;
  }

  if (event === "solicitacao_comprada") {
    return `[Portal Compras] Solicitacao ${idPart} comprada`;
  }

  if (event === "solicitacao_concluida") {
    return `[Portal Compras] Solicitacao ${idPart} concluida`;
  }

  if (event === "solicitacao_devolvida") {
    return `[Portal Compras] Solicitacao ${idPart} devolvida para ajuste`;
  }

  return `[Portal Compras] Solicitacao ${idPart} rejeitada`;
}

function buildBody(args: {
  event: EmailNotificationEvent;
  solicitacao: SolicitacaoContext;
  comentario?: string | null;
}) {
  const valorUnitario = toFiniteNumber(args.solicitacao.valorEstimadoUnitario, 0);
  const valorTotal = calculateEstimatedTotal({
    valorEstimadoUnitario: valorUnitario,
    quantidade: args.solicitacao.quantidade,
  });
  const statusLabel =
    SOLICITACAO_STATUS_LABELS[args.solicitacao.statusAtual] ?? args.solicitacao.statusAtual;
  const link = buildSolicitacaoLink(args.solicitacao.id);
  const comentario = normalizeOptionalText(args.comentario);

  const lines = [
    "Portal Interno de Requisicao de Compras",
    "",
    "Resumo da solicitacao:",
    `- ID: ${args.solicitacao.id}`,
    `- Titulo: ${args.solicitacao.titulo}`,
    `- Solicitante: ${args.solicitacao.solicitanteNome}`,
    `- Setor: ${args.solicitacao.setorNome}`,
    `- Quantidade: ${args.solicitacao.quantidade}`,
    `- Valor unitario estimado: ${formatCurrencyBrl(valorUnitario)}`,
    `- Valor total estimado: ${formatCurrencyBrl(valorTotal)}`,
    `- Status atual: ${statusLabel}`,
  ];

  if (comentario && (args.event === "solicitacao_devolvida" || args.event === "solicitacao_rejeitada")) {
    lines.push(`- Justificativa: ${comentario}`);
  }

  if (args.event === "solicitacao_concluida") {
    lines.push("");
    lines.push(
      "A compra foi concluida e o item esta disponivel para retirada, quando aplicavel."
    );
  }

  if (link) {
    lines.push("");
    lines.push(`Acesse: ${link}`);
  }

  lines.push("");
  lines.push("Mensagem automatica do Portal de Compras.");

  return lines.join("\n");
}

async function loadRecipientsForRoles(roles: UserRole[]) {
  if (!roles.length) return [];

  const rows = await db
    .selectFrom("users")
    .select(["id", "email"])
    .where("isActive", "=", true)
    .where("role", "in", roles as UserRole[])
    .execute();

  return rows.map((row) => ({
    userId: Number(row.id),
    email: row.email ? String(row.email) : null,
    source: "role_target",
  }));
}

function resolveStatusEvent(statusNovo: SolicitacaoStatus): EmailNotificationEvent | null {
  if (statusNovo === "pendente_diretoria") return "solicitacao_pendente_diretoria";
  if (statusNovo === "aprovado_para_compra") return "solicitacao_aprovada_para_compra";
  if (statusNovo === "comprado") return "solicitacao_comprada";
  if (statusNovo === "concluido") return "solicitacao_concluida";
  if (statusNovo === "devolvido") return "solicitacao_devolvida";
  if (statusNovo === "rejeitado") return "solicitacao_rejeitada";
  return null;
}

async function insertFailureLog(args: {
  solicitacaoId: number;
  event: EmailNotificationEvent;
  destinatario?: string | null;
  assunto: string;
  mensagemErro: string;
  payloadResumo: JsonValue;
}) {
  await db
    .insertInto("notificacoesEmail")
    .values({
      solicitacaoId: args.solicitacaoId,
      evento: args.event,
      destinatario: args.destinatario ?? null,
      assunto: args.assunto,
      statusEnvio: "falha",
      mensagemErro: truncate(args.mensagemErro, 1000),
      payloadResumo: args.payloadResumo,
      createdAt: new Date(),
      sentAt: null,
    })
    .execute();
}

async function dispatchEmailNotification(args: {
  event: EmailNotificationEvent;
  solicitacaoId: number;
  usuarioId: number;
  comentario?: string | null;
}): Promise<NotificationResult> {
  const solicitacao = await loadSolicitacaoContext(args.solicitacaoId);
  if (!solicitacao) {
    return { handled: false, reason: "solicitacao_not_found" };
  }

  const subject = buildSubject(args.event, solicitacao);
  const body = buildBody({
    event: args.event,
    solicitacao,
    comentario: args.comentario,
  });

  let candidates: RecipientCandidate[] = [];

  const recipientPolicy = RECIPIENT_POLICY_BY_EVENT[args.event];
  const roleTargets = recipientPolicy?.roles ?? [];

  if (roleTargets.length > 0) {
    const roleCandidates = await loadRecipientsForRoles(roleTargets);
    candidates.push(...roleCandidates);
  }

  if (recipientPolicy?.includeRequester) {
    candidates.push({
      userId: solicitacao.solicitanteId,
      email: solicitacao.solicitanteAtivo ? solicitacao.solicitanteEmail : null,
      source: solicitacao.solicitanteAtivo ? "solicitante" : "solicitante_inativo",
    });
  }

  const testRecipient = resolveEmailTestRecipient();
  const originalRecipientEmails = candidates
    .map((candidate) => normalizeEmail(candidate.email))
    .filter(Boolean);

  if (testRecipient) {
    candidates = [
      {
        userId: null,
        email: testRecipient,
        source: "email_test_recipient",
      },
    ];
  }

  if (!candidates.length) {
    await insertFailureLog({
      solicitacaoId: solicitacao.id,
      event: args.event,
      destinatario: null,
      assunto: subject,
      mensagemErro: "nenhum_destinatario_elegivel",
      payloadResumo: {
        source: "dispatchEmailNotification",
        originalRecipientEmails,
      },
    });

    return {
      handled: true,
      event: args.event,
      successCount: 0,
      failureCount: 1,
    };
  }

  let successCount = 0;
  let failureCount = 0;
  const recipientDedup = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate.email);
    const payloadBase: JsonValue = {
      source: "dispatchEmailNotification",
      usuarioId: args.usuarioId,
      candidateSource: candidate.source,
      originalRecipientEmails,
      testRecipientApplied: Boolean(testRecipient),
    };

    if (!isValidEmail(normalized)) {
      await insertFailureLog({
        solicitacaoId: solicitacao.id,
        event: args.event,
        destinatario: normalized || null,
        assunto: subject,
        mensagemErro: "destinatario_email_invalido_ou_ausente",
        payloadResumo: payloadBase,
      });
      failureCount += 1;
      continue;
    }

    if (recipientDedup.has(normalized)) {
      continue;
    }
    recipientDedup.add(normalized);

    const inserted = await db
      .insertInto("notificacoesEmail")
      .values({
        solicitacaoId: solicitacao.id,
        evento: args.event,
        destinatario: normalized,
        assunto: subject,
        statusEnvio: "tentativa",
        mensagemErro: null,
        payloadResumo: payloadBase,
        createdAt: new Date(),
        sentAt: null,
      })
      .returning("id")
      .executeTakeFirst();

    const logId = Number(inserted?.id ?? 0);
    if (!logId) {
      failureCount += 1;
      continue;
    }

    const sendResult = await sendEmail({
      to: normalized,
      subject,
      text: body,
    });

    if (!sendResult.ok) {
      await db
        .updateTable("notificacoesEmail")
        .set({
          statusEnvio: "falha",
          mensagemErro: truncate(`${sendResult.error}: ${sendResult.message}`, 1000),
          payloadResumo: {
            ...((payloadBase as Record<string, JsonValue>) ?? {}),
            request: sendResult.request,
          },
          sentAt: null,
        })
        .where("id", "=", logId)
        .execute();
      failureCount += 1;
      continue;
    }

    await db
      .updateTable("notificacoesEmail")
      .set({
        statusEnvio: "sucesso",
        mensagemErro: null,
        payloadResumo: {
          ...((payloadBase as Record<string, JsonValue>) ?? {}),
          request: sendResult.request,
          response: {
            messageId: sendResult.messageId,
            accepted: sendResult.accepted,
            rejected: sendResult.rejected,
            response: sendResult.response,
          },
        },
        sentAt: new Date(),
      })
      .where("id", "=", logId)
      .execute();
    successCount += 1;
  }

  return {
    handled: true,
    event: args.event,
    successCount,
    failureCount,
  };
}

export async function notifySolicitacaoCreatedEmail(
  input: NotifySolicitacaoCreatedEmailInput
): Promise<NotificationResult> {
  return dispatchEmailNotification({
    event: "solicitacao_criada",
    solicitacaoId: input.solicitacaoId,
    usuarioId: input.usuarioId,
  });
}

export async function notifySolicitacaoStatusEmailChange(
  input: NotifySolicitacaoStatusEmailChangeInput
): Promise<NotificationResult> {
  if (input.statusAnterior === input.statusNovo) {
    return { handled: false, reason: "same_status_no_transition" };
  }

  const event = resolveStatusEvent(input.statusNovo);
  if (!event) {
    return { handled: false, reason: "event_not_enabled" };
  }

  return dispatchEmailNotification({
    event,
    solicitacaoId: input.solicitacaoId,
    usuarioId: input.usuarioId,
    comentario: input.comentario,
  });
}
