import { schema, OutputType } from "./detail_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  canAccessSolicitacaoWithFilters,
  getListAndDetailVisibilityFilters,
} from "../../helpers/solicitacoesDomain";
import { calculateEstimatedTotal } from "../../helpers/monetary";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const url = new URL(request.url);
    const rawId = url.searchParams.get("id");

    if (!rawId) {
      return new Response(
        superjson.stringify({ error: "ID é obrigatório" }),
        { status: 400 }
      );
    }

    const input = schema.parse({ id: Number(rawId) });

    const solicitacao = await db
      .selectFrom("solicitacoes as s")
      .innerJoin("setores as st", "s.setorId", "st.id")
      .innerJoin("categorias as c", "s.categoriaId", "c.id")
      .innerJoin("users as u", "s.solicitanteId", "u.id")
      .where("s.id", "=", input.id)
      .select([
        "s.id",
        "s.titulo",
        "s.descricao",
        "s.justificativa",
        "s.empresa",
        "s.valorEstimado",
        "s.valorRealCompra",
        "s.valorRealCompraUnitario",
        "s.dataCompra",
        "s.fornecedor",
        "s.canalCompra",
        "s.observacaoCompra",
        "s.referenciaPedido",
        "s.quantidade",
        "s.unidade",
        "s.prioridade",
        "s.status",
        "s.createdAt",
        "s.updatedAt",
        "s.setorId",
        "s.categoriaId",
        "s.solicitanteId",
        "s.formaPagamento",
        "s.parcelas",
        "s.linkProduto",
        "s.financeiroJustificativa",
        "s.metodoPagamento",
        "s.financeiroAprovadoPor",
        "s.financeiroAprovadoEm",
        "st.nome as setorNome",
        "c.nome as categoriaNome",
        "u.displayName as solicitanteNome",
        "u.email as solicitanteEmail",
      ])
      .executeTakeFirst();

    if (!solicitacao) {
      return new Response(
        superjson.stringify({ error: "Solicitação não encontrada" }),
        { status: 404 }
      );
    }

    const valorEstimadoTotal = calculateEstimatedTotal({
      valorEstimadoUnitario: solicitacao.valorEstimado,
      quantidade: solicitacao.quantidade,
    });

    const visibilityFilters = getListAndDetailVisibilityFilters(user);
    const hasAccess = canAccessSolicitacaoWithFilters(visibilityFilters, {
      solicitanteId: solicitacao.solicitanteId,
      setorId: solicitacao.setorId,
      status: solicitacao.status,
      valorEstimadoTotal,
    });

    if (!hasAccess) {
      return new Response(
        superjson.stringify({ error: "Acesso negado." }),
        { status: 403 }
      );
    }

    const [aprovacoes, historico, ajustesOperacionais, financeiroAprovador] = await Promise.all([
      db
        .selectFrom("aprovacoes as a")
        .innerJoin("users as u", "a.aprovadorId", "u.id")
        .where("a.solicitacaoId", "=", input.id)
        .select([
          "a.id",
          "a.status",
          "a.comentario",
          "a.createdAt",
          "u.displayName as aprovadorNome",
        ])
        .orderBy("a.createdAt", "asc")
        .execute(),

      db
        .selectFrom("historicoStatus as h")
        .innerJoin("users as u", "h.usuarioId", "u.id")
        .where("h.solicitacaoId", "=", input.id)
        .select([
          "h.id",
          "h.statusAnterior",
          "h.statusNovo",
          "h.comentario",
          "h.createdAt",
          "u.displayName as usuarioNome",
        ])
        .orderBy("h.createdAt", "desc")
        .execute(),

      db
        .selectFrom("solicitacoesAjustesOperacionais as ao")
        .innerJoin("users as u", "ao.usuarioId", "u.id")
        .where("ao.solicitacaoId", "=", input.id)
        .select([
          "ao.id",
          "ao.campo",
          "ao.valorAnterior",
          "ao.valorNovo",
          "ao.justificativa",
          "ao.createdAt",
          "u.displayName as usuarioNome",
        ])
        .orderBy("ao.createdAt", "desc")
        .execute(),

      solicitacao.financeiroAprovadoPor
        ? db
            .selectFrom("users")
            .select(["id", "displayName", "email"])
            .where("id", "=", solicitacao.financeiroAprovadoPor)
            .executeTakeFirst()
        : Promise.resolve(null),
    ]);

    const result = {
      ...solicitacao,
      valorEstimadoTotal,
      financeiroAprovadorNome: financeiroAprovador?.displayName ?? null,
      financeiroAprovadorEmail: financeiroAprovador?.email ?? null,
      aprovacoes,
      historico,
      ajustesOperacionais,
    };

    return new Response(superjson.stringify(result satisfies OutputType), {
      headers: {
        "Content-Type": "application/json",
      },
    });
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

