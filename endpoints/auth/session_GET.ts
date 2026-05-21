import {
  setServerSession,
  NotAuthenticatedError,
} from "../../helpers/getSetServerSession";
import { User } from "../../helpers/User";
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user, session } = await getServerUserSession(request);
    const lastAccessedTimestamp =
      typeof session.lastAccessed === "number"
        ? session.lastAccessed
        : new Date(session.lastAccessed).getTime();

    // Create response with user data
    const response = Response.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        setorId: user.setorId ?? null,
      } satisfies User,
      passwordChangeRequired: Boolean(session.passwordChangeRequired),
    });

    // Update the session cookie with the new lastAccessed time
    await setServerSession(response, {
      id: session.id,
      createdAt: session.createdAt,
      lastAccessed: lastAccessedTimestamp,
      passwordChangeRequired: session.passwordChangeRequired,
    });

    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    console.error("Session validation error:", error);
    return Response.json(
      { error: "Session validation failed" },
      { status: 400 }
    );
  }
}
