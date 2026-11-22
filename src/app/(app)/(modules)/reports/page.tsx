import type { Metadata } from "next";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { requirePermission } from "@/lib/auth/access";
import {
  getReport,
  getReportOptions,
  parseReportKey,
  REPORT_CATALOG,
} from "@/lib/workflows/reports";
import { reportFilterSchema } from "@/lib/workflows/validation";

export const metadata: Metadata = { title: "Reports" };

type SearchParams = {
  report?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  productId?: string;
  category?: string;
};

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = requirePermission("reports:view");
  const key = parseReportKey(searchParams.report);
  const rawFilters = Object.fromEntries(
    Object.entries(searchParams).filter(([name, value]) => name !== "report" && Boolean(value)),
  );
  const filters = reportFilterSchema.parse(rawFilters);

  return (
    <ReportsWorkspace
      initialReport={getReport(user.factoryId, key, filters)}
      catalog={REPORT_CATALOG.map((item) => ({ ...item }))}
      options={getReportOptions(user.factoryId)}
      canExport={user.permissions.includes("reports:export")}
    />
  );
}
