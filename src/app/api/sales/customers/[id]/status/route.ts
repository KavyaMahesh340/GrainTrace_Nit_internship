import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { updateCustomerStatus } from "@/lib/workflows/customers";
import { customerStatusSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("orders:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const status = customerStatusSchema.parse((body as { status?: unknown }).status);
    const result = updateCustomerStatus(actor, Number(params.id), status);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
