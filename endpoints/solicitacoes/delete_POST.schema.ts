import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  solicitacaoId: z.coerce.number().int().positive("Solicitacao invalida"),
  justificativa: z
    .string()
    .trim()
    .min(5, "Justificativa obrigatoria com pelo menos 5 caracteres")
    .max(2000, "Justificativa muito longa"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  deletedId: number;
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

export const postDeleteSolicitacao = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);

  const result = await fetch(`/_api/solicitacoes/delete`, {
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
        "Erro ao excluir solicitacao"
    );
  }

  if (!parsed || typeof parsed !== "object" || parsed.success !== true) {
    throw new Error(
      normalizeRawText(rawText) || "Resposta invalida ao excluir solicitacao"
    );
  }

  return parsed;
};
