import "server-only";
import ExcelJS from "exceljs";
import { formatReportCell, type ReportDefinition } from "@/lib/workflows/reports";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export function reportFileBase(report: ReportDefinition) {
  return `${report.key}-${report.generatedAt.slice(0, 10)}`;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function filterDescription(report: ReportDefinition) {
  const filters = report.filters;
  const parts: string[] = [];
  if (filters.dateFrom) parts.push(`From ${filters.dateFrom.slice(0, 10)}`);
  if (filters.dateTo) parts.push(`To ${filters.dateTo.slice(0, 10)}`);
  if (filters.customerId) parts.push(`Customer ${filters.customerId}`);
  if (filters.productId) parts.push(`Product ${filters.productId}`);
  if (filters.category) parts.push(`Category ${filters.category}`);
  return parts.length > 0 ? parts.join(" · ") : "All records";
}

export function reportToCsv(report: ReportDefinition): string {
  const lines: string[][] = [
    ["GRAINTRACE REPORT", report.label],
    ["Generated", report.generatedAt],
    ["Filters", filterDescription(report)],
    [],
    report.columns.map((column) => column.label),
    ...report.rows.map((row) =>
      report.columns.map((column) => formatReportCell(row[column.key] ?? null, column.kind)),
    ),
    [],
    ["Summary", "Value"],
    ...report.summaries.map((summary) => [summary.label, summary.value]),
  ];
  return lines.map((line) => line.map((cell) => escapeCsv(cell)).join(",")).join("\r\n");
}

export async function reportToXlsx(report: ReportDefinition): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GrainTrace";
  workbook.created = new Date(report.generatedAt);
  const sheet = workbook.addWorksheet(report.label.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.addRow(["GRAINTRACE REPORT", report.label]);
  sheet.addRow(["Generated", report.generatedAt]);
  sheet.addRow(["Filters", filterDescription(report)]);
  sheet.addRow([]);
  sheet.addRow(report.columns.map((column) => column.label));
  for (const row of report.rows) {
    sheet.addRow(report.columns.map((column) => row[column.key] ?? ""));
  }
  sheet.addRow([]);
  sheet.addRow(["Summary", "Value"]);
  for (const summary of report.summaries) {
    sheet.addRow([summary.label, summary.value]);
  }

  sheet.columns = report.columns.map((column) => ({ width: Math.max(14, column.label.length + 4) }));
  const headerRow = sheet.getRow(5);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D2B25" } };
  sheet.getRow(1).font = { bold: true, size: 14 };
  const summaryHeader = sheet.getRow(report.rows.length + 7);
  summaryHeader.font = { bold: true };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string") cell.alignment = { vertical: "middle", wrapText: false };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
