import "../loadEnv.js";
import { sql } from "kysely";
import { db } from "../helpers/db.tsx";

async function run() {
  console.log("[migration] Iniciando: orcamento_setor");

  await sql`
    CREATE TABLE IF NOT EXISTS orcamento_setor (
      id SERIAL PRIMARY KEY,
      setor TEXT NOT NULL,
      limite_mensal NUMERIC(12,2) NOT NULL,
      mes_referencia INTEGER NOT NULL,
      ano_referencia INTEGER NOT NULL,
      criado_por_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(setor, mes_referencia, ano_referencia)
    )
  `.execute(db);

  console.log("[migration] Tabela orcamento_setor: OK");
  console.log("[migration] Concluída com sucesso.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migration] Erro:", err);
    process.exit(1);
  });
