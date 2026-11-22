import { auditLog } from "@/lib/db/schema";
import type { WorkflowTransaction } from "./db";
import type { WorkflowActor } from "./context";

type AuditSeverity = "info" | "warning" | "critical";

type AuditOptions = {
  actorRole?: string;
  reason?: string;
  severity?: AuditSeverity;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export function recordAudit(
  tx: WorkflowTransaction,
  actor: WorkflowActor,
  action: string,
  entityType: string,
  entityId: number,
  metadata: Record<string, unknown> = {},
  options: AuditOptions = {},
) {
  tx.insert(auditLog)
    .values({
      factoryId: actor.factoryId,
      userId: actor.userId,
      sessionId: actor.sessionId ?? null,
      actorEmail: actor.email,
      actorRole: options.actorRole ?? actor.role,
      action,
      entityType,
      entityId,
      severity: options.severity ?? "info",
      reason: options.reason ?? null,
      beforeJson: options.before ? JSON.stringify(options.before) : null,
      afterJson: options.after ? JSON.stringify(options.after) : null,
      metadataJson: JSON.stringify(metadata),
    })
    .run();
}
