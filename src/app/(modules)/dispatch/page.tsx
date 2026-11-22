import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Dispatch" };

export default function DispatchPage({ searchParams }: { searchParams: { focus?: string } }) {
  return (
    <ModulePage
      code="09"
      title="Dispatch"
      description="Finished goods leave the factory against an invoice. Vehicle, challan, and delivery confirmation are Phase 2 workflows."
      focusLabel="Dispatch reference"
      focusValue={searchParams.focus}
    />
  );
}
