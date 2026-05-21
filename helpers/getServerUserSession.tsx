import { db } from "./db";
import { User } from "./User";

import {
  CleanupProbability,
  getServerSessionOrThrow,
  NotAuthenticatedError,
  SessionExpirationSeconds,
} from "./getSetServerSession";

const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

type SessionUserResult = {
  user: User;
  session: {
    id: string;
    createdAt: number;
    lastAccessed: number;
    passwordChangeRequired?: boolean;
  };
  mustChangePassword: boolean;
};

const requestSessionCache = new WeakMap<Request, Promise<SessionUserResult>>();

export async function getServerUserSession(request: Request) {
  const cached = requestSessionCache.get(request);
  if (cached) {
    return cached;
  }

  const loadPromise = (async (): Promise<SessionUserResult> => {
    const session = await getServerSessionOrThrow(request);

    // Occasionally clean up expired sessions
    if (Math.random() < CleanupProbability) {
      const expirationDate = new Date(
        Date.now() - SessionExpirationSeconds * 1000
      );
      try {
        await db
          .deleteFrom("sessions")
          .where("lastAccessed", "<", expirationDate)
          .execute();
      } catch (cleanupError) {
        // Log but don't fail the request if cleanup fails
        console.error("Session cleanup error:", cleanupError);
      }
    }

    // Query the sessions and users tables in a single join query
    const results = await db
      .selectFrom("sessions")
      .innerJoin("users", "sessions.userId", "users.id")
      .select([
        "sessions.id as sessionId",
        "sessions.createdAt as sessionCreatedAt",
        "sessions.lastAccessed as sessionLastAccessed",
        "users.id",
        "users.email",
        "users.displayName",
        "users.role",
        "users.avatarUrl",
        "users.setorId",
        "users.isActive",
        "users.mustChangePassword",
      ])
      .where("sessions.id", "=", session.id)
      .limit(1)
      .execute();

    if (results.length === 0) {
      throw new NotAuthenticatedError();
    }

    const result = results[0];

    if (!result.isActive) {
      throw new NotAuthenticatedError("Account is inactive");
    }

    const user = {
      id: result.id,
      email: result.email,
      displayName: result.displayName,
      avatarUrl: result.avatarUrl,
      role: result.role,
      setorId: result.setorId ?? null,
    };

    const nowMs = Date.now();
    const lastAccessedMs = result.sessionLastAccessed
      ? new Date(result.sessionLastAccessed).getTime()
      : session.lastAccessed;
    const shouldTouchSession =
      !Number.isFinite(lastAccessedMs) ||
      nowMs - lastAccessedMs >= SESSION_TOUCH_INTERVAL_MS;

    if (shouldTouchSession) {
      await db
        .updateTable("sessions")
        .set({ lastAccessed: new Date(nowMs) })
        .where("id", "=", session.id)
        .execute();
    }

    return {
      user: user satisfies User,
      session: {
        ...session,
        lastAccessed: shouldTouchSession
          ? nowMs
          : Number.isFinite(lastAccessedMs)
            ? lastAccessedMs
            : session.lastAccessed,
      },
      mustChangePassword: Boolean(result.mustChangePassword),
    };
  })();

  requestSessionCache.set(request, loadPromise);
  return loadPromise;
}
