import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { getListAndDetailVisibilityFilters } from "../../helpers/solicitacoesDomain";
import { estimatedTotalSql } from "../../helpers/monetarySql";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const url = new URL(request.url);
    const rawInput = {
      status: url.searchParams.get("status") ?? undefined,
      setorId: url.searchParams.get("setorId")
        ? Number(url.searchParams.get("setorId"))
        : undefined,
      solicitanteId: url.searchParams.get("solicitanteId")
        ? Number(url.searchParams.get("solicitanteId"))
        : undefined,
      empresa: url.searchParams.get("empresa") ?? undefined,
      view: url.searchParams.get("view") ?? undefined,
    };

    const input = schema.parse(rawInput);

    let query = db
      .selectFrom("solicitacoes")
      .innerJoin("setores", "solicitacoes.setorId", "setores.id")
      .innerJoin("categorias", "solicitacoes.categoriaId", "categorias.id")
      .innerJoin("users", "solicitacoes.solicitanteId", "users.id")
      .select([
        "solicitacoes.id",
        "solicitacoes.titulo",
        "solicitacoes.descricao",
        "solicitacoes.justificativa",
        "solicitacoes.empresa",
        "solicitacoes.valorEstimado",
        estimatedTotalSql("solicitacoes").as("valorEstimadoTotal"),
        "solicitacoes.valorRealCompra",
        "solicitacoes.valorRealCompraUnitario",
        "solicitacoes.dataCompra",
        "solicitacoes.canalCompra",
        "solicitacoes.observacaoCompra",
        "solicitacoes.quantidade",
        "solicitacoes.unidade",
        "solicitacoes.prioridade",
        "solicitacoes.status",
        "solicitacoes.metodoPagamento",
        "solicitacoes.parcelas",
        "solicitacoes.linkProduto",
        "solicitacoes.createdAt",
        "solicitacoes.setorId",
        "solicitacoes.categoriaId",
        "solicitacoes.solicitanteId",
        "setores.nome as setorNome",
        "categorias.nome as categoriaNome",
        "users.displayName as solicitanteNome",
      ])
      .orderBy("solicitacoes.createdAt", "desc");

    if (input.view === "mine") {
      query = query.where("solicitacoes.solicitanteId", "=", user.id);

      if (input.status) {
        query = query.where("solicitacoes.status", "=", input.status);
      }

      if (input.empresa) {
        query = query.where("solicitacoes.empresa", "=", input.empresa);
      }

      const items = await query.execute();

      return new Response(superjson.stringify(items satisfies OutputType), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const visibilityFilters = getListAndDetailVisibilityFilters(user);

    if (visibilityFilters.isEmptyResult) {
      return new Response(superjson.stringify([] satisfies OutputType), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (typeof visibilityFilters.solicitanteId === "number") {
      query = query.where("solicitacoes.solicitanteId", "=", visibilityFilters.solicitanteId);
    }

    if (typeof visibilityFilters.setorId === "number") {
      query = query.where("solicitacoes.setorId", "=", visibilityFilters.setorId);
    }

    if (visibilityFilters.allowedStatuses?.length) {
      query = query.where("solicitacoes.status", "in", visibilityFilters.allowedStatuses);
    }

    if (typeof visibilityFilters.minValorEstimadoExclusive === "number") {
      query = query.where(
        estimatedTotalSql("solicitacoes"),
        ">",
        visibilityFilters.minValorEstimadoExclusive
      );
    }

    if (input.status) {
      query = query.where("solicitacoes.status", "=", input.status);
    }

    if (input.setorId) {
      query = query.where("solicitacoes.setorId", "=", input.setorId);
    }

    if (input.solicitanteId) {
      query = query.where("solicitacoes.solicitanteId", "=", input.solicitanteId);
    }

    if (input.empresa) {
      query = query.where("solicitacoes.empresa", "=", input.empresa);
    }

    const items = await query.execute();

    return new Response(superjson.stringify(items satisfies OutputType), {
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

