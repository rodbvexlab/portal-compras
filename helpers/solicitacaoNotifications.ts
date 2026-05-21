import { db } from "./db";
import type { JsonValue, SolicitacaoStatus } from "./schema";
import { normalizeSmsNumber, sendSmsEmpresa } from "./smsEmpresa";

type NotifySolicitacaoStatusChangeInput = {
  solicitacaoId: number;
  statusAnterior: SolicitacaoStatus;
  statusNovo: SolicitacaoStatus;
  usuarioId: number;
  comentario?: string | null;
  titulo?: string | null;
};

type NotificationResult =
  | { handled: false; reason: "event_not_enabled" | "log_insert_failed" }
  | { handled: true; status: "sucesso" | "falha"; logId: number };

const EVENTO_SOLICITACAO_DEVOLVIDA = "solicitacao_devolvida";

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeForSingleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildDevolvidoMessage(input: NotifySolicitacaoStatusChangeInput) {
  const titulo = normalizeOptionalText(input.titulo);
  const comentario = normalizeOptionalText(input.comentario);

  const titlePart = titulo ? ` (${truncate(normalizeForSingleLine(titulo), 45)})` : "";
  const base = `Portal Compras: solicitação #${input.solicitacaoId}${titlePart} devolvida para ajuste.`;

  if (!comentario) {
    return truncate(base, 320);
  }

  const reason = ` Motivo: ${truncate(normalizeForSingleLine(comentario), 180)}.`;
  return truncate(`${base}${reason}`, 320);
}

function resolvePilotRecipientNumber() {
  const raw = process.env.SMS_EMPRESA_PILOT_NUMBER?.trim();
  if (!raw) return null;

  const normalized = normalizeSmsNumber(raw);
  return normalized.length > 0 ? normalized : null;
}

function buildReferencia(input: NotifySolicitacaoStatusChangeInput) {
  const timestamp = Date.now();
  return `solicitacao-${input.solicitacaoId}-devolvido-${timestamp}`;
}

async function markNotificationAsFalha(args: {
  id: number;
  erro: string;
  payloadResposta?: JsonValue | null;
  smsEmpresaSituacao?: string | null;
  smsEmpresaCodigo?: string | null;
  smsEmpresaDescricao?: string | null;
  smsEmpresaId?: string | null;
}) {
  await db
    .updateTable("notificacoesSms")
    .set({
      statusEnvio: "falha",
      erro: truncate(args.erro, 1000),
      payloadResposta: args.payloadResposta ?? null,
      smsEmpresaSituacao: args.smsEmpresaSituacao ?? null,
      smsEmpresaCodigo: args.smsEmpresaCodigo ?? null,
      smsEmpresaDescricao: args.smsEmpresaDescricao ?? null,
      smsEmpresaId: args.smsEmpresaId ?? null,
      updatedAt: new Date(),
    })
    .where("id", "=", args.id)
    .execute();
}

export async function notifySolicitacaoStatusChange(
  input: NotifySolicitacaoStatusChangeInput
): Promise<NotificationResult> {
  if (input.statusNovo !== "devolvido") {
    return { handled: false, reason: "event_not_enabled" };
  }

  const destinatarioNumero = resolvePilotRecipientNumber();
  const mensagem = buildDevolvidoMessage(input);
  const referencia = buildReferencia(input);

  const requestPayload: JsonValue = {
    type: "9",
    number: destinatarioNumero,
    msg: mensagem,
    refer: referencia,
    out: process.env.SMS_EMPRESA_DEFAULT_OUT?.trim() || "json",
  };

  const inserted = await db
    .insertInto("notificacoesSms")
    .values({
      evento: EVENTO_SOLICITACAO_DEVOLVIDA,
      statusEnvio: "tentativa",
      solicitacaoId: input.solicitacaoId,
      usuarioId: input.usuarioId,
      destinatarioNumero,
      mensagem,
      referencia,
      payloadRequisicao: requestPayload,
      tentativaEm: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning("id")
    .executeTakeFirst();

  const logId = Number(inserted?.id ?? 0);
  if (!logId) {
    return { handled: false, reason: "log_insert_failed" };
  }

  if (!destinatarioNumero) {
    await markNotificationAsFalha({
      id: logId,
      erro: "destinatario_numero_indisponivel",
    });
    return { handled: true, status: "falha", logId };
  }

  const smsResult = await sendSmsEmpresa({
    number: destinatarioNumero,
    msg: mensagem,
    refer: referencia,
    type: "9",
  });

  if (!smsResult.ok) {
    await markNotificationAsFalha({
      id: logId,
      erro: smsResult.error,
      payloadResposta: smsResult.response ?? null,
      smsEmpresaSituacao:
        smsResult.response?.situacao !== undefined
          ? String(smsResult.response.situacao)
          : null,
      smsEmpresaCodigo:
        smsResult.response?.codigo !== undefined
          ? String(smsResult.response.codigo)
          : null,
      smsEmpresaDescricao:
        smsResult.response?.descricao !== undefined
          ? String(smsResult.response.descricao)
          : null,
      smsEmpresaId:
        smsResult.response?.id !== undefined ? String(smsResult.response.id) : null,
    });
    return { handled: true, status: "falha", logId };
  }

  await db
    .updateTable("notificacoesSms")
    .set({
      statusEnvio: "sucesso",
      smsEmpresaSituacao:
        smsResult.response.situacao !== undefined
          ? String(smsResult.response.situacao)
          : null,
      smsEmpresaCodigo:
        smsResult.response.codigo !== undefined
          ? String(smsResult.response.codigo)
          : null,
      smsEmpresaDescricao:
        smsResult.response.descricao !== undefined
          ? String(smsResult.response.descricao)
          : null,
      smsEmpresaId: smsResult.response.id !== undefined ? String(smsResult.response.id) : null,
      payloadResposta: smsResult.response,
      enviadoEm: new Date(),
      updatedAt: new Date(),
      erro: null,
    })
    .where("id", "=", logId)
    .execute();

  return { handled: true, status: "sucesso", logId };
}
