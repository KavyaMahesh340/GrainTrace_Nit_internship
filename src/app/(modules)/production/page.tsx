import type { Metadata } from "next";
import { ModulePage } from "@/components/system/module-page";

export const metadata: Metadata = { title: "Production" };

export default function ProductionPage({
  searchParams,
}: {
  searchParams: { exception?: string; focus?: string };
}) {
  return (
    <ModulePage
      code="06"
      title="Production"
      description="Production batches consume raw material and create finished goods. Weighing, yield, exceptions, and batch records are Phase 2 workflows."
      focusLabel="Exception reference"
      focusValue={searchParams.exception ?? searchParams.focus}
    />
  );
}
