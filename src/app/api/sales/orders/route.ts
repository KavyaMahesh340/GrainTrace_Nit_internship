import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createSalesOrder, listSalesOrders } from "@/lib/workflows/sales";
import type { SalesOrderInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("orders:view");
  if (actor instanceof NextResponse) return actor;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    ok: true,
    orders: listSalesOrders(actor.factoryId, {
      status: searchParams.get("status") ?? undefined,
      query: searchParams.get("query") ?? undefined,
    }),
  });
}

export async function POST(request: Request) {
  const actor = requireApiActor("orders:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const order = createSalesOrder(actor, body as SalesOrderInput);
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
