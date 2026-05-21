import { z } from "zod";
import { UserRoleArrayValues } from "../../helpers/schema";

export const schema = z.object({
  userId: z.coerce.number().int().positive("Usuário inválido"),
  displayName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  setorId: z.coerce.number().int().positive().nullable(),
  role: z.enum(UserRoleArrayValues),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      success: true;
    }
  | {
      error: string;
    };

export const postUpdateUser = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/users/update`, {
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

