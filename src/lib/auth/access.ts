import "server-only";
import { redirect } from "next/navigation";
import type { Permission } from "./permissions";
import { getSession } from "./session";
import type { SessionUser } from "./types";

export type AuthenticatedContext = {
  sessionId: number;
  expiresAt: string;
  user: SessionUser;
};

export function requireSession(): AuthenticatedContext {
  const session = getSession();

  if (session.status === "absent") {
    redirect("/login");
  }

  if (session.status === "invalid") {
    redirect("/session-expired");
  }

  return {
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    user: session.user,
  };
}

export function requirePermission(permission: Permission): AuthenticatedContext {
  const context = requireSession();

  if (!context.user.permissions.includes(permission)) {
    redirect("/unauthorized");
  }

  return context;
}
