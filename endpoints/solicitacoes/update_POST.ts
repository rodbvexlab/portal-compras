import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

const STATUS_DEVOLVIDO = "devolvido" as const;
const STATUS_REENVIO = "pendente_financeiro" as const;

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function canAdjustReturnedSolicitacao(args: {
  user: {
    id: number;
    role: string;
    setorId?: number | null;
  };
  solicitacao: {
    solicitanteId: number;
    setorId: number;
    status: string;
  };
}) {
  const { user, solicitacao } = args;

  if (user.role === "admin") return true;
  if (solicitacao.status !== STATUS_DEVOLVIDO) return false;
  if (solicitacao.solicitanteId === user.id) return true;

  if (
    user.role === "lider_setor" &&
    user.setorId &&
    solicitacao.setorId === user.setorId
  ) {
    return true;
  }

  return false;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (!user?.id) {
      return new Response(
        superjson.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (user.role === "financeiro") {
      return new Response(
        superjson.stringify({ error: "Perfil financeiro possui acesso somente leitura." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const rawText = await request.text();
    const json = parseRequestPayload(rawText);
    const input = schema.parse(json);

    const solicitacao = await db
      .selectFrom("solicitacoes")
      .select(["id", "status", "solicitanteId", "setorId", "empresa"])
      .where("id", "=", input.solicitacaoId)
      .executeTakeFirst();

    if (!solicitacao) {
      return new Response(
        superjson.stringify({ error: "Solicitação não encontrada" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      !canAdjustReturnedSolicitacao({
        user: {
          id: user.id,
          role: user.role,
          setorId: user.setorId,
        },
        solicitacao,
      })
    ) {
      return new Response(
        superjson.stringify({
          error: "Você não tem permissão para ajustar esta solicitação.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const [setor, categoria] = await Promise.all([
      db
        .selectFrom("setores")
        .select(["id"])
        .where("id", "=", input.setorId)
        .executeTakeFirst(),
      db
        .selectFrom("categorias")
        .select(["id"])
        .where("id", "=", input.categoriaId)
        .executeTakeFirst(),
    ]);

    if (!setor) {
      return new Response(
        superjson.stringify({ error: "Setor inválido" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!categoria) {
      return new Response(
        superjson.stringify({ error: "Categoria inválida" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const titulo = input.titulo.trim();
    const descricao = input.descricao?.trim() ? input.descricao.trim() : null;
    const linkProduto = input.linkProduto?.trim()
      ? input.linkProduto.trim()
      : null;

    const statusFinal =
      input.acao === "reenviar" ? STATUS_REENVIO : STATUS_DEVOLVIDO;

    const comentarioHistorico =
      input.acao === "reenviar"
        ? "Solicitação ajustada e reenviada para aprovação."
        : "Solicitação ajustada após devolução.";

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("solicitacoes")
        .set({
          titulo,
          descricao,
          empresa: input.empresa ?? solicitacao.empresa,
          valorEstimado: input.valorEstimado.toString(),
          quantidade: input.quantidade,
          prioridade: input.prioridade,
          setorId: input.setorId,
          categoriaId: input.categoriaId,
          status: statusFinal,
          linkProduto,
        })
        .where("id", "=", input.solicitacaoId)
        .execute();

      if (input.acao === "reenviar") {
        await sql`
          update solicitacoes
          set
            forma_pagamento = null,
            parcelas = null,
            financeiro_justificativa = null,
            metodo_pagamento = null,
            financeiro_aprovado_por = null,
            financeiro_aprovado_em = null,
            data_prevista_pagamento = null,
            valor_real_compra = null,
            valor_real_compra_unitario = null,
            data_compra = null,
            fornecedor = null,
            canal_compra = null,
            referencia_pedido = null,
            observacao_compra = null
          where id = ${input.solicitacaoId}
        `.execute(trx);
      }

      await trx
        .insertInto("historicoStatus")
        .values({
          solicitacaoId: input.solicitacaoId,
          statusAnterior: solicitacao.status as any,
          statusNovo: statusFinal as any,
          usuarioId: user.id,
          comentario: comentarioHistorico,
        })
        .execute();
    });

    return new Response(
      superjson.stringify({
        success: true,
        id: input.solicitacaoId,
      } satisfies OutputType),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      superjson.stringify({
        error: error?.message || "Erro ao atualizar solicitação",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
