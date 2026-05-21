import { z } from "zod";
import superjson from "superjson";
import { EmpresaArrayValues } from "../../helpers/schema";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (typeof value !== "string") return value ?? undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });

const optionalIsoDate = z
  .string()
  .datetime()
  .optional()
  .nullable();

const optionalPositiveNumber = z
  .union([z.coerce.number().positive(), z.null()])
  .optional();

const optionalIntNumber = (min: number, max?: number) => {
  let base = z.coerce.number().int().min(min);
  if (typeof max === "number") {
    base = base.max(max);
  }
  return z.union([base, z.null()]).optional();
};

const optionalUrl = z
  .union([z.string().trim().url(), z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (typeof value !== "string") return value ?? undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const schema = z.object({
  solicitacaoId: z.coerce.number().int().positive("Solicitação inválida"),
  justificativa: z
    .string()
    .trim()
    .min(5, "Justificativa obrigatória com pelo menos 5 caracteres")
    .max(2000, "Justificativa muito longa"),
  titulo: z.string().trim().min(3).max(200).optional(),
  descricao: optionalTrimmedString(4000),
  empresa: z.enum(EmpresaArrayValues).optional(),
  setorId: z.coerce.number().int().positive("Selecione um setor válido").optional(),
  categoriaId: z.coerce.number().int().positive("Selecione uma categoria válida").optional(),
  quantidade: z.coerce.number().int().min(1, "Quantidade inválida").optional(),
  valorEstimado: z.coerce.number().positive("Valor estimado inválido").optional(),
  linkProduto: optionalUrl,
  metodoPagamento: z
    .enum([
      "cartao_acseg",
      "cartao_acontrans",
      "cartao_sp",
      "pix",
      "dinheiro",
      "boleto",
      "transferencia",
      "cartao",
      "outro",
    ])
    .optional()
    .nullable(),
  parcelas: optionalIntNumber(1, 12),
  valorRealCompraUnitario: optionalPositiveNumber,
  dataCompra: optionalIsoDate,
  canalCompra: optionalTrimmedString(120),
  fornecedor: optionalTrimmedString(160),
  observacaoCompra: optionalTrimmedString(1000),
  referenciaPedido: optionalTrimmedString(120),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  id: number;
  changedFields: string[];
};

function normalizeRawText(text: string) {
  return text.replace(/^\uFEFF/, "").trim();
}

function tryParseAny<T>(raw: string): T | null {
  const text = normalizeRawText(raw);
  if (!text) return null;

  try {
    return superjson.parse<T>(text);
  } catch {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
}

export const postAdminAdjustSolicitacao = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);

  const result = await fetch(`/_api/solicitacoes/admin-adjust`, {
    method: "POST",
    credentials: "include",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const rawText = await result.text();
  const parsed = tryParseAny<OutputType & { error?: string; message?: string }>(rawText);

  if (!result.ok) {
    throw new Error(
      parsed?.error ||
        parsed?.message ||
        normalizeRawText(rawText) ||
        "Erro ao aplicar ajuste administrativo"
    );
  }

  if (!parsed || typeof parsed !== "object" || parsed.success !== true) {
    throw new Error(
      normalizeRawText(rawText) ||
        "Resposta inválida ao aplicar ajuste administrativo"
    );
  }

  return {
    success: true,
    id: Number(parsed.id),
    changedFields: Array.isArray(parsed.changedFields) ? parsed.changedFields : [],
  };
};
