import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createInvoice, listInvoices } from "@/lib/workflows/invoices";
import { invoiceInputSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("invoices:view");
  if (actor instanceof NextResponse) return actor;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    ok: true,
    invoices: listInvoices(actor.factoryId, {
      status: searchParams.get("status") ?? undefined,
      query: searchParams.get("query") ?? undefined,
    }),
  });
}

export async function POST(request: Request) {
  const actor = requireApiActor("invoices:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const invoice = createInvoice(actor, invoiceInputSchema.parse(body));
    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
