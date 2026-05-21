import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | {
      ok: true;
      messageId: string | null;
      accepted: string[];
      rejected: string[];
      response: string | null;
      request: {
        to: string[];
        subject: string;
      };
    }
  | {
      ok: false;
      error: string;
      message: string;
      request: {
        to: string[];
        subject: string;
      };
    };

type EmailConfig = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  testModeEnabled: boolean;
  testRecipient: string | null;
};

let transporterCache: nodemailer.Transporter | null = null;
let transporterCacheKey: string | null = null;

function toBoolean(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeEmail(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string | null | undefined) {
  const normalized = normalizeEmail(value);
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function getEmailConfig(): EmailConfig {
  const normalizedTestRecipient = normalizeEmail(process.env.EMAIL_TEST_RECIPIENT);
  const testModeEnabled = toBoolean(process.env.EMAIL_TEST_MODE);
  return {
    enabled: toBoolean(process.env.SMTP_ENABLED),
    host: process.env.SMTP_HOST?.trim() ?? "",
    port: toPositiveInteger(process.env.SMTP_PORT, 587),
    secure: toBoolean(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER?.trim() ?? "",
    pass: process.env.SMTP_PASS?.trim() ?? "",
    fromName: process.env.SMTP_FROM_NAME?.trim() || "Portal Compras",
    fromEmail: normalizeEmail(process.env.SMTP_FROM_EMAIL),
    testModeEnabled,
    testRecipient:
      testModeEnabled && isValidEmail(normalizedTestRecipient)
        ? normalizedTestRecipient
        : null,
  };
}

export function resolveEmailTestRecipient() {
  return getEmailConfig().testRecipient;
}

function getTransporter(config: EmailConfig) {
  const cacheKey = [
    config.host,
    config.port,
    config.secure,
    config.user,
    config.fromEmail,
  ].join("|");

  if (transporterCache && transporterCacheKey === cacheKey) {
    return transporterCache;
  }

  transporterCache = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
  transporterCacheKey = cacheKey;

  return transporterCache;
}

function normalizeRecipients(to: string | string[]) {
  const list = Array.isArray(to) ? to : [to];
  const valid: string[] = [];
  const seen = new Set<string>();

  for (const raw of list) {
    const normalized = normalizeEmail(raw);
    if (!isValidEmail(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  return valid;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = getEmailConfig();
  const recipients = normalizeRecipients(input.to);
  const subject = input.subject.trim();

  const request = {
    to: recipients,
    subject,
  };

  if (!config.enabled) {
    return {
      ok: false,
      error: "smtp_disabled",
      message: "SMTP disabled",
      request,
    };
  }

  if (!recipients.length) {
    return {
      ok: false,
      error: "recipient_invalid",
      message: "No valid recipient",
      request,
    };
  }

  if (!config.host) {
    return {
      ok: false,
      error: "smtp_host_missing",
      message: "SMTP host missing",
      request,
    };
  }

  if (!isValidEmail(config.fromEmail)) {
    return {
      ok: false,
      error: "smtp_from_invalid",
      message: "SMTP from email invalid",
      request,
    };
  }

  if (!subject) {
    return {
      ok: false,
      error: "subject_missing",
      message: "Email subject missing",
      request,
    };
  }

  if (!input.text?.trim()) {
    return {
      ok: false,
      error: "body_missing",
      message: "Email body missing",
      request,
    };
  }

  try {
    const transporter = getTransporter(config);
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipients.join(", "),
      subject,
      text: input.text.trim(),
      html: input.html?.trim() || undefined,
    });

    const accepted = (Array.isArray(info.accepted) ? info.accepted : [])
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);
    const rejected = (Array.isArray(info.rejected) ? info.rejected : [])
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean);

    return {
      ok: true,
      messageId: info.messageId ?? null,
      accepted,
      rejected,
      response: info.response ?? null,
      request,
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    const code = err.code ? String(err.code).toLowerCase() : "smtp_send_error";
    return {
      ok: false,
      error: code,
      message: err.message || "SMTP send failed",
      request,
    };
  }
}
