import { compare } from "bcryptjs";
import { db } from "../../helpers/db";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError, setServerSession } from "../../helpers/getSetServerSession";
import { schema } from "./change_password_POST.schema";

export async function handle(request: Request) {
  try {
    const { user, session } = await getServerUserSession(request);
    const json = await request.json();
    const { currentPassword, newPassword } = schema.parse(json);

    const currentPasswordRow = await db
      .selectFrom("userPasswords")
      .select(["passwordHash"])
      .where("userId", "=", user.id)
      .limit(1)
      .executeTakeFirst();

    if (!currentPasswordRow) {
      return Response.json(
        {
          error:
            "Password authentication is not configured for this account. Contact an administrator.",
          code: "password_not_configured",
        },
        { status: 400 }
      );
    }

    const currentPasswordValid = await compare(
      currentPassword,
      currentPasswordRow.passwordHash
    );

    if (!currentPasswordValid) {
      return Response.json(
        { error: "Current password is invalid.", code: "invalid_current_password" },
        { status: 401 }
      );
    }

    const samePassword = await compare(newPassword, currentPasswordRow.passwordHash);
    if (samePassword) {
      return Response.json(
        {
          error: "New password must be different from the current password.",
          code: "same_password",
        },
        { status: 400 }
      );
    }

    const passwordHash = await generatePasswordHash(newPassword);
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("userPasswords")
        .set({
          passwordHash,
          createdAt: now,
        })
        .where("userId", "=", user.id)
        .execute();

      await trx
        .updateTable("users")
        .set({
          mustChangePassword: false,
          updatedAt: now,
          updatedBy: user.id,
        })
        .where("id", "=", user.id)
        .execute();

      // Revoke all other active sessions for this user.
      await trx
        .deleteFrom("sessions")
        .where("userId", "=", user.id)
        .where("id", "!=", session.id)
        .execute();
    });

    const response = Response.json({
      success: true,
      message: "Password updated successfully.",
    });

    await setServerSession(response, {
      id: session.id,
      createdAt: session.createdAt,
      lastAccessed: Date.now(),
      passwordChangeRequired: false,
    });

    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    return Response.json({ error: "Failed to change password." }, { status: 400 });
  }
}
