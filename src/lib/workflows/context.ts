import "server-only";
import type { Permission, RoleName } from "@/lib/auth/permissions";

export type WorkflowActor = {
  userId: number;
  factoryId: number;
  email: string;
  role: RoleName;
  permissions: Permission[];
  sessionId?: number;
};

export class WorkflowAuthorizationError extends Error {
  readonly status = 403;

  constructor(permission: Permission) {
    super(`Missing permission: ${permission}.`);
    this.name = "WorkflowAuthorizationError";
  }
}

export function requireActorPermission(actor: WorkflowActor, permission: Permission) {
  if (!actor.permissions.includes(permission)) {
    throw new WorkflowAuthorizationError(permission);
  }
}
