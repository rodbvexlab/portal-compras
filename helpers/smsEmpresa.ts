export type SmsEmpresaSendInput = {
  number: string;
  msg: string;
  refer: string;
  type?: string;
  out?: string;
};

export type SmsEmpresaResponse = {
  situacao?: string;
  codigo?: string | number;
  id?: string | number;
  descricao?: string;
  [key: string]: unknown;
};

export type SmsEmpresaSendResult =
  | {
      ok: true;
      httpStatus: number;
      response: SmsEmpresaResponse;
      rawBody: string;
      request: Omit<SmsEmpresaSendInput, "number"> & { number: string };
    }
  | {
      ok: false;
      httpStatus: number | null;
      error: string;
      response: SmsEmpresaResponse | null;
      rawBody: string | null;
      request: Omit<SmsEmpresaSendInput, "number"> & { number: string };
    };

type SmsEmpresaConfig = {
  enabled: boolean;
  key: string;
  baseUrl: string;
  timeoutMs: number;
  defaultOut: string;
};

function toBoolean(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeSmsNumber(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D+/g, "");
}

export function getSmsEmpresaConfig(): SmsEmpresaConfig {
  const baseUrlRaw = process.env.SMS_EMPRESA_BASE_URL?.trim();

  return {
    enabled: toBoolean(process.env.SMS_EMPRESA_ENABLED),
    key: process.env.SMS_EMPRESA_KEY?.trim() ?? "",
    baseUrl: baseUrlRaw && baseUrlRaw.length > 0 ? baseUrlRaw.replace(/\/+$/, "") : "https://api.smsempresa.com.br/v1",
    timeoutMs: toPositiveInteger(process.env.SMS_EMPRESA_TIMEOUT_MS, 10000),
    defaultOut: process.env.SMS_EMPRESA_DEFAULT_OUT?.trim() || "json",
  };
}

function parseSmsEmpresaResponse(rawBody: string): SmsEmpresaResponse | null {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed as SmsEmpresaResponse;
    }
    return null;
  } catch {
    return null;
  }
}

function hasApiError(response: SmsEmpresaResponse | null) {
  if (!response) return false;
  const situacao = String(response.situacao ?? "").toLowerCase();
  return situacao.includes("erro") || situacao.includes("falha") || situacao.includes("negad");
}

export async function sendSmsEmpresa(input: SmsEmpresaSendInput): Promise<SmsEmpresaSendResult> {
  const config = getSmsEmpresaConfig();

  const normalizedNumber = normalizeSmsNumber(input.number);
  const normalizedRequest = {
    number: normalizedNumber,
    msg: input.msg.trim(),
    refer: input.refer.trim(),
    type: input.type ?? "9",
    out: input.out ?? config.defaultOut,
  };

  if (!config.enabled) {
    return {
      ok: false,
      httpStatus: null,
      error: "sms_disabled",
      response: null,
      rawBody: null,
      request: normalizedRequest,
    };
  }

  if (!config.key) {
    return {
      ok: false,
      httpStatus: null,
      error: "sms_key_missing",
      response: null,
      rawBody: null,
      request: normalizedRequest,
    };
  }

  if (!normalizedRequest.number) {
    return {
      ok: false,
      httpStatus: null,
      error: "sms_number_missing",
      response: null,
      rawBody: null,
      request: normalizedRequest,
    };
  }

  if (!normalizedRequest.msg) {
    return {
      ok: false,
      httpStatus: null,
      error: "sms_message_missing",
      response: null,
      rawBody: null,
      request: normalizedRequest,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const body = new URLSearchParams({
      key: config.key,
      type: normalizedRequest.type,
      number: normalizedRequest.number,
      msg: normalizedRequest.msg,
      out: normalizedRequest.out,
      refer: normalizedRequest.refer,
    });

    const response = await fetch(`${config.baseUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const parsed = parseSmsEmpresaResponse(rawBody);

    if (!response.ok) {
      return {
        ok: false,
        httpStatus: response.status,
        error: "sms_http_error",
        response: parsed,
        rawBody,
        request: normalizedRequest,
      };
    }

    if (hasApiError(parsed)) {
      return {
        ok: false,
        httpStatus: response.status,
        error: "sms_api_error",
        response: parsed,
        rawBody,
        request: normalizedRequest,
      };
    }

    return {
      ok: true,
      httpStatus: response.status,
      response: parsed ?? {},
      rawBody,
      request: normalizedRequest,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return {
      ok: false,
      httpStatus: null,
      error: `sms_fetch_error:${message}`,
      response: null,
      rawBody: null,
      request: normalizedRequest,
    };
  } finally {
    clearTimeout(timeout);
  }
}
