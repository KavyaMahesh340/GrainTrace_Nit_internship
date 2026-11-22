import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { correctPayment } from "@/lib/workflows/payments";
import { paymentCorrectionSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = requireApiActor("payments:correct");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const input = paymentCorrectionSchema.parse(body);
    const correction = correctPayment(actor, input);
    return NextResponse.json({ ok: true, correction }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
