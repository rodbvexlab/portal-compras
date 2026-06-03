import { z } from "zod";
import superjson from "superjson";

import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  EmpresaArrayValues,
  PrioridadeArrayValues,
  type MetodoPagamento,
} from "../../helpers/schema";
import {
  normalizeQuantity,
  roundCurrency,
} from "../../helpers/monetary";
import {
  isCardPaymentMethod,
  normalizeCanalCompra,
} from "../../helpers/solicitacoesDomain";

const STATUS_FINAL = "concluido" as const;
const STATUS_APROVACAO_DIRETA = "pendente_financeiro" as const;

const schema = z.object({
  titulo: z.string().trim().min(3, "Titulo obrigatorio").max(200),
  setor_id: z.coerce.number().int().positive("Setor obrigatorio"),
  categoria_id: z.coerce.number().int().positive("Categoria obrigatoria"),
  empresa: z.enum(EmpresaArrayValues),
  quantidade: z.coerce.number().int().min(1, "Quantidade obrigatoria"),
  valor_unitario_estimado: z.coerce
    .number()
    .finite("Valor estimado invalido")
    .positive("Valor estimado obrigatorio"),
  valor_real_unitario: z.coerce
    .number()
    .finite("Valor real unitario invalido")
    .positive("Valor real unitario obrigatorio"),
  valor_real_total: z.coerce
    .number()
    .finite("Valor real total invalido")
    .positive("Valor real total obrigatorio"),
  canal_compra: z.string().trim().min(2, "Canal de compra obrigatorio").max(120),
  metodo_pagamento: z.enum([
    "cartao_acseg",
    "cartao_acontrans",
    "cartao_sp",
    "pix",
    "dinheiro",
    "boleto",
    "transferencia",
    "cartao",
    "outro",
  ]),
  parcelas: z.coerce.number().int().min(1).max(12).default(1),
  descricao: z.string().trim().min(1, "Descricao obrigatoria").max(4000),
  prioridade: z.enum(PrioridadeArrayValues),
});

type Input = z.infer<typeof schema>;

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function toLegacyFormaPagamento(
  metodoPagamento: Input["metodo_pagamento"]
): "pix" | "boleto" | "transferencia" | "cartao" | "outro" | null {
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

  return metodoPagamento;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(superjson.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "admin") {
      return jsonResponse({ error: "Acesso restrito ao perfil admin." }, 403);
    }

    const input = schema.parse(parseRequestPayload(await request.text()));
    const quantidade = normalizeQuantity(input.quantidade);
    const valorEstimadoUnitario = roundCurrency(input.valor_unitario_estimado);
    const valorRealUnitario = roundCurrency(input.valor_real_unitario);
    const valorRealTotalCalculado = roundCurrency(valorRealUnitario * quantidade);
    const valorRealTotalInformado = roundCurrency(input.valor_real_total);

    if (Math.abs(valorRealTotalCalculado - valorRealTotalInformado) > 0.01) {
      return jsonResponse(
        {
          error:
            "Valor real total divergente. Recalcule a partir da quantidade e do valor real unitario.",
        },
        400
      );
    }

    if (isCardPaymentMethod(input.metodo_pagamento) && input.parcelas < 1) {
      return jsonResponse(
        { error: "Parcelas devem ser informadas para pagamento em cartao." },
        400
      );
    }

    const [setor, categoria] = await Promise.all([
      db
        .selectFrom("setores")
        .select(["id"])
        .where("id", "=", input.setor_id)
        .executeTakeFirst(),
      db
        .selectFrom("categorias")
        .select(["id"])
        .where("id", "=", input.categoria_id)
        .executeTakeFirst(),
    ]);

    if (!setor) {
      return jsonResponse({ error: "Setor invalido." }, 400);
    }

    if (!categoria) {
      return jsonResponse({ error: "Categoria invalida." }, 400);
    }

    const canalCompra = normalizeCanalCompra(input.canal_compra);
    const parcelas = isCardPaymentMethod(input.metodo_pagamento) ? input.parcelas : null;
    const now = new Date();

    const result = await db.transaction().execute(async (trx) => {
      const solicitacao = await trx
        .insertInto("solicitacoes")
        .values({
          titulo: input.titulo,
          descricao: input.descricao,
          justificativa: "Compra direta registrada pelo administrador.",
          empresa: input.empresa,
          valorEstimado: valorEstimadoUnitario.toString(),
          quantidade,
          prioridade: input.prioridade,
          setorId: input.setor_id,
          categoriaId: input.categoria_id,
          solicitanteId: user.id,
          status: STATUS_FINAL,
          valorRealCompraUnitario: valorRealUnitario.toString(),
          valorRealCompra: valorRealTotalCalculado.toString(),
          canalCompra,
          metodoPagamento: input.metodo_pagamento as MetodoPagamento,
          formaPagamento: toLegacyFormaPagamento(input.metodo_pagamento),
          parcelas,
          dataCompra: now,
          financeiroAprovadoPor: user.id,
          financeiroAprovadoEm: now,
          financeiroJustificativa: "Aprovacao direta pelo administrador.",
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("historicoStatus")
        .values([
          {
            solicitacaoId: solicitacao.id,
            statusAnterior: null,
            statusNovo: STATUS_APROVACAO_DIRETA,
            usuarioId: user.id,
            comentario: "Solicitacao criada via compra direta.",
          },
          {
            solicitacaoId: solicitacao.id,
            statusAnterior: STATUS_APROVACAO_DIRETA,
            statusNovo: STATUS_FINAL,
            usuarioId: user.id,
            comentario: "Aprovacao direta pelo administrador.",
          },
        ])
        .execute();

      return solicitacao;
    });

    return jsonResponse({ success: true, solicitacaoId: result.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao registrar compra direta.";
    console.error("Erro ao registrar compra direta:", error);

    return jsonResponse({ error: message }, 400);
  }
}
