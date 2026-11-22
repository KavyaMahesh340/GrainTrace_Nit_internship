import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { listCollections } from "@/lib/workflows/payments";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("payments:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, collections: listCollections(actor.factoryId) });
}
