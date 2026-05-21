import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { notifySolicitacaoCreatedEmail } from "../../helpers/solicitacaoEmailNotifications";

const STATUS_INICIAL = "pendente_financeiro" as const;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (!user?.id) {
      return new Response(
        superjson.stringify({ error: "Usuário não autenticado" }),
        { status: 401 }
      );
    }

    if (user.role === "financeiro") {
      return new Response(
        superjson.stringify({ error: "Perfil financeiro possui acesso somente leitura." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rawText = await request.text();
    const json = superjson.parse(rawText);
    const input = schema.parse(json);

    const titulo = input.titulo.trim();
    const descricao = input.descricao?.trim() ? input.descricao.trim() : null;
    const linkProduto = input.linkProduto?.trim()
      ? input.linkProduto.trim()
      : null;

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
        { status: 400 }
      );
    }

    if (!categoria) {
      return new Response(
        superjson.stringify({ error: "Categoria inválida" }),
        { status: 400 }
      );
    }

    const result = await db.transaction().execute(async (trx) => {
      const solicitacao = await trx
        .insertInto("solicitacoes")
        .values({
          titulo,
          descricao,
          empresa: input.empresa,
          valorEstimado: input.valorEstimado.toString(),
          quantidade: input.quantidade,
          prioridade: input.prioridade,
          setorId: input.setorId,
          categoriaId: input.categoriaId,
          solicitanteId: user.id,
          status: STATUS_INICIAL,
          linkProduto,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

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
        where id = ${solicitacao.id}
      `.execute(trx);

      await trx
        .insertInto("historicoStatus")
        .values({
          solicitacaoId: solicitacao.id,
          statusAnterior: null,
          statusNovo: STATUS_INICIAL,
          usuarioId: user.id,
          comentario: "Solicitação criada",
        })
        .execute();

      return solicitacao;
    });

    setImmediate(() => {
      void notifySolicitacaoCreatedEmail({
        solicitacaoId: result.id,
        usuarioId: user.id,
      }).catch((notificationError) => {
        console.error("Email notification error (create):", notificationError);
      });
    });

    return new Response(
      superjson.stringify({ id: result.id } satisfies OutputType),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Erro ao criar solicitação:", error);

    return new Response(
      superjson.stringify({
        error: error?.message || "Erro ao criar solicitação",
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
