import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Finished goods" };

export default async function FinishedGoodsPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("finishedGoods:view");
  return (
    <ProtectedModulePage
      permission="finishedGoods:view"
      code="07"
      title="Finished goods"
      description="Production output lands in finished-goods stock. Packet-level traceability and dispatch readiness are planned workflows."
      focusLabel="Batch reference"
      focusValue={searchParams.focus}
    />
  );
}
