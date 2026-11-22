import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { syncSalesOrder } from "@/lib/workflows/sales";
import { offlineOrderSyncSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = requireApiActor("orders:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const input = offlineOrderSyncSchema.parse(body);
    const result = syncSalesOrder(actor, input);
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
