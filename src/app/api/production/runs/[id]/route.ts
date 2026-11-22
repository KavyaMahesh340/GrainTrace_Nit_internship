import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getProductionRunDetail } from "@/lib/workflows/production";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("production:view");
  if (actor instanceof NextResponse) return actor;
  const detail = getProductionRunDetail(actor.factoryId, params.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Production run not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}
