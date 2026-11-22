import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getProductionOverview } from "@/lib/workflows/production";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("production:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, overview: getProductionOverview(actor.factoryId) });
}
