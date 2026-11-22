import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getPurchaseOrderDetail } from "@/lib/workflows/purchases";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("purchases:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const order = getPurchaseOrderDetail(actor.factoryId, params.id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Purchase order not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order });
}
