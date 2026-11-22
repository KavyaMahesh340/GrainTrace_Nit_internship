import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiActor } from "@/lib/workflows/api";
import { listAuditEntries } from "@/lib/workflows/audit-explorer";
import { auditFilterSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("audit:view");
  if (actor instanceof NextResponse) return actor;

  try {
    const url = new URL(request.url);
    const rawFilters = Object.fromEntries(Array.from(url.searchParams.entries()).filter(([, value]) => value !== ""));
    const filters = auditFilterSchema.parse(rawFilters);
    return NextResponse.json({ ok: true, entries: listAuditEntries(actor.factoryId, filters) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
