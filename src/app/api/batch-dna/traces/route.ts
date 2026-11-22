import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { listBatchDnaRuns } from "@/lib/workflows/batch-dna";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("batchDna:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, batches: listBatchDnaRuns(actor.factoryId) });
}
