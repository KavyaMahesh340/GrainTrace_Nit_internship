import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getDispatchDetail } from "@/lib/workflows/dispatch";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("dispatch:view");
  if (actor instanceof NextResponse) return actor;
  const detail = getDispatchDetail(actor.factoryId, params.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Dispatch not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}
