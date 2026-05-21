import { z } from "zod";
import superjson from "superjson";
import { UserRoleArrayValues } from "../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminUserListItem = {
  id: number;
  displayName: string;
  email: string;
  setorId: number | null;
  setorNome: string | null;
  role: (typeof UserRoleArrayValues)[number];
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | string | null;
};

export type OutputType = AdminUserListItem[];

export const getUsers = async (
  input: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/users/list`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};
