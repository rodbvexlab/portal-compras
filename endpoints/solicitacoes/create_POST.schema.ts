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

  setorId: z
    .number()
    .int("Selecione um setor valido")
    .positive("Selecione um setor valido"),

  categoriaId: z
    .number()
    .int("Selecione uma categoria valida")
    .positive("Selecione uma categoria valida"),

  empresa: z.enum(EmpresaArrayValues, {
    required_error: "Selecione a empresa solicitante",
  }),

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
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  id: number;
};

export const postCreateSolicitacao = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);

  const result = await fetch(`/_api/solicitacoes/create`, {
    method: "POST",
    credentials: "include",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Erro ao criar solicitacao");
  }

  return superjson.parse<OutputType>(await result.text());
};
