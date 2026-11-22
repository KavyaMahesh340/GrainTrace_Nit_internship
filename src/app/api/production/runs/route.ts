import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createProductionRun, listProductionRuns } from "@/lib/workflows/production";
import type { ProductionRunInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("production:view");
  if (actor instanceof NextResponse) return actor;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const query = searchParams.get("query") ?? undefined;
  return NextResponse.json({ ok: true, runs: listProductionRuns(actor.factoryId, { status, query }) });
}

export async function POST(request: Request) {
  const actor = requireApiActor("production:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const result = createProductionRun(actor, body as ProductionRunInput);
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
