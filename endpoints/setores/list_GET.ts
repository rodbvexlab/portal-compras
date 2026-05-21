import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    // Garante que apenas usuário autenticado consulte os setores
    await getServerUserSession(request);

    // Mantido para compatibilidade com o schema, mesmo sem filtros
    schema.parse({});

    const items = await db
      .selectFrom("setores")
      .select(["id", "nome", "descricao"])
      .orderBy("nome", "asc")
      .execute();

    return new Response(superjson.stringify(items satisfies OutputType), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(
      superjson.stringify({
        error: error?.message || "Erro ao listar setores",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}