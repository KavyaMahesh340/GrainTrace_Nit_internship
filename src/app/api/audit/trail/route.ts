import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getAuditorTrail } from "@/lib/workflows/audit-explorer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("audit:view");
  if (actor instanceof NextResponse) return actor;

  const identifier = new URL(request.url).searchParams.get("identifier")?.trim();
  if (!identifier) {
    return NextResponse.json({ ok: false, error: "Enter an invoice or batch reference." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, trail: getAuditorTrail(actor.factoryId, identifier) });
}
