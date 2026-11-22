import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getSalesInvoiceCandidates } from "@/lib/workflows/invoices";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("invoices:view");
  if (actor instanceof NextResponse) return actor;
  const orderNumber = new URL(request.url).searchParams.get("orderNumber");
  if (!orderNumber) {
    return NextResponse.json({ ok: true, lines: [] });
  }
  const lines = getSalesInvoiceCandidates(actor.factoryId, orderNumber);
  if (!lines) {
    return NextResponse.json({ ok: false, error: "Sales order not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lines });
}
