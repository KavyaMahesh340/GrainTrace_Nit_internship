import type { Metadata } from "next";
import { BatchDnaWorkspace } from "@/components/batch-dna/batch-dna-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getBatchTrace, listBatchDnaRuns } from "@/lib/workflows/batch-dna";

export const metadata: Metadata = { title: "Batch DNA" };

export default async function BatchDnaPage({
  searchParams,
}: {
  searchParams: { batch?: string; run?: string };
}) {
  const { user } = requirePermission("batchDna:view");
  const identifier = searchParams.batch ?? searchParams.run;

  return (
    <BatchDnaWorkspace
      initialBatches={listBatchDnaRuns(user.factoryId)}
      initialTrace={identifier ? getBatchTrace(user.factoryId, identifier) : null}
      initialIdentifier={identifier}
    />
  );
}
