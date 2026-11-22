import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getInventoryOverview } from "@/lib/workflows/inventory";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("inventory:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  return NextResponse.json({ ok: true, overview: getInventoryOverview(actor.factoryId) });
}
