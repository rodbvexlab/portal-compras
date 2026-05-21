import { jwtVerify, SignJWT } from "jose";

const encoder = new TextEncoder();
const LEGACY_UNDEFINED_SECRET = "undefined";

export const SessionExpirationSeconds = 60 * 60 * 24 * 7; // 1 week
// Probability to run cleanup (10%)
export const CleanupProbability = 0.1;

// Only send the ID in the cookie to the client
// We should store id -> user id and user data mapping in our database for max security
export interface Session {
  // this should be a crypto random string
  id: string;
  createdAt: number;
  lastAccessed: number;

  // Whether the user needs to change their password
  // Useful for password reset or setting up new user with initial password
  passwordChangeRequired?: boolean;
}

const CookieName = "floot_built_app_session";
const IsProduction = process.env.NODE_ENV === "production";

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

// Explicit override for internal HTTP environments.
// If COOKIE_SECURE is not defined, keep the previous behavior.
const CookieSecure =
  parseBooleanEnv(process.env.COOKIE_SECURE) ?? IsProduction;

export class NotAuthenticatedError extends Error {
  constructor(message?: string) {
    super(message ?? "Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

function getSigningSecret() {
  return process.env.JWT_SECRET || LEGACY_UNDEFINED_SECRET;
}

function getVerificationSecrets() {
  const primary = getSigningSecret();
  const secrets = [primary];

  // Compatibilidade com sessões emitidas antes do env estar carregado no runtime ESM.
  if (primary !== LEGACY_UNDEFINED_SECRET) {
    secrets.push(LEGACY_UNDEFINED_SECRET);
  }

  return secrets;
}

/**
 * Returns the user session or throw an error. Make sure to handle the error (return a proper request)
 */
export async function getServerSessionOrThrow(
  request: Request
): Promise<Session> {
  // Note: if session is valid, also consider making the cookie rolling by using setSession

  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader
    .split(";")
    .reduce((cookies: Record<string, string>, cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
      return cookies;
    }, {});
  const sessionCookie = cookies[CookieName];

  if (!sessionCookie) {
    throw new NotAuthenticatedError();
  }
  for (const candidateSecret of getVerificationSecrets()) {
    try {
      const { payload } = await jwtVerify(
        sessionCookie,
        encoder.encode(candidateSecret)
      );
      return {
        id: payload.id as string,
        createdAt: payload.createdAt as number,
        lastAccessed: payload.lastAccessed as number,
        passwordChangeRequired: payload.passwordChangeRequired as boolean,
      };
    } catch {
      // Tenta o próximo segredo candidato para manter compatibilidade.
    }
  }

  throw new NotAuthenticatedError();
}

export async function setServerSession(
  response: Response,
  session: Session
): Promise<void> {
  const token = await new SignJWT({
    id: session.id,
    createdAt: session.createdAt,
    lastAccessed: session.lastAccessed,
    passwordChangeRequired: session.passwordChangeRequired,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(encoder.encode(getSigningSecret()));

  const cookieParts = [
    `${CookieName}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SessionExpirationSeconds}`,
  ];

  if (CookieSecure) {
    cookieParts.push("Secure");
  }

  response.headers.set("Set-Cookie", cookieParts.join("; "));
}

export function clearServerSession(response: Response) {
  const cookieParts = [
    `${CookieName}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];

  if (CookieSecure) {
    cookieParts.push("Secure");
  }

  response.headers.set("Set-Cookie", cookieParts.join("; "));
}
