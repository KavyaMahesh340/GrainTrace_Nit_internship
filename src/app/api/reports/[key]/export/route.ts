import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { reportFileBase, reportToCsv, reportToXlsx, type ReportExportFormat } from "@/lib/exports/report-export";
import { ReportPdfDocument } from "@/lib/exports/report-pdf-document";
import { requireApiActor } from "@/lib/workflows/api";
import { formatReportCell, getReport, parseReportKey } from "@/lib/workflows/reports";
import { reportFilterSchema } from "@/lib/workflows/validation";

export const runtime = "nodejs";

const FORMATS: ReportExportFormat[] = ["csv", "xlsx", "pdf"];

export async function GET(request: Request, { params }: { params: { key: string } }) {
  const actor = requireApiActor("reports:export");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (!FORMATS.includes(format as ReportExportFormat)) {
    return NextResponse.json({ ok: false, error: "Unsupported export format." }, { status: 400 });
  }

  const rawFilters = Object.fromEntries(
    Array.from(url.searchParams.entries()).filter(([key, value]) => key !== "format" && value !== ""),
  );
  const filters = reportFilterSchema.parse(rawFilters);
  const report = getReport(actor.factoryId, parseReportKey(params.key), filters);
  const filename = `${reportFileBase(report)}.${format}`;

  if (format === "csv") {
    return new NextResponse(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await reportToXlsx(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const headers = report.columns.map((column) => column.label);
  const rows = report.rows.map((row) =>
    report.columns.map((column) => formatReportCell(row[column.key] ?? null, column.kind)),
  );
  const buffer = await renderToBuffer(
    createElement(ReportPdfDocument, {
      title: `GrainTrace · ${report.label}`,
      author: "GrainTrace",
      report,
      headers,
      rows,
    }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
