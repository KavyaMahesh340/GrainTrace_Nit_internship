import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createInventoryAdjustment, listInventoryAdjustments } from "@/lib/workflows/inventory";
import type { InventoryAdjustmentInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("inventory:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  return NextResponse.json({ ok: true, adjustments: listInventoryAdjustments(actor.factoryId) });
}

export async function POST(request: Request) {
  const actor = requireApiActor("inventory:manage");
  if (actor instanceof NextResponse) {
    return actor;
  }

  const body = await readApiJson(request);
  if (body instanceof NextResponse) {
    return body;
  }

  try {
    const adjustment = createInventoryAdjustment(actor, body as InventoryAdjustmentInput);
    return NextResponse.json({ ok: true, adjustment }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
