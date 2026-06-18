import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

type OrcamentoResult = {
  id: number;
  setor: string;
  limiteMensal: string;
  mesReferencia: number;
  anoReferencia: number;
  updatedAt: Date;
};

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (!["diretora_financeiro", "admin"].includes(user.role)) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const rawText = await request.text();
    const body = JSON.parse(rawText);
    const { setor, limite_mensal, mes_referencia, ano_referencia } = body as {
      setor?: unknown;
      limite_mensal?: unknown;
      mes_referencia?: unknown;
      ano_referencia?: unknown;
    };

    if (!setor || typeof setor !== "string" || setor.trim() === "") {
      return Response.json({ error: "Setor inválido." }, { status: 422 });
    }

    const limiteMensalNum = Number(limite_mensal);
    if (!Number.isFinite(limiteMensalNum) || limiteMensalNum <= 0) {
      return Response.json(
        { error: "Limite mensal deve ser maior que zero." },
        { status: 422 }
      );
    }

    const mesNum = Number(mes_referencia);
    const anoNum = Number(ano_referencia);

    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      return Response.json({ error: "Mês de referência inválido." }, { status: 422 });
    }

    if (!Number.isInteger(anoNum) || anoNum < 2020 || anoNum > 2100) {
      return Response.json({ error: "Ano de referência inválido." }, { status: 422 });
    }

    const result = await sql<OrcamentoResult>`
      INSERT INTO orcamento_setor
        (setor, limite_mensal, mes_referencia, ano_referencia, criado_por_id)
      VALUES
        (${setor.trim()}, ${limiteMensalNum}, ${mesNum}, ${anoNum}, ${user.id})
      ON CONFLICT (setor, mes_referencia, ano_referencia)
      DO UPDATE SET
        limite_mensal = EXCLUDED.limite_mensal,
        updated_at = NOW()
      RETURNING id, setor, limite_mensal, mes_referencia, ano_referencia, updated_at
    `.execute(db);

    return Response.json(result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return Response.json({ error: message }, { status: 400 });
  }
}
