import { z } from "zod";
import { UserRoleArrayValues } from "../../helpers/schema";

export const schema = z.object({
  displayName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  setorId: z.coerce.number().int().positive().nullable(),
  role: z.enum(UserRoleArrayValues),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true),
  temporaryPassword: z
    .string()
    .min(6, "Senha provisória deve ter ao menos 6 caracteres"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      success: true;
      userId: number;
    }
  | {
      error: string;
    };

export const postCreateUser = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/users/create`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  return result.json();
};
