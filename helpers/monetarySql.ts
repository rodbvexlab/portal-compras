import { sql } from "kysely";

export function estimatedTotalSql(tableAlias = "solicitacoes") {
  return sql<number>`
    COALESCE(
      ${sql.ref(`${tableAlias}.valorEstimado`)} * COALESCE(${sql.ref(`${tableAlias}.quantidade`)}, 1),
      0
    )
  `;
}

export function realTotalHybridSql(tableAlias = "solicitacoes") {
  return sql<number>`
    COALESCE(
      CASE
        WHEN ${sql.ref(`${tableAlias}.valorRealCompraUnitario`)} IS NOT NULL
          THEN ${sql.ref(`${tableAlias}.valorRealCompraUnitario`)} * COALESCE(${sql.ref(`${tableAlias}.quantidade`)}, 1)
        ELSE ${sql.ref(`${tableAlias}.valorRealCompra`)}
      END,
      0
    )
  `;
}

export function quantitySql(tableAlias = "solicitacoes") {
  return sql<number>`COALESCE(${sql.ref(`${tableAlias}.quantidade`)}, 0)`;
}
