import { z } from "zod";
import superjson from "superjson";
import { SolicitacaoStatusArrayValues } from "../../helpers/schema";

export const schema = z.object({
  solicitacaoId: z.coerce.number(),
  statusNovo: z.enum(SolicitacaoStatusArrayValues),
  comentario: z.string().optional(),
  titulo: z.string().trim().min(3).max(200).optional(),
  descricao: z.string().trim().max(4000).optional(),
  valorEstimado: z.coerce.number().positive().optional(),
  metodoPagamento: z
    .enum([
      "cartao_acseg",
      "cartao_acontrans",
      "cartao_sp",
      "pix",
      "dinheiro",
      // Compatibilidade legada:
      "boleto",
      "transferencia",
      "cartao",
      "outro",
    ])
    .optional(),
  parcelas: z.coerce.number().int().min(1).max(12).optional(),
  valorRealCompraUnitario: z.coerce.number().positive().optional(),
  valorRealCompra: z.coerce.number().positive().optional(),
  quantidadeAjustada: z.coerce.number().int().min(1).optional(),
  dataCompra: z.string().datetime().optional(),
  fornecedor: z.string().trim().min(2).max(160).optional(),
  canalCompra: z.string().trim().min(2).max(120).optional(),
  referenciaPedido: z.string().trim().max(120).optional(),
  observacaoCompra: z.string().trim().max(1000).optional(),
  linkProduto: z.string().trim().max(2000).optional(),
});

export type InputType = z.infer<typeof schema>;
export type OutputType = { success: true };

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

export const postUpdateStatusSolicitacao = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/solicitacoes/update-status`, {
    method: "POST",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: superjson.stringify(input),
  });

  const rawText = await result.text();
  const parsed = tryParseAny<OutputType & { error?: string; message?: string }>(rawText);

  if (!result.ok) {
    throw new Error(
      parsed?.error ||
        parsed?.message ||
        normalizeRawText(rawText) ||
        "Erro ao atualizar status"
    );
  }

  if (!parsed || typeof parsed !== "object" || parsed.success !== true) {
    throw new Error(
      normalizeRawText(rawText) || "Resposta inválida ao atualizar status"
    );
  }

  return { success: true };
};
