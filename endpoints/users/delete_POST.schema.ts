import { z } from "zod";

export const schema = z.object({
  userId: z.coerce.number().int().positive("Usuário inválido"),
});

export type InputType = z.infer<typeof schema>;

export type CriticalLinks = {
  solicitacoes: number;
  aprovacoes: number;
  historicoStatus: number;
};

export type OutputType =
  | {
      success: true;
    }
  | {
      error: string;
      requiresInactivation?: boolean;
      links?: CriticalLinks;
    };

export const postDeleteUser = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/users/delete`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  const responseText = await result.text();

  if (!responseText) {
    return { error: "Resposta vazia ao excluir usuário." };
  }

  try {
    return JSON.parse(responseText) as OutputType;
  } catch {
    return { error: responseText };
  }
};

