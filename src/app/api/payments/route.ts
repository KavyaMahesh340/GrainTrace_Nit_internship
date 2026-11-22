import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createPayment, listPayments } from "@/lib/workflows/payments";
import type { PaymentInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("payments:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, payments: listPayments(actor.factoryId) });
}

export async function POST(request: Request) {
  const actor = requireApiActor("payments:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const payment = createPayment(actor, body as PaymentInput);
    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
