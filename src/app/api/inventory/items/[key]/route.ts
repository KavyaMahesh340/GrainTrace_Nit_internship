import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getInventoryDetail } from "@/lib/workflows/inventory";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { key: string } }) {
  const actor = requireApiActor("inventory:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const detail = getInventoryDetail(actor.factoryId, params.key);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Inventory item not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, detail });
}
