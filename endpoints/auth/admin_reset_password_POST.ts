import { canManageUsers } from "../../helpers/accessGroups";
import { db } from "../../helpers/db";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { schema } from "./admin_reset_password_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const json = await request.json();
    const { userId, temporaryPassword } = schema.parse(json);

    if (!canManageUsers(user.role)) {
      return Response.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
    }

    const targetUser = await db
      .selectFrom("users")
      .select(["id"])
      .where("id", "=", userId)
      .limit(1)
      .executeTakeFirst();

    if (!targetUser) {
      return Response.json({ error: "User not found", code: "user_not_found" }, { status: 404 });
    }

    const passwordHash = await generatePasswordHash(temporaryPassword);
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      const existingPassword = await trx
        .selectFrom("userPasswords")
        .select(["id"])
        .where("userId", "=", userId)
        .limit(1)
        .executeTakeFirst();

      if (existingPassword) {
        await trx
          .updateTable("userPasswords")
          .set({
            passwordHash,
            createdAt: now,
          })
          .where("userId", "=", userId)
          .execute();
      } else {
        await trx
          .insertInto("userPasswords")
          .values({
            userId,
            passwordHash,
            createdAt: now,
          })
          .execute();
      }

      await trx
        .updateTable("users")
        .set({
          isActive: true,
          mustChangePassword: true,
          updatedAt: now,
          updatedBy: user.id,
        })
        .where("id", "=", userId)
        .execute();

      // Force a clean login with the temporary password.
      await trx.deleteFrom("sessions").where("userId", "=", userId).execute();
    });

    return Response.json({
      success: true,
      message: "Temporary password set. User must change password on next login.",
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    return Response.json({ error: "Failed to reset password." }, { status: 400 });
  }
}
