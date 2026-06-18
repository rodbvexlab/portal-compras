import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

type OrcamentoRow = {
  setor: string;
  limiteMensal: string;
};

type GastosRow = {
  setor: string;
  gastoReal: string;
  totalCompras: string;
};

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (!["diretora_financeiro", "admin"].includes(user.role)) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const url = new URL(request.url);
    const now = new Date();
    const mes = Number(url.searchParams.get("mes") ?? now.getMonth() + 1);
    const ano = Number(url.searchParams.get("ano") ?? now.getFullYear());

    const [orcamentos, gastos] = await Promise.all([
      sql<OrcamentoRow>`
        SELECT setor, limite_mensal
        FROM orcamento_setor
        WHERE mes_referencia = ${mes} AND ano_referencia = ${ano}
      `.execute(db),

      sql<GastosRow>`
        SELECT
          st.nome AS setor,
          COALESCE(SUM(
            CASE
              WHEN s.valor_real_compra_unitario IS NOT NULL
                THEN s.valor_real_compra_unitario * COALESCE(s.quantidade, 1)
              WHEN s.valor_real_compra IS NOT NULL
                THEN s.valor_real_compra
              ELSE 0
            END
          ), 0) AS gasto_real,
          COUNT(s.id) AS total_compras
        FROM solicitacoes s
        INNER JOIN setores st ON s.setor_id = st.id
        WHERE s.status = 'concluido'
          AND EXTRACT(MONTH FROM s.updated_at) = ${mes}
          AND EXTRACT(YEAR FROM s.updated_at) = ${ano}
        GROUP BY st.id, st.nome
      `.execute(db),
    ]);

    const orcamentoMap = new Map(
      orcamentos.rows.map((r) => [r.setor, Number(r.limiteMensal)])
    );
    const gastosMap = new Map(
      gastos.rows.map((r) => [
        r.setor,
        { gastoReal: Number(r.gastoReal), totalCompras: Number(r.totalCompras) },
      ])
    );

    const allSetores = new Set([...orcamentoMap.keys(), ...gastosMap.keys()]);

    const result = Array.from(allSetores).map((setor) => {
      const limiteMensal = orcamentoMap.get(setor) ?? null;
      const { gastoReal = 0, totalCompras = 0 } = gastosMap.get(setor) ?? {};
      const percentual =
        limiteMensal !== null && limiteMensal > 0
          ? (gastoReal / limiteMensal) * 100
          : null;

      return { setor, limiteMensal, gastoReal, percentual, totalCompras };
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return Response.json({ error: message }, { status: 400 });
  }
}
