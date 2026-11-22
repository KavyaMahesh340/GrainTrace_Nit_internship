import { NextResponse } from "next/server";
import { apiErrorResponse, readApiJson, requireApiActor } from "@/lib/workflows/api";
import { updateProductionRunStatus } from "@/lib/workflows/production";
import { productionStatusSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = requireApiActor("production:manage");
  if (actor instanceof NextResponse) return actor;
  const body = await readApiJson(request);
  if (body instanceof NextResponse) return body;
  try {
    const status = productionStatusSchema.parse((body as { status?: unknown }).status);
    const result = updateProductionRunStatus(actor, params.id, status);
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
