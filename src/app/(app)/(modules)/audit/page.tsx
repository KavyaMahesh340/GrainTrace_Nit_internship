import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Audit" };

export default async function AuditPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("audit:view");
  return (
    <ProtectedModulePage
      permission="audit:view"
      code="11"
      title="Audit"
      description="Every quantity and transaction must remain accountable. The immutable audit trail and reconciliation views are Phase 2 workflows."
      focusLabel="Audit reference"
      focusValue={searchParams.focus}
    />
  );
}
