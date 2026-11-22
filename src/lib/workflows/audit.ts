import { auditLog } from "@/lib/db/schema";
import type { WorkflowTransaction } from "./db";
import type { WorkflowActor } from "./context";

export function recordAudit(
  tx: WorkflowTransaction,
  actor: WorkflowActor,
  action: string,
  entityType: string,
  entityId: number,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  tx.insert(auditLog)
    .values({
      factoryId: actor.factoryId,
      userId: actor.userId,
      sessionId: actor.sessionId ?? null,
      actorEmail: actor.email,
      action,
      entityType,
      entityId,
      severity: "info",
      metadataJson: JSON.stringify(metadata),
    })
    .run();
}
