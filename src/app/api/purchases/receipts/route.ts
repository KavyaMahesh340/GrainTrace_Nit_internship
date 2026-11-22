import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createGoodsReceipt, listGoodsReceipts } from "@/lib/workflows/purchases";
import type { GoodsReceiptInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("purchases:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  return NextResponse.json({ ok: true, receipts: listGoodsReceipts(actor.factoryId) });
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
    const receipt = createGoodsReceipt(actor, body as GoodsReceiptInput);
    return NextResponse.json({ ok: true, receipt }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
