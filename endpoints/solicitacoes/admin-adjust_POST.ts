import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import type { MetodoPagamento, SolicitacaoStatus } from "../../helpers/schema";
import {
  calculateRealTotal,
  normalizeQuantity,
  resolveRealUnitario,
  roundCurrency,
  toFiniteNumber,
} from "../../helpers/monetary";
import {
  canRunAdministrativeAdjustment,
  isCardPaymentMethod,
  normalizeCanalCompra,
  normalizeEmpresa,
} from "../../helpers/solicitacoesDomain";
import { schema } from "./admin-adjust_POST.schema";

type AdjustmentChange = {
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
};

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function normalizeOptionalString(value?: string | null) {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeOptionalUrl(value?: string | null) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  try {
    return new URL(normalized).toString();
  } catch {
    throw new Error("Link do produto inválido.");
  }
}

function normalizeOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data da compra inválida.");
  }
  return parsed;
}

function toLegacyFormaPagamento(
  metodoPagamento?: string | null
): "pix" | "boleto" | "transferencia" | "cartao" | "outro" | null {
  if (!metodoPagamento) return null;

  if (
    metodoPagamento === "cartao_acseg" ||
    metodoPagamento === "cartao_acontrans" ||
    metodoPagamento === "cartao_sp" ||
    metodoPagamento === "cartao"
  ) {
    return "cartao";
  }

  if (metodoPagamento === "dinheiro" || metodoPagamento === "outro") {
    return "outro";
  }

  if (
    metodoPagamento === "pix" ||
    metodoPagamento === "boleto" ||
    metodoPagamento === "transferencia"
  ) {
    return metodoPagamento;
  }

  return "outro";
}

function toComparableValue(value: string | number | null | Date | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return roundCurrency(value).toFixed(2);
  if (typeof value === "string") return value;
  return value ?? null;
}

function pushChange(
  changes: AdjustmentChange[],
  campo: string,
  previousValue: string | number | null | Date | undefined,
  nextValue: string | number | null | Date | undefined
) {
  const previous = toComparableValue(previousValue);
  const next = toComparableValue(nextValue);
  if (previous === next) return;

  changes.push({
    campo,
    valorAnterior: previous === null ? null : String(previous),
    valorNovo: next === null ? null : String(next),
  });
}

function toComparableInteger(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? Math.trunc(value) : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? String(parsed) : String(value);
}

function pushIntegerChange(
  changes: AdjustmentChange[],
  campo: string,
  previousValue: string | number | null | undefined,
  nextValue: string | number | null | undefined
) {
  const previous = toComparableInteger(previousValue);
  const next = toComparableInteger(nextValue);
  if (previous === next) return;

  changes.push({
    campo,
    valorAnterior: previous,
    valorNovo: next,
  });
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({
          error: "Ajuste administrativo permitido somente para administradores.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rawText = await request.text();
    const json = parseRequestPayload(rawText);
    const input = schema.parse(json);

    const solicitacao = await db
      .selectFrom("solicitacoes")
      .select([
        "id",
        "status",
        "titulo",
        "descricao",
        "empresa",
        "setorId",
        "categoriaId",
        "quantidade",
        "valorEstimado",
        "linkProduto",
        "metodoPagamento",
        "formaPagamento",
        "parcelas",
        "valorRealCompraUnitario",
        "valorRealCompra",
        "dataCompra",
        "canalCompra",
        "fornecedor",
        "observacaoCompra",
        "referenciaPedido",
      ])
      .where("id", "=", input.solicitacaoId)
      .executeTakeFirst();

    if (!solicitacao) {
      return new Response(
        superjson.stringify({ error: "Solicitação não encontrada." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const statusAtual = solicitacao.status as SolicitacaoStatus;
    if (!canRunAdministrativeAdjustment(statusAtual)) {
      return new Response(
        superjson.stringify({
          error: "O status atual não permite ajuste administrativo.",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (typeof input.setorId === "number") {
      const setor = await db
        .selectFrom("setores")
        .select("id")
        .where("id", "=", input.setorId)
        .executeTakeFirst();

      if (!setor) {
        throw new Error("Setor inválido para ajuste administrativo.");
      }
    }

    if (typeof input.categoriaId === "number") {
      const categoria = await db
        .selectFrom("categorias")
        .select("id")
        .where("id", "=", input.categoriaId)
        .executeTakeFirst();

      if (!categoria) {
        throw new Error("Categoria inválida para ajuste administrativo.");
      }
    }

    const nextQuantidade =
      typeof input.quantidade === "number"
        ? normalizeQuantity(input.quantidade)
        : solicitacao.quantidade;
    const nextValorEstimado =
      typeof input.valorEstimado === "number"
        ? roundCurrency(input.valorEstimado)
        : roundCurrency(toFiniteNumber(solicitacao.valorEstimado, 0));
    const nextMetodoPagamento =
      input.metodoPagamento !== undefined
        ? (input.metodoPagamento as MetodoPagamento | null)
        : (solicitacao.metodoPagamento as MetodoPagamento | null);
    const nextValorRealCompraUnitario =
      input.valorRealCompraUnitario !== undefined
        ? input.valorRealCompraUnitario === null
          ? null
          : roundCurrency(input.valorRealCompraUnitario)
        : resolveRealUnitario({
            valorRealCompraUnitario: solicitacao.valorRealCompraUnitario,
            valorRealCompraLegado: solicitacao.valorRealCompra,
            quantidade: solicitacao.quantidade,
          });
    const nextValorRealCompra = calculateRealTotal({
      valorRealCompraUnitario: nextValorRealCompraUnitario,
      valorRealCompraLegado:
        nextValorRealCompraUnitario === null ? null : solicitacao.valorRealCompra,
      quantidade: nextQuantidade,
    });

    const nextPayload = {
      titulo:
        typeof input.titulo === "string" ? input.titulo.trim() : solicitacao.titulo,
      descricao:
        input.descricao !== undefined
          ? normalizeOptionalString(input.descricao)
          : solicitacao.descricao,
      empresa:
        input.empresa !== undefined
          ? normalizeEmpresa(input.empresa)
          : normalizeEmpresa(solicitacao.empresa),
      setorId:
        typeof input.setorId === "number" ? input.setorId : solicitacao.setorId,
      categoriaId:
        typeof input.categoriaId === "number"
          ? input.categoriaId
          : solicitacao.categoriaId,
      quantidade: nextQuantidade,
      valorEstimado: nextValorEstimado,
      linkProduto:
        input.linkProduto !== undefined
          ? normalizeOptionalUrl(input.linkProduto)
          : solicitacao.linkProduto,
      metodoPagamento: nextMetodoPagamento,
      formaPagamento: toLegacyFormaPagamento(nextMetodoPagamento),
      parcelas:
        input.parcelas !== undefined
          ? input.parcelas
          : solicitacao.parcelas,
      valorRealCompraUnitario: nextValorRealCompraUnitario,
      valorRealCompra:
        nextValorRealCompra > 0 ? nextValorRealCompra.toFixed(2) : null,
      dataCompra:
        input.dataCompra !== undefined
          ? normalizeOptionalDate(input.dataCompra)
          : solicitacao.dataCompra,
      canalCompra:
        input.canalCompra !== undefined
          ? normalizeCanalCompra(input.canalCompra)
          : solicitacao.canalCompra,
      fornecedor:
        input.fornecedor !== undefined
          ? normalizeOptionalString(input.fornecedor)
          : solicitacao.fornecedor,
      observacaoCompra:
        input.observacaoCompra !== undefined
          ? normalizeOptionalString(input.observacaoCompra)
          : solicitacao.observacaoCompra,
      referenciaPedido:
        input.referenciaPedido !== undefined
          ? normalizeOptionalString(input.referenciaPedido)
          : solicitacao.referenciaPedido,
    };

    if (!nextPayload.empresa) {
      throw new Error("Empresa inválida para ajuste administrativo.");
    }

    if (
      nextPayload.metodoPagamento &&
      isCardPaymentMethod(nextPayload.metodoPagamento) &&
      (!nextPayload.parcelas || nextPayload.parcelas < 1)
    ) {
      throw new Error("Informe o parcelamento para método de pagamento em cartão.");
    }

    if (
      nextPayload.metodoPagamento &&
      !isCardPaymentMethod(nextPayload.metodoPagamento)
    ) {
      nextPayload.parcelas = null;
    }

    const changes: AdjustmentChange[] = [];

    pushChange(changes, "titulo", solicitacao.titulo, nextPayload.titulo);
    pushChange(changes, "descricao", solicitacao.descricao, nextPayload.descricao);
    pushChange(changes, "empresa", solicitacao.empresa, nextPayload.empresa);
    pushIntegerChange(changes, "setor", solicitacao.setorId, nextPayload.setorId);
    pushIntegerChange(
      changes,
      "categoria",
      solicitacao.categoriaId,
      nextPayload.categoriaId
    );
    pushIntegerChange(
      changes,
      "quantidade",
      solicitacao.quantidade,
      nextPayload.quantidade
    );
    pushChange(
      changes,
      "valor_estimado_unitario",
      solicitacao.valorEstimado,
      nextPayload.valorEstimado
    );
    pushChange(
      changes,
      "link_produto",
      solicitacao.linkProduto,
      nextPayload.linkProduto
    );
    pushChange(
      changes,
      "metodo_pagamento",
      solicitacao.metodoPagamento,
      nextPayload.metodoPagamento
    );
    pushIntegerChange(changes, "parcelas", solicitacao.parcelas, nextPayload.parcelas);
    pushChange(
      changes,
      "valor_real_compra_unitario",
      resolveRealUnitario({
        valorRealCompraUnitario: solicitacao.valorRealCompraUnitario,
        valorRealCompraLegado: solicitacao.valorRealCompra,
        quantidade: solicitacao.quantidade,
      }),
      nextPayload.valorRealCompraUnitario
    );
    pushChange(
      changes,
      "data_compra",
      solicitacao.dataCompra,
      nextPayload.dataCompra
    );
    pushChange(
      changes,
      "canal_compra",
      solicitacao.canalCompra,
      nextPayload.canalCompra
    );
    pushChange(
      changes,
      "fornecedor",
      solicitacao.fornecedor,
      nextPayload.fornecedor
    );
    pushChange(
      changes,
      "observacao_compra",
      solicitacao.observacaoCompra,
      nextPayload.observacaoCompra
    );
    pushChange(
      changes,
      "referencia_pedido",
      solicitacao.referenciaPedido,
      nextPayload.referenciaPedido
    );

    if (changes.length === 0) {
      return new Response(
        superjson.stringify({
          error: "Nenhum campo foi alterado no ajuste administrativo.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("solicitacoes")
        .set({
          titulo: nextPayload.titulo,
          descricao: nextPayload.descricao,
          empresa: nextPayload.empresa,
          setorId: nextPayload.setorId,
          categoriaId: nextPayload.categoriaId,
          quantidade: nextPayload.quantidade,
          valorEstimado: nextPayload.valorEstimado.toFixed(2),
          linkProduto: nextPayload.linkProduto,
          metodoPagamento: nextPayload.metodoPagamento,
          formaPagamento: nextPayload.formaPagamento,
          parcelas: nextPayload.parcelas,
          valorRealCompraUnitario:
            nextPayload.valorRealCompraUnitario === null
              ? null
              : nextPayload.valorRealCompraUnitario.toFixed(2),
          valorRealCompra: nextPayload.valorRealCompra,
          dataCompra: nextPayload.dataCompra,
          canalCompra: nextPayload.canalCompra,
          fornecedor: nextPayload.fornecedor,
          observacaoCompra: nextPayload.observacaoCompra,
          referenciaPedido: nextPayload.referenciaPedido,
        })
        .where("id", "=", input.solicitacaoId)
        .execute();

      await trx
        .insertInto("solicitacoesAjustesOperacionais")
        .values(
          changes.map((change) => ({
            solicitacaoId: input.solicitacaoId,
            usuarioId: user.id,
            campo: change.campo,
            valorAnterior: change.valorAnterior,
            valorNovo: change.valorNovo,
            justificativa: input.justificativa.trim(),
          }))
        )
        .execute();
    });

    return new Response(
      superjson.stringify({
        success: true,
        id: input.solicitacaoId,
        changedFields: changes.map((change) => change.campo),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno ao aplicar ajuste administrativo.";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
