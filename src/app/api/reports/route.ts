import { NextResponse } from "next/server";
import { requireApiActor } from "@/lib/workflows/api";
import { getReport, getReportOptions, parseReportKey, REPORT_CATALOG } from "@/lib/workflows/reports";
import { reportFilterSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = requireApiActor("reports:view");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(request.url);
  const rawFilters = Object.fromEntries(Array.from(url.searchParams.entries()).filter(([, value]) => value !== ""));
  const filters = reportFilterSchema.parse(rawFilters);
  const key = parseReportKey(url.searchParams.get("report") ?? undefined);

  return NextResponse.json({
    ok: true,
    catalog: REPORT_CATALOG,
    options: getReportOptions(actor.factoryId),
    report: getReport(actor.factoryId, key, filters),
  });
}
