import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

const schema = z.object({
  solicitacaoId: z.number().int().positive(),
  texto: z.string().trim().min(1).max(2000),
});

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function canCommentOnSolicitacao(args: {
  user: {
    id: number;
    role: string;
    setorId?: number | null;
  };
  solicitacao: {
    solicitanteId: number;
    setorId: number;
  };
}) {
  const { user, solicitacao } = args;

  if (user.role === "admin" || user.role === "diretora_financeiro") {
    return true;
  }

  if (solicitacao.solicitanteId === user.id) {
    return true;
  }

  return Boolean(user.setorId && solicitacao.setorId === user.setorId);
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const userId = Number(user?.id);
    const userSetorId =
      user?.setorId === null || user?.setorId === undefined ? null : Number(user.setorId);

    if (!Number.isFinite(userId)) {
      return new Response(superjson.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawText = await request.text();
    const json = parseRequestPayload(rawText);
    const input = schema.parse(json);

    const solicitacao = await db
      .selectFrom("solicitacoes")
      .select(["id", "solicitanteId", "setorId"])
      .where("id", "=", input.solicitacaoId)
      .executeTakeFirst();

    if (!solicitacao) {
      return new Response(superjson.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      !canCommentOnSolicitacao({
        user: {
          id: userId,
          role: user.role,
          setorId: userSetorId,
        },
        solicitacao: {
          solicitanteId: Number(solicitacao.solicitanteId),
          setorId: Number(solicitacao.setorId),
        },
      })
    ) {
      return new Response(superjson.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const comentario = await db
      .insertInto("comentariosSolicitacao")
      .values({
        solicitacaoId: input.solicitacaoId,
        usuarioId: userId,
        texto: input.texto,
      })
      .returning(["id", "texto", "createdAt"])
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        success: true,
        comentario: {
          id: Number(comentario.id),
          texto: comentario.texto,
          createdAt: comentario.createdAt,
          usuarioNome: user.displayName,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
