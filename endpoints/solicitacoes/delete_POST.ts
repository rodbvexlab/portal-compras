import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema, type OutputType } from "./delete_POST.schema";

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawText = await request.text();
    const json = parseRequestPayload(rawText);
    const input = schema.parse(json);

    const solicitacao = await db
      .selectFrom("solicitacoes")
      .select(["id"])
      .where("id", "=", input.solicitacaoId)
      .executeTakeFirst();

    if (!solicitacao) {
      return new Response(superjson.stringify({ error: "Solicitacao nao encontrada." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await db.transaction().execute(async (trx) => {
      // Tabela legada sem FK (quando existir) para evitar orfandade em ambientes antigos.
      try {
        await sql`
          delete from solicitacao_historico
          where solicitacao_id::text = ${String(input.solicitacaoId)}
        `.execute(trx);
      } catch (legacyTableError: any) {
        if (legacyTableError?.code !== "42P01") {
          throw legacyTableError;
        }
      }

      // Dependencias com FK CASCADE serão removidas automaticamente.
      await trx
        .deleteFrom("solicitacoes")
        .where("id", "=", input.solicitacaoId)
        .executeTakeFirst();
    });

    return new Response(
      superjson.stringify({
        success: true,
        deletedId: input.solicitacaoId,
      } satisfies OutputType),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
