import { schema, type ConferenciaOutput, type ConferenciaItem } from "./conferencia_GET.schema";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { estimatedTotalSql, realTotalHybridSql } from "../../helpers/monetarySql";
import { formatMetodoPagamentoLabel, formatCanalCompraLabel } from "../../helpers/solicitacoesDomain";
import { sql } from "kysely";

const CARTAO_INFO: Record<string, { apelido: string; final: string }> = {
  cartao_acseg: { apelido: "Cartao ACSEG", final: "2985" },
  cartao_acontrans: { apelido: "Cartao Acontrans", final: "1611" },
  cartao_sp: { apelido: "Cartao SP", final: "1611" },
};

const ALLOWED_ROLES = ["financeiro", "diretora_financeiro", "admin"] as const;

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return Response.json(
        { error: "Acesso negado. Apenas financeiro, diretoria financeira e admin podem acessar." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const parsed = schema.safeParse({
      metodoPagamento: url.searchParams.get("metodoPagamento") ?? undefined,
      dataInicio: url.searchParams.get("dataInicio") ?? undefined,
      dataFim: url.searchParams.get("dataFim") ?? undefined,
      canal: url.searchParams.get("canal") || undefined,
      status: url.searchParams.get("status") || undefined,
    });

    if (!parsed.success) {
      return Response.json(
        { error: "Parametros invalidos. Informe metodoPagamento, dataInicio e dataFim." },
        { status: 400 }
      );
    }

    const { metodoPagamento, dataInicio, dataFim, canal, status } = parsed.data;

    const startDate = new Date(`${dataInicio}T00:00:00.000Z`);
    const endDate = new Date(`${dataFim}T23:59:59.999Z`);

    let query = db
      .selectFrom("solicitacoes")
      .innerJoin("setores", "solicitacoes.setorId", "setores.id")
      .select([
        "solicitacoes.id",
        "solicitacoes.titulo",
        "solicitacoes.empresa",
        "solicitacoes.canalCompra",
        "solicitacoes.status",
        "solicitacoes.parcelas",
        "solicitacoes.dataCompra",
        "setores.nome as setorNome",
        estimatedTotalSql("solicitacoes").as("valorEstimadoTotal"),
        realTotalHybridSql("solicitacoes").as("valorRealTotal"),
      ])
      .where("solicitacoes.metodoPagamento", "=", metodoPagamento)
      .where("solicitacoes.dataCompra", ">=", startDate)
      .where("solicitacoes.dataCompra", "<=", endDate);

    if (canal) {
      query = query.where(
        db.fn("lower", [db.dynamic.ref("solicitacoes.canalCompra")]),
        "=",
        canal.toLowerCase()
      );
    }

    if (status) {
      query = query.where("solicitacoes.status", "=", status as any);
    }

    const rows = await query.orderBy("solicitacoes.dataCompra", "desc").execute();

    const itens: ConferenciaItem[] = rows.map((row) => {
      const valorReal = Number(row.valorRealTotal ?? 0);
      const valorEstimado = Number(row.valorEstimadoTotal ?? 0);

      return {
        id: row.id,
        tipo: "solicitacao" as const,
        data: row.dataCompra,
        item: row.titulo,
        setor: row.setorNome,
        empresa: row.empresa,
        canal: row.canalCompra,
        valorEstimado,
        valorReal: valorReal > 0 ? valorReal : null,
        parcelas: row.parcelas,
        status: row.status,
      };
    });

    let valorTotal = 0;
    let maiorCompra = 0;
    const porCanal: Record<string, { valor: number; qtd: number }> = {};
    const porStatus: Record<string, { valor: number; qtd: number }> = {};

    for (const item of itens) {
      const valor = item.valorReal ?? item.valorEstimado;
      valorTotal += valor;
      if (valor > maiorCompra) maiorCompra = valor;

      const canalKey = item.canal
        ? formatCanalCompraLabel(item.canal)
        : "Nao informado";
      if (!porCanal[canalKey]) porCanal[canalKey] = { valor: 0, qtd: 0 };
      porCanal[canalKey].valor += valor;
      porCanal[canalKey].qtd += 1;

      const statusKey = item.status;
      if (!porStatus[statusKey]) porStatus[statusKey] = { valor: 0, qtd: 0 };
      porStatus[statusKey].valor += valor;
      porStatus[statusKey].qtd += 1;
    }

    const cartaoInfo = CARTAO_INFO[metodoPagamento] ?? { apelido: metodoPagamento, final: "????" };

    const output: ConferenciaOutput = {
      cartao: cartaoInfo,
      periodo: { inicio: dataInicio, fim: dataFim },
      totais: {
        valorTotal,
        qtdItens: itens.length,
        maiorCompra,
        totalPorCanal: Object.entries(porCanal)
          .map(([canal, data]) => ({ canal, valor: data.valor, qtd: data.qtd }))
          .sort((a, b) => b.valor - a.valor),
        totalPorStatus: Object.entries(porStatus)
          .map(([status, data]) => ({ status, valor: data.valor, qtd: data.qtd }))
          .sort((a, b) => b.valor - a.valor),
      },
      itens,
    };

    return Response.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return Response.json({ error: message }, { status: 400 });
  }
}
