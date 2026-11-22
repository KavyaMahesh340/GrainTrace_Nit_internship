import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getSalesOptions, getSalesOverview } from "@/lib/workflows/sales";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("orders:view");
  if (actor instanceof NextResponse) return actor;
  const type = new URL(request.url).searchParams.get("type");
  if (type === "overview") {
    return NextResponse.json({ ok: true, overview: getSalesOverview(actor.factoryId) });
  }
  return NextResponse.json({ ok: true, options: getSalesOptions(actor.factoryId) });
}
