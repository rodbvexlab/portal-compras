import { z } from "zod";

export const schema = z.object({
  userId: z.coerce.number().int().positive("Valid user id is required"),
  temporaryPassword: z
    .string()
    .min(6, "Temporary password must be at least 6 characters"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType =
  | {
      success: true;
      message: string;
    }
  | {
      error: string;
      code?: string;
    };

export const postAdminResetPassword = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/admin_reset_password`, {
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
