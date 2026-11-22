import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { updateDispatchStatus } from "@/lib/workflows/dispatch";
import { dispatchStatusSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("dispatch:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const status = dispatchStatusSchema.parse((body as { status?: unknown }).status);
    const detail = updateDispatchStatus(actor, params.id, status);
    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
