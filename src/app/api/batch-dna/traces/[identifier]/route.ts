import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getBatchTrace } from "@/lib/workflows/batch-dna";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { identifier: string } }) {
  const actor = requireApiActor("batchDna:view");
  if (actor instanceof NextResponse) return actor;
  const trace = getBatchTrace(actor.factoryId, decodeURIComponent(params.identifier));
  if (!trace) {
    return NextResponse.json({ ok: false, error: "Batch trace not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, trace });
}
