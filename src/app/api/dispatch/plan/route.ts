import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getDispatchPlan } from "@/lib/workflows/dispatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("dispatch:view");
  if (actor instanceof NextResponse) return actor;
  const orderNumber = new URL(request.url).searchParams.get("orderNumber");
  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "Enter an order reference." }, { status: 400 });
  }
  const plan = getDispatchPlan(actor.factoryId, orderNumber);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "Sales order not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, plan });
}
