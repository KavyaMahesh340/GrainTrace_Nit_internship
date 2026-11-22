import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getInvoiceOptions } from "@/lib/workflows/invoices";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("invoices:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, options: getInvoiceOptions(actor.factoryId) });
}
