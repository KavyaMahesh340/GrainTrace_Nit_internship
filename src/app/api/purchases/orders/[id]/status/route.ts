import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { updatePurchaseOrderStatus } from "@/lib/workflows/purchases";
import { purchaseOrderStatusSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("purchases:manage");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const body = await readApiJson(request);
  if (body instanceof NextResponse) {
    return body;
  }

  try {
    const status = purchaseOrderStatusSchema.parse((body as { status?: unknown }).status);
    const result = updatePurchaseOrderStatus(actor, params.id, status);
    return NextResponse.json({ ok: true, order: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
