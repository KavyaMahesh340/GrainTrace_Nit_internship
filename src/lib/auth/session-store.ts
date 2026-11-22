import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { roles, sessions, users } from "@/lib/db/schema";
import { SESSION_DURATION_MS } from "./constants";
import { landingPathFor, permissionsFor, ROLE_LABELS } from "./permissions";
import type { SessionUser } from "./types";
import { roleNameSchema, sessionTokenSchema } from "./validation";

export type SessionResolution =
  | { status: "absent" }
  | { status: "invalid" }
  | {
      status: "authenticated";
      sessionId: number;
      expiresAt: string;
      user: SessionUser;
    };

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: number) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  getDb()
    .insert(sessions)
    .values({ userId, tokenHash: hashSessionToken(token), expiresAt })
    .run();

  return { token, expiresAt };
}

export function resolveSessionToken(token: string | undefined | null): SessionResolution {
  if (!token) {
    return { status: "absent" };
  }

  const parsedToken = sessionTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return { status: "invalid" };
  }

  const row = getDb()
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      userStatus: users.status,
      role: roles.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(sessions.tokenHash, hashSessionToken(parsedToken.data)))
    .get();

  if (!row || row.revokedAt || row.userStatus !== "active") {
    return { status: "invalid" };
  }

  const expiresAtMs = new Date(row.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { status: "invalid" };
  }

  const parsedRole = roleNameSchema.safeParse(row.role);
  if (!parsedRole.success) {
    return { status: "invalid" };
  }

  const role = parsedRole.data;

  return {
    status: "authenticated",
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      email: row.email,
      fullName: row.fullName,
      role,
      roleLabel: ROLE_LABELS[role],
      permissions: permissionsFor(role),
      landingPath: landingPathFor(role),
    },
  };
}

export function revokeSessionToken(token: string | undefined | null) {
  if (!token) {
    return;
  }

  const parsedToken = sessionTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return;
  }

  getDb()
    .update(sessions)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(sessions.tokenHash, hashSessionToken(parsedToken.data)))
    .run();
}

export function pruneExpiredSessions() {
  getDb()
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date().toISOString()))
    .run();
}
