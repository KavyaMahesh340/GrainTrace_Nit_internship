import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/workflows/purchases";
import type { PurchaseOrderInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("purchases:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const params = new URL(request.url).searchParams;
  const orders = listPurchaseOrders(actor.factoryId, {
    status: params.get("status") ?? undefined,
    query: params.get("query") ?? undefined,
  });
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const actor = requireApiActor("purchases:manage");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const body = await readApiJson(request);
  if (body instanceof NextResponse) {
    return body;
  }

  try {
    const order = createPurchaseOrder(actor, body as PurchaseOrderInput);
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
