import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getProductionOptions } from "@/lib/workflows/production";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("production:manage");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, options: getProductionOptions(actor.factoryId) });
}
