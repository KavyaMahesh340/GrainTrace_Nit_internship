import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Production" };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: { exception?: string; focus?: string };
}) {
  requirePermission("production:view");
  return (
    <ProtectedModulePage
      permission="production:view"
      code="06"
      title="Production"
      description="Production batches consume raw material and create finished goods. Weighing, yield, exceptions, and batch records are Phase 2 workflows."
      focusLabel="Exception reference"
      focusValue={searchParams.exception ?? searchParams.focus}
    />
  );
}
