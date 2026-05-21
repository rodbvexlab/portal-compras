import { schema, OutputType } from "./stats_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  getStatsVisibilityFilters,
} from "../../helpers/solicitacoesDomain";
import type { SolicitacaoVisibilityFilters } from "../../helpers/solicitacoesDomain";
import type { SolicitacaoStatus } from "../../helpers/schema";
import {
  estimatedTotalSql,
  quantitySql,
  realTotalHybridSql,
} from "../../helpers/monetarySql";

const EXECUTIVE_COMPLETED_STATUSES: SolicitacaoStatus[] = ["comprado", "concluido"];

type ExecutivePeriod = {
  start: Date;
  endExclusive: Date;
  startDate: string;
  endDate: string;
  preset: "current_month" | "custom";
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function getExecutivePeriod(input: { startDate?: string; endDate?: string }): ExecutivePeriod {
  if (input.startDate && input.endDate) {
    const start = startOfDayUtc(new Date(`${input.startDate}T00:00:00.000Z`));
    const endInclusive = startOfDayUtc(new Date(`${input.endDate}T00:00:00.000Z`));

    return {
      start,
      endExclusive: addDaysUtc(endInclusive, 1),
      startDate: toIsoDate(start),
      endDate: toIsoDate(endInclusive),
      preset: "custom",
    };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const endInclusive = addDaysUtc(endExclusive, -1);

  return {
    start,
    endExclusive,
    startDate: toIsoDate(start),
    endDate: toIsoDate(endInclusive),
    preset: "current_month",
  };
}

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const parsedInput = schema.safeParse({
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      setorId: url.searchParams.get("setorId")
        ? Number(url.searchParams.get("setorId"))
        : undefined,
      empresa: url.searchParams.get("empresa") ?? undefined,
      metodoPagamento: url.searchParams.get("metodoPagamento") ?? undefined,
      canalCompra: url.searchParams.get("canalCompra") ?? undefined,
    });

    if (!parsedInput.success) {
      return new Response(
        superjson.stringify({ error: "Parâmetros de período inválidos." }),
        { status: 400 }
      );
    }

    const executivePeriod = getExecutivePeriod(parsedInput.data);
    const { user } = await getServerUserSession(request);
    const visibilityFilters = getStatsVisibilityFilters(user);

    if (visibilityFilters.isEmptyResult) {
      return new Response(
        superjson.stringify({
          total: 0,
          byStatus: {},
          byPriority: {},
          recent: [],
          executive: {
            period: {
              startDate: executivePeriod.startDate,
              endDate: executivePeriod.endDate,
              preset: executivePeriod.preset,
            },
            totalGasto: 0,
            totalItensComprados: 0,
            totalComprasConcluidas: 0,
            ticketMedio: 0,
            totalEstimado: 0,
            totalRealizado: 0,
            estimadoVsRealizadoPercentual: null,
            gastosPorSetor: [],
            gastosPorMetodoPagamento: [],
          },
        } satisfies OutputType)
      );
    }

    // Build the base query with role-based visibility filters
    let baseQuery = db.selectFrom("solicitacoes");

    baseQuery = applyVisibilityFilters(baseQuery, visibilityFilters);

    function applyVisibilityFilters<TQuery>(query: TQuery, filters: SolicitacaoVisibilityFilters) {
      let next = query as any;

      if (typeof filters.solicitanteId === "number") {
        next = next.where("solicitacoes.solicitanteId", "=", filters.solicitanteId);
      }

      if (typeof filters.setorId === "number") {
        next = next.where("solicitacoes.setorId", "=", filters.setorId);
      }

      if (filters.allowedStatuses?.length === 1) {
        next = next.where("solicitacoes.status", "=", filters.allowedStatuses[0]);
      } else if (filters.allowedStatuses?.length) {
        next = next.where("solicitacoes.status", "in", filters.allowedStatuses);
      }

      if (typeof filters.minValorEstimadoExclusive === "number") {
        next = next.where(
          estimatedTotalSql("solicitacoes"),
          ">",
          filters.minValorEstimadoExclusive
        );
      }

      return next as TQuery;
    }

    const [totalRes, statusRes, priorityRes] = await Promise.all([
      baseQuery.select((eb) => eb.fn.count<number>("id").as("count")).executeTakeFirst(),
      baseQuery
        .select(["status", (eb) => eb.fn.count<number>("id").as("count")])
        .groupBy("status")
        .execute(),
      baseQuery
        .select(["prioridade", (eb) => eb.fn.count<number>("id").as("count")])
        .groupBy("prioridade")
        .execute(),
    ]);

    let completedPurchasesBaseQuery = applyVisibilityFilters(
      db.selectFrom("solicitacoes"),
      visibilityFilters
    )
      .where("solicitacoes.status", "in", EXECUTIVE_COMPLETED_STATUSES)
      .where("solicitacoes.dataCompra", ">=", executivePeriod.start)
      .where("solicitacoes.dataCompra", "<", executivePeriod.endExclusive)
      .where((eb) =>
        eb.or([
          eb("solicitacoes.valorRealCompra", "is not", null),
          eb("solicitacoes.valorRealCompraUnitario", "is not", null),
        ])
      );

    if (typeof parsedInput.data.setorId === "number") {
      completedPurchasesBaseQuery = completedPurchasesBaseQuery.where(
        "solicitacoes.setorId",
        "=",
        parsedInput.data.setorId
      );
    }

    if (parsedInput.data.empresa) {
      completedPurchasesBaseQuery = completedPurchasesBaseQuery.where(
        "solicitacoes.empresa",
        "=",
        parsedInput.data.empresa
      );
    }

    if (parsedInput.data.metodoPagamento) {
      completedPurchasesBaseQuery = completedPurchasesBaseQuery.where(
        "solicitacoes.metodoPagamento",
        "=",
        parsedInput.data.metodoPagamento
      );
    }

    if (parsedInput.data.canalCompra) {
      completedPurchasesBaseQuery = completedPurchasesBaseQuery.where(
        db.fn("lower", [db.dynamic.ref("solicitacoes.canalCompra")]),
        "=",
        parsedInput.data.canalCompra.toLowerCase()
      );
    }

    const [executiveTotals, gastosPorSetorRows, gastosPorMetodoRows] = await Promise.all([
      completedPurchasesBaseQuery
        .select([
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(estimatedTotalSql("solicitacoes")), eb.val(0))
              .as("totalEstimado"),
          (eb) => eb.fn.count<number>("solicitacoes.id").as("comprasConcluidas"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("totalItensComprados"),
        ])
        .executeTakeFirst(),
      completedPurchasesBaseQuery
        .innerJoin("setores", "solicitacoes.setorId", "setores.id")
        .select([
          "setores.nome as setorNome",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy(["setores.id", "setores.nome"])
        .execute(),
      completedPurchasesBaseQuery
        .select([
          "solicitacoes.metodoPagamento as metodoPagamento",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy("solicitacoes.metodoPagamento")
        .execute(),
    ]);

    // Build recent query with the same role-based filters
    let recentQuery = db
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
        "solicitacoes.valorRealCompra",
        "solicitacoes.valorRealCompraUnitario",
        estimatedTotalSql("solicitacoes").as("valorEstimadoTotal"),
        realTotalHybridSql("solicitacoes").as("valorRealTotal"),
        "solicitacoes.dataCompra",
        "solicitacoes.fornecedor",
        "solicitacoes.canalCompra",
        "solicitacoes.metodoPagamento",
        "solicitacoes.quantidade",
        "solicitacoes.unidade",
        "solicitacoes.prioridade",
        "solicitacoes.status",
        "solicitacoes.createdAt",
        "solicitacoes.setorId",
        "solicitacoes.categoriaId",
        "solicitacoes.solicitanteId",
        "setores.nome as setorNome",
        "categorias.nome as categoriaNome",
        "users.displayName as solicitanteNome",
      ])
      .orderBy("solicitacoes.createdAt", "desc")
      .limit(5);

    recentQuery = applyVisibilityFilters(recentQuery, visibilityFilters);

    if (typeof parsedInput.data.setorId === "number") {
      recentQuery = recentQuery.where("solicitacoes.setorId", "=", parsedInput.data.setorId);
    }

    if (parsedInput.data.empresa) {
      recentQuery = recentQuery.where("solicitacoes.empresa", "=", parsedInput.data.empresa);
    }

    if (parsedInput.data.metodoPagamento) {
      recentQuery = recentQuery.where(
        "solicitacoes.metodoPagamento",
        "=",
        parsedInput.data.metodoPagamento
      );
    }

    if (parsedInput.data.canalCompra) {
      recentQuery = recentQuery.where(
        db.fn("lower", [db.dynamic.ref("solicitacoes.canalCompra")]),
        "=",
        parsedInput.data.canalCompra.toLowerCase()
      );
    }

    const recentRaw = await recentQuery.execute();
    const recent = recentRaw.map((item) => ({
      ...item,
      valorEstimadoTotal: Number(item.valorEstimadoTotal ?? 0),
      valorRealTotal: Number(item.valorRealTotal ?? 0),
    }));

    const byStatus: Record<string, number> = {};
    for (const row of statusRes) {
      byStatus[row.status] = Number(row.count);
    }

    const byPriority: Record<string, number> = {};
    for (const row of priorityRes) {
      byPriority[row.prioridade] = Number(row.count);
    }

    const totalRealizado = Number(executiveTotals?.totalRealizado ?? 0);
    const totalEstimado = Number(executiveTotals?.totalEstimado ?? 0);
    const totalComprasConcluidas = Number(executiveTotals?.comprasConcluidas ?? 0);
    const totalItensComprados = Number(executiveTotals?.totalItensComprados ?? 0);
    const ticketMedio =
      totalComprasConcluidas > 0 ? totalRealizado / totalComprasConcluidas : 0;

    const gastosPorSetor = gastosPorSetorRows
      .map((row) => ({
        setorNome: row.setorNome,
        totalRealizado: Number(row.totalRealizado ?? 0),
        quantidade: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.totalRealizado - a.totalRealizado);

    const gastosPorMetodoPagamento = gastosPorMetodoRows
      .map((row) => ({
        metodoPagamento: row.metodoPagamento ?? "nao_informado",
        totalRealizado: Number(row.totalRealizado ?? 0),
        quantidade: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.totalRealizado - a.totalRealizado);

    return new Response(
      superjson.stringify({
        total: Number(totalRes?.count ?? 0),
        byStatus,
        byPriority,
        recent,
        executive: {
          period: {
            startDate: executivePeriod.startDate,
            endDate: executivePeriod.endDate,
            preset: executivePeriod.preset,
          },
          totalGasto: totalRealizado,
          totalItensComprados,
          totalComprasConcluidas,
          ticketMedio,
          totalEstimado,
          totalRealizado,
          estimadoVsRealizadoPercentual:
            totalEstimado > 0 ? (totalRealizado / totalEstimado) * 100 : null,
          gastosPorSetor,
          gastosPorMetodoPagamento,
        },
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}
