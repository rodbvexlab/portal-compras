import { z } from "zod";
import superjson from "superjson";
import { EmpresaArrayValues, PrioridadeArrayValues } from "../../helpers/schema";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    return value.length > 0 ? value : undefined;
  });

export const schema = z.object({
  solicitacaoId: z.coerce.number().int().positive(),
  titulo: z
    .string()
    .trim()
    .min(3, "O titulo deve ter pelo menos 3 caracteres"),
  descricao: optionalTrimmedString,
  valorEstimado: z
    .number()
    .finite("Informe um valor estimado valido")
    .positive("Informe um valor estimado maior que zero"),
  quantidade: z
    .number()
    .int("A quantidade deve ser um numero inteiro")
    .min(1, "A quantidade deve ser pelo menos 1"),
  prioridade: z.enum(PrioridadeArrayValues),
  empresa: z.enum(EmpresaArrayValues).optional(),
  setorId: z.coerce.number().int().positive("Selecione um setor valido"),
  categoriaId: z.coerce.number().int().positive("Selecione uma categoria valida"),
  linkProduto: z
    .string()
    .trim()
    .url("Informe um link valido")
    .optional()
    .or(z.literal(""))
    .transform((value) => {
      if (!value) return undefined;
      return value.trim().length > 0 ? value.trim() : undefined;
    }),
  acao: z.enum(["salvar", "reenviar"]).default("salvar"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  id: number;
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

export const postUpdateSolicitacao = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);

  const result = await fetch(`/_api/solicitacoes/update`, {
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
        "Erro ao atualizar solicitacao"
    );
  }

  if (!parsed || typeof parsed !== "object" || parsed.success !== true) {
    throw new Error(
      normalizeRawText(rawText) || "Resposta invalida ao atualizar solicitacao"
    );
  }

  return {
    success: true,
    id: Number(parsed.id),
  };
};
