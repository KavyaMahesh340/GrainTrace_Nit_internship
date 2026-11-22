import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { cancelInvoice } from "@/lib/workflows/invoices";
import { invoiceCancelSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("invoices:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const input = invoiceCancelSchema.parse(body);
    const detail = cancelInvoice(actor, decodeURIComponent(params.id), input);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
