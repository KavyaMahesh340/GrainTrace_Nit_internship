import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Audit" };

export default function AuditPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="11"
      title="Audit"
      description="Every quantity and transaction must remain accountable. The immutable audit trail and reconciliation views are Phase 2 workflows."
      focusLabel="Audit reference"
      focusValue={searchParams.focus}
    />
  );
}
