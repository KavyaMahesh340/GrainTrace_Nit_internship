import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { listInventory } from "@/lib/workflows/inventory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("inventory:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const params = new URL(request.url).searchParams;
  const items = listInventory(actor.factoryId, {
    category: params.get("category") ?? undefined,
    query: params.get("query") ?? undefined,
    status: params.get("status") ?? undefined,
    sort: params.get("sort") ?? undefined,
  });
  return NextResponse.json({ ok: true, items });
}
