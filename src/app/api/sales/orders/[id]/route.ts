import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getSalesOrderDetail } from "@/lib/workflows/sales";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("orders:view");
  if (actor instanceof NextResponse) return actor;
  const detail = getSalesOrderDetail(actor.factoryId, params.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Sales order not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}
