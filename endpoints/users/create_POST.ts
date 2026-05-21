import { sql } from "kysely";
import { canManageUsers } from "../../helpers/accessGroups";
import { db } from "../../helpers/db";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./create_POST.schema";

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

    const existing = await db
      .selectFrom("users")
      .select("id")
      .where(sql`LOWER(users.email)`, "=", normalizedEmail)
      .limit(1)
      .executeTakeFirst();

    if (existing) {
      return Response.json(
        { error: "Já existe usuário com este e-mail." },
        { status: 409 }
      );
    }

    const passwordHash = await generatePasswordHash(payload.temporaryPassword);

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

    const createdUser = await db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto("users")
        .values({
          email: normalizedEmail,
          displayName: payload.displayName.trim(),
          role: payload.role,
          setorId: payload.setorId,
          isActive: payload.isActive,
          mustChangePassword: payload.mustChangePassword,
          createdAt: now,
          updatedAt: now,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("userPasswords")
        .values({
          userId: inserted.id,
          passwordHash,
          createdAt: now,
        })
        .execute();

      return inserted;
    });

    return Response.json(
      {
        success: true,
        userId: createdUser.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Erro ao criar usuário." },
      { status: 400 }
    );
  }
}

