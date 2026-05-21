import { sql } from "kysely";
import { canManageUsers } from "../../helpers/accessGroups";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./update_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (!canManageUsers(user.role)) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const json = await request.json();
    const payload = schema.parse(json);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const now = new Date();

    const targetUser = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where("id", "=", payload.userId)
      .limit(1)
      .executeTakeFirst();

    if (!targetUser) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const duplicate = await db
      .selectFrom("users")
      .select("id")
      .where(sql`LOWER(users.email)`, "=", normalizedEmail)
      .where("id", "!=", payload.userId)
      .limit(1)
      .executeTakeFirst();

    if (duplicate) {
      return Response.json(
        { error: "Já existe outro usuário com este e-mail." },
        { status: 409 }
      );
    }

    if (payload.setorId) {
      const setorExists = await db
        .selectFrom("setores")
        .select("id")
        .where("id", "=", payload.setorId)
        .limit(1)
        .executeTakeFirst();

      if (!setorExists) {
        return Response.json({ error: "Setor informado não existe." }, { status: 400 });
      }
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("users")
        .set({
          displayName: payload.displayName.trim(),
          email: normalizedEmail,
          setorId: payload.setorId,
          role: payload.role,
          isActive: payload.isActive,
          mustChangePassword: payload.mustChangePassword,
          updatedAt: now,
          updatedBy: user.id,
        })
        .where("id", "=", payload.userId)
        .execute();

      if (!payload.isActive || payload.mustChangePassword) {
        await trx
          .deleteFrom("sessions")
          .where("userId", "=", payload.userId)
          .execute();
      }
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Erro ao atualizar usuário." },
      { status: 400 }
    );
  }
}

