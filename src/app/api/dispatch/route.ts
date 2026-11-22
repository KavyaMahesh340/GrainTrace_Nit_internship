import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { createDispatch, listDispatches } from "@/lib/workflows/dispatch";
import type { DispatchInput } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("dispatch:view");
  if (actor instanceof NextResponse) return actor;
  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    ok: true,
    dispatches: listDispatches(actor.factoryId, {
      status: searchParams.get("status") ?? undefined,
      query: searchParams.get("query") ?? undefined,
    }),
  });
}

export async function POST(request: Request) {
  const actor = requireApiActor("dispatch:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const dispatch = createDispatch(actor, body as DispatchInput);
    return NextResponse.json({ ok: true, dispatch }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
