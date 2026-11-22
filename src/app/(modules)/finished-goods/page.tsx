import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Finished goods" };

export default function FinishedGoodsPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="07"
      title="Finished goods"
      description="Production output lands in finished-goods stock. Packet-level traceability and dispatch readiness are Phase 2 workflows."
      focusLabel="Batch reference"
      focusValue={searchParams.focus}
    />
  );
}
