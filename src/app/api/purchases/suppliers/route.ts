import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createSupplier, listSuppliers } from "@/lib/workflows/purchases";
import type { SupplierInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("purchases:view");
  if (actor instanceof NextResponse) {
    return actor;
  }

  return NextResponse.json({ ok: true, suppliers: listSuppliers(actor.factoryId) });
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
    const supplier = createSupplier(actor, body as SupplierInput);
    return NextResponse.json({ ok: true, supplier }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
