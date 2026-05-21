import superjson from "superjson";
import { db } from "../../helpers/db";
import { canManageUsers } from "../../helpers/accessGroups";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { OutputType, schema } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    schema.parse({});

    if (!canManageUsers(user.role)) {
      return new Response(
        superjson.stringify({ error: "Acesso negado." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const items = await db
      .selectFrom("users")
      .leftJoin("setores", "setores.id", "users.setorId")
      .select([
        "users.id",
        "users.displayName",
        "users.email",
        "users.setorId",
        "setores.nome as setorNome",
        "users.role",
        "users.isActive",
        "users.mustChangePassword",
        "users.lastLoginAt",
      ])
      .orderBy("users.displayName", "asc")
      .execute();

    return new Response(superjson.stringify(items satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      superjson.stringify({
        error: error?.message || "Erro ao listar usuários.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

