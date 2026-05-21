import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    // Check authentication
    await getServerUserSession(request);

    const items = await db
      .selectFrom("categorias")
      .select(["id", "nome", "descricao"])
      .orderBy("nome", "asc")
      .execute();

    return new Response(superjson.stringify(items satisfies OutputType));
  } catch (error: any) {
    return new Response(superjson.stringify({ error: error.message }), { status: 400 });
  }
}