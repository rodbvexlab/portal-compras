import "./loadEnv.js";
import { Hono, type MiddlewareHandler } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { NotAuthenticatedError } from "./helpers/getSetServerSession";
import { getServerUserSession } from "./helpers/getServerUserSession";
import { handle as handleAuthLogout } from "./endpoints/auth/logout_POST";
import { handle as handleAuthSession } from "./endpoints/auth/session_GET";
import { handle as handleAuthLoginWithPassword } from "./endpoints/auth/login_with_password_POST";
import { handle as handleSetoresList } from "./endpoints/setores/list_GET";
import { handle as handleCategoriasList } from "./endpoints/categorias/list_GET";
import { handle as handleSolicitacoesList } from "./endpoints/solicitacoes/list_GET";
import { handle as handleSolicitacoesStats } from "./endpoints/solicitacoes/stats_GET";
import { handle as handleSolicitacoesDetail } from "./endpoints/solicitacoes/detail_GET";
import { handle as handleSolicitacoesCreate } from "./endpoints/solicitacoes/create_POST";
import { handle as handleSolicitacoesCompraDireta } from "./endpoints/solicitacoes/compra-direta_POST";
import { handle as handleSolicitacoesComentario } from "./endpoints/solicitacoes/comentario_POST";
import { handle as handleSolicitacoesAdminAdjust } from "./endpoints/solicitacoes/admin-adjust_POST";
import { handle as handleSolicitacoesUpdate } from "./endpoints/solicitacoes/update_POST";
import { handle as handleSolicitacoesUpdateStatus } from "./endpoints/solicitacoes/update-status_POST";
import { handle as handleSolicitacoesDelete } from "./endpoints/solicitacoes/delete_POST";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join("; ");

function setSecurityHeaders(c: Parameters<MiddlewareHandler>[0]) {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", contentSecurityPolicy);
}

const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  setSecurityHeaders(c);
  await next();

  setSecurityHeaders(c);
};

const app = new Hono();

app.use("*", securityHeadersMiddleware);

type ResponseLike = {
  status: number;
  statusText: string;
  headers: Headers | Record<string, string> | Array<[string, string]>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isResponseLike(value: unknown): value is ResponseLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ResponseLike> & {
    constructor?: { name?: unknown };
  };

  return (
    candidate.constructor?.name === "Response" &&
    typeof candidate.status === "number" &&
    typeof candidate.statusText === "string" &&
    typeof candidate.arrayBuffer === "function" &&
    !!candidate.headers
  );
}

async function coerceToResponse(value: unknown): Promise<Response | null> {
  if (value instanceof Response) {
    return value;
  }

  if (isResponseLike(value)) {
    const body = await value.arrayBuffer();
    return new Response(body, {
      status: value.status,
      statusText: value.statusText,
      headers: value.headers,
    });
  }

  return null;
}

type EndpointHandle = (request: Request) => Promise<Response | unknown>;

async function runEndpoint(c: { req: { raw: Request }; text: (body: string, status: number) => Response }, handle: EndpointHandle) {
  const response = await handle(c.req.raw);
  const normalizedResponse = await coerceToResponse(response);
  if (!normalizedResponse) {
    return c.text(
      "Invalid response format. handle should always return a Response object.",
      500
    );
  }
  return normalizedResponse;
}

const passwordChangeExemptPaths = new Set([
  "/_api/auth/login_with_password",
  "/_api/auth/logout",
  "/_api/auth/session",
  "/_api/auth/change_password",
  "/_api/auth/oauth_authorize",
  "/_api/auth/oauth_callback",
  "/_api/auth/establish_session",
]);

const loginRateLimitWindowMs = 15 * 60 * 1000;
const loginRateLimitCleanupIntervalMs = 5 * 60 * 1000;
const loginRateLimitMaxAttempts = 10;

type LoginRateLimitEntry = {
  count: number;
  windowExpiresAt: number;
};

const loginAttemptsByIp = new Map<string, LoginRateLimitEntry>();

function getLoginRequestIp(c: Parameters<MiddlewareHandler>[0]) {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = c.req.header("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

const loginRateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [ip, entry] of loginAttemptsByIp.entries()) {
    if (entry.windowExpiresAt <= now) {
      loginAttemptsByIp.delete(ip);
    }
  }
}, loginRateLimitCleanupIntervalMs);

loginRateLimitCleanupTimer.unref?.();

const loginRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const now = Date.now();
  const ip = getLoginRequestIp(c);
  const currentEntry = loginAttemptsByIp.get(ip);
  const entry =
    currentEntry && currentEntry.windowExpiresAt > now
      ? currentEntry
      : { count: 0, windowExpiresAt: now + loginRateLimitWindowMs };

  if (entry.count >= loginRateLimitMaxAttempts) {
    return c.json(
      { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
      429
    );
  }

  entry.count += 1;
  loginAttemptsByIp.set(ip, entry);

  return next();
};

app.use("/_api/*", async (c, next) => {
  const path = c.req.path;

  if (passwordChangeExemptPaths.has(path) || path === "/_api/auth/register_with_password") {
    return next();
  }

  try {
    const { mustChangePassword } = await getServerUserSession(c.req.raw);
    if (mustChangePassword) {
      return Response.json(
        {
          error: "Password change required before accessing the system.",
          code: "password_change_required",
        },
        { status: 403 }
      );
    }

    return next();
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      if (error.message === "Account is inactive") {
        return Response.json(
          { error: "Account is inactive. Contact an administrator." },
          { status: 403 }
        );
      }
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    return Response.json({ error: "Authentication check failed" }, { status: 400 });
  }
});

app.post("/_api/auth/logout", async (c) => runEndpoint(c, handleAuthLogout));

app.get("/_api/auth/session", async (c) => runEndpoint(c, handleAuthSession));

app.get("/_api/setores/list", async (c) => runEndpoint(c, handleSetoresList));

app.get("/_api/categorias/list", async (c) => runEndpoint(c, handleCategoriasList));

app.get("/_api/users/list", async (c) => {
  try {
    const { handle } = await import("./endpoints/users/list_GET.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.get("/_api/solicitacoes/list", async (c) => runEndpoint(c, handleSolicitacoesList));

app.get("/_api/solicitacoes/stats", async (c) => runEndpoint(c, handleSolicitacoesStats));

app.get("/_api/relatorios/executivo-pdf", async (c) => {
  try {
    const { handle } = await import("./endpoints/relatorios/executivo-pdf_GET.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.get("/_api/auth/oauth_callback", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/oauth_callback_GET.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.get("/_api/auth/oauth_authorize", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/oauth_authorize_GET.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post("/_api/solicitacoes/create", async (c) => runEndpoint(c, handleSolicitacoesCreate));

app.post("/_api/solicitacoes/compra-direta", async (c) => runEndpoint(c, handleSolicitacoesCompraDireta));

app.post("/_api/solicitacoes/comentario", async (c) => runEndpoint(c, handleSolicitacoesComentario));

app.post(
  "/_api/solicitacoes/admin-adjust",
  async (c) => runEndpoint(c, handleSolicitacoesAdminAdjust)
);

app.post("/_api/users/create", async (c) => {
  try {
    const { handle } = await import("./endpoints/users/create_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post("/_api/users/update", async (c) => {
  try {
    const { handle } = await import("./endpoints/users/update_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post("/_api/users/delete", async (c) => {
  try {
    const { handle } = await import("./endpoints/users/delete_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Error loading endpoint code " + e.message }, 500);
  }
});

app.post("/_api/solicitacoes/update", async (c) => runEndpoint(c, handleSolicitacoesUpdate));

app.post("/_api/solicitacoes/delete", async (c) => runEndpoint(c, handleSolicitacoesDelete));

app.post("/_api/auth/establish_session", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/establish_session_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post("/_api/auth/change_password", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/change_password_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post("/_api/auth/admin_reset_password", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/admin_reset_password_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.post(
  "/_api/auth/login_with_password",
  loginRateLimitMiddleware,
  async (c) => runEndpoint(c, handleAuthLoginWithPassword)
);

app.post("/_api/solicitacoes/update-status", async (c) => runEndpoint(c, handleSolicitacoesUpdateStatus));

app.post("/_api/auth/register_with_password", async (c) => {
  try {
    const { handle } = await import("./endpoints/auth/register_with_password_POST.js");
    const request = c.req.raw;
    const response = await handle(request);

    const normalizedResponse = await coerceToResponse(response);
    if (!normalizedResponse) {
      return c.text(
        "Invalid response format. handle should always return a Response object.",
        500
      );
    }

    return normalizedResponse;
  } catch (e: any) {
    console.error(e);
    return c.text("Error loading endpoint code " + e.message, 500);
  }
});

app.get("/_api/solicitacoes/detail", async (c) => runEndpoint(c, handleSolicitacoesDetail));

if (existsSync("./static")) {
  app.use("/*", serveStatic({ root: "./static" }));
}

if (existsSync("./dist")) {
  app.use("/*", serveStatic({ root: "./dist" }));
}

app.get("/*", async (c, next) => {
  const p = c.req.path;

  if (p.startsWith("/_api")) {
    return next();
  }

  return serveStatic({ path: "./dist/index.html" })(c, next);
});

serve({
  fetch: app.fetch,
  port: 3333,
  hostname: "0.0.0.0",
});

console.log("Running at http://0.0.0.0:3333");


