import "../loadEnv.js";
import { sql } from "kysely";
import { db } from "../helpers/db.tsx";

async function run() {
  console.log("[migration] Iniciando: historico_precos");

  await sql`
    CREATE TABLE IF NOT EXISTS historico_precos (
      id SERIAL PRIMARY KEY,
      titulo_normalizado TEXT NOT NULL,
      titulo_original TEXT NOT NULL,
      valor_unitario NUMERIC(12,2) NOT NULL,
      valor_total NUMERIC(12,2) NOT NULL,
      quantidade INTEGER NOT NULL,
      fornecedor TEXT,
      canal TEXT,
      data_compra TIMESTAMPTZ NOT NULL,
      solicitacao_id INTEGER REFERENCES solicitacoes(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `.execute(db);

  console.log("[migration] Tabela historico_precos: OK");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_historico_precos_titulo
      ON historico_precos(titulo_normalizado)
  `.execute(db);

  console.log("[migration] Índice idx_historico_precos_titulo: OK");
  console.log("[migration] Concluída com sucesso.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migration] Erro:", err);
    process.exit(1);
  });
