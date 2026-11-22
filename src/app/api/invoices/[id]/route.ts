import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getInvoiceDetail } from "@/lib/workflows/invoices";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("invoices:view");
  if (actor instanceof NextResponse) return actor;
  const detail = getInvoiceDetail(actor.factoryId, decodeURIComponent(params.id));
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, detail });
}
