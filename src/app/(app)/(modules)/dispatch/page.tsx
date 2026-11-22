import type { Metadata } from "next";
import { ProtectedModulePage } from "@/components/system/protected-module-page";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage({ searchParams }: { searchParams: { focus?: string } }) {
  requirePermission("dispatch:view");
  return (
    <ProtectedModulePage
      permission="dispatch:view"
      code="09"
      title="Dispatch"
      description="Finished goods leave the factory against an invoice. Vehicle, challan, and delivery confirmation are planned workflows."
      focusLabel="Dispatch reference"
      focusValue={searchParams.focus}
    />
  );
}
