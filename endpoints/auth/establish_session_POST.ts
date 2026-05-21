import { db } from "../../helpers/db";
import { schema } from "./establish_session_POST.schema";
import { setServerSession } from "../../helpers/getSetServerSession";
import { randomBytes } from "crypto";

export async function handle(request: Request) {
  try {
    const json = await request.json();

    const { tempToken } = schema.parse(json);

    // We reuse the session table for temporary tokens, with a much shorter lifetime
    const tempSession = await db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", tempToken)
      .limit(1)
      .executeTakeFirst();

    if (!tempSession) {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Check if session is expired
    const now = new Date();
    if (tempSession.expiresAt < now) {
      // Clean up expired session
      await db
        .deleteFrom("sessions")
        .where("id", "=", tempSession.id)
        .execute();

      return Response.json({ error: "Token has expired" }, { status: 400 });
    }

    // Fetch the user by userId from the session record
    const user = await db
      .selectFrom("users")
      .select([
        "id",
        "email",
        "displayName",
        "avatarUrl",
        "setorId",
        "role",
        "isActive",
        "mustChangePassword",
      ])
      .where("id", "=", tempSession.userId)
      .executeTakeFirst();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }

    if (!user.isActive) {
      await db.deleteFrom("sessions").where("id", "=", tempSession.id).execute();
      return Response.json(
        { error: "Account is inactive. Contact an administrator." },
        { status: 403 }
      );
    }

    // Delete the temp session immediately to make it single-use
    await db.deleteFrom("sessions").where("id", "=", tempSession.id).execute();

    // Create a new proper session with a different session ID
    const newSessionId = randomBytes(32).toString("hex");
    const sessionCreatedAt = new Date();
    const sessionExpiresAt = new Date(
      sessionCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000
    ); // 7 days

    await db
      .insertInto("sessions")
      .values({
        id: newSessionId,
        userId: user.id,
        createdAt: sessionCreatedAt,
        lastAccessed: sessionCreatedAt,
        expiresAt: sessionExpiresAt,
      })
      .execute();

    await db
      .updateTable("users")
      .set({
        lastLoginAt: sessionCreatedAt,
        updatedAt: sessionCreatedAt,
        updatedBy: user.id,
      })
      .where("id", "=", user.id)
      .execute();

    // Create response with user data
    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      setorId: user.setorId ?? null,
      role: user.role,
    };

    const response = Response.json({
      user: userData,
      success: true,
    });

    // Set the session cookie with the new session ID
    await setServerSession(response, {
      id: newSessionId,
      createdAt: sessionCreatedAt.getTime(),
      lastAccessed: sessionCreatedAt.getTime(),
      passwordChangeRequired: user.mustChangePassword,
    });

    return response;
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
