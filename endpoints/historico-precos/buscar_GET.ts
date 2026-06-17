import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

type HistoricoPrecoRow = {
  titulo_original: string;
  valor_unitario: string;
  valor_total: string;
  quantidade: number;
  fornecedor: string | null;
  canal: string | null;
  data_compra: Date;
};

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (q.length < 3) {
      return Response.json([]);
    }

    const term = `%${q.toLowerCase()}%`;

    const rows = await sql<HistoricoPrecoRow>`
      SELECT DISTINCT ON (titulo_normalizado)
        titulo_original,
        valor_unitario,
        valor_total,
        quantidade,
        fornecedor,
        canal,
        data_compra
      FROM historico_precos
      WHERE titulo_normalizado ILIKE ${term}
      ORDER BY titulo_normalizado, data_compra DESC
      LIMIT 5
    `.execute(db);

    return Response.json(rows.rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return Response.json({ error: message }, { status: 400 });
  }
}
