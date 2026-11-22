import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createCustomer, listCustomers } from "@/lib/workflows/customers";
import type { CustomerInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET() {
  const actor = requireApiActor("orders:view");
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json({ ok: true, customers: listCustomers(actor.factoryId) });
}

export async function POST(request: Request) {
  const actor = requireApiActor("orders:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const customer = createCustomer(actor, body as CustomerInput);
    return NextResponse.json({ ok: true, customer }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
