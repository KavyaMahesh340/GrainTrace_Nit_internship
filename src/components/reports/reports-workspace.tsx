"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw } from "lucide-react";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricGrid } from "@/components/ui/metric";
import { TableFrame } from "@/components/ui/table-frame";
import { formatPaise } from "@/domain";
import type { ReportColumnKind, ReportDefinition, ReportKey } from "@/lib/workflows/reports";

type CatalogItem = { key: ReportKey; label: string; description: string };

type Options = {
  customers: { id: number; name: string }[];
  products: { id: number; code: string; name: string; category: string }[];
  categories: string[];
};

type Props = {
  initialReport: ReportDefinition;
  catalog: CatalogItem[];
  options: Options;
  canExport: boolean;
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  productId: string;
  category: string;
};

const fieldClass =
  "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";

function toFilters(report: ReportDefinition): Filters {
  return {
    dateFrom: report.filters.dateFrom ?? "",
    dateTo: report.filters.dateTo ?? "",
    customerId: report.filters.customerId ? String(report.filters.customerId) : "",
    productId: report.filters.productId ? String(report.filters.productId) : "",
    category: report.filters.category ?? "",
  };
}

function queryFor(key: ReportKey, filters: Filters) {
  const params = new URLSearchParams({ report: key });
  for (const [name, value] of Object.entries(filters)) {
    if (value) params.set(name, value);
  }
  return params.toString();
}

function formatCell(value: string | number | null, kind: ReportColumnKind) {
  if (value === null) return "";
  if (kind === "paise") return formatPaise(Number(value));
  if (kind === "basis_points") return `${(Number(value) / 100).toFixed(2)}%`;
  return String(value);
}

function isNumericKind(kind: ReportColumnKind) {
  return kind === "paise" || kind === "integer" || kind === "basis_points";
}

export function ReportsWorkspace({ initialReport, catalog, options, canExport }: Props) {
  const [report, setReport] = useState(initialReport);
  const [filters, setFilters] = useState<Filters>(toFilters(initialReport));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCatalog = useMemo(
    () => catalog.find((item) => item.key === report.key) ?? catalog[0],
    [catalog, report.key],
  );
  const exportQuery = queryFor(report.key, filters);

  async function selectReport(key: ReportKey) {
    const nextFilters = { dateFrom: "", dateTo: "", customerId: "", productId: "", category: "" };
    setFilters(nextFilters);
    await loadReport(key, nextFilters);
  }

  async function loadReport(key: ReportKey, nextFilters: Filters = filters) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports?${queryFor(key, nextFilters)}`, { cache: "no-store" });
      const data: { ok?: boolean; report?: ReportDefinition; error?: string } = await response.json();
      if (!response.ok || !data.report) {
        throw new Error(data.error ?? "The report could not be loaded.");
      }
      setReport(data.report);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        code="ACCOUNTABILITY / 13"
        title="Reports & exports."
        description="Ten operational views over the same posted records. Every export uses the filters shown below."
        footnote="Ten views · one filtered record set"
        tone="ledger"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-obsidian/20 bg-obsidian/10">
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Catalog</p>
                <p className="mt-2 font-mono text-2xl tabular">{catalog.length}</p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Rows in view</p>
                <p className="mt-2 font-mono text-2xl tabular">{report.rows.length}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">CSV · XLSX · PDF</Badge>
              <Badge variant={canExport ? "default" : "machine"}>
                {canExport ? "Export enabled" : "View only"}
              </Badge>
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
        {error ? <Notice tone="error" className="mb-8">{error}</Notice> : null}

        <section className="border border-obsidian/15 bg-paper" aria-labelledby="reports-catalog">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/15 px-5 py-4">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">01 / Report catalog</p>
              <h2 id="reports-catalog" className="mt-2 text-xl font-semibold tracking-tight">
                Select a view
              </h2>
            </div>
            <span className="mono-caption text-ink-muted">{catalog.length} registered reports</span>
          </div>
          <div className="grid gap-px bg-obsidian/10 sm:grid-cols-2 lg:grid-cols-5">
            {catalog.map((item, index) => {
              const active = item.key === report.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => void selectReport(item.key)}
                  aria-pressed={active}
                  className={`min-w-0 bg-paper p-4 text-left transition-colors ${
                    active ? "bg-pale-sage" : "hover:bg-sage/40"
                  }`}
                >
                  <span className="mono-label text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-2 block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                    {item.description}
                  </span>
                  {active ? (
                    <span className="mono-label mt-3 block text-rust-ink">In view</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8 border border-obsidian/15 bg-paper" aria-labelledby="reports-filters">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/15 px-5 py-4">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">02 / Filter parameters</p>
              <h2 id="reports-filters" className="mt-2 text-xl font-semibold tracking-tight">
                Narrow the record set
              </h2>
            </div>
            <span className="mono-caption text-ink-muted">Applied on generate</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">FROM</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">TO</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">CUSTOMER</span>
              <select
                value={filters.customerId}
                onChange={(event) => setFilters({ ...filters, customerId: event.target.value })}
                className={fieldClass}
              >
                <option value="">All customers</option>
                {options.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">PRODUCT</span>
              <select
                value={filters.productId}
                onChange={(event) => setFilters({ ...filters, productId: event.target.value })}
                className={fieldClass}
              >
                <option value="">All products</option>
                {options.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mono-label mb-2 block text-ink-muted">CATEGORY</span>
              <select
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                className={fieldClass}
              >
                <option value="">All categories</option>
                {options.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 items-end sm:col-span-2 lg:col-span-5 lg:justify-end">
              <Button onClick={() => void loadReport(report.key, filters)} disabled={busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> Apply filters
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="reports-output">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/15 pb-4">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">03 / Report output</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <h2 id="reports-output" className="text-2xl font-semibold tracking-tight">
                  {report.label}
                </h2>
                <span className="mono-caption text-ink-muted">{activeCatalog.label}</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{report.description}</p>
            </div>
            {canExport ? (
              <div className="flex min-w-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=csv&${exportQuery}`}>
                    <FileText className="h-3 w-3" aria-hidden="true" /> CSV
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=xlsx&${exportQuery}`}>
                    <FileSpreadsheet className="h-3 w-3" aria-hidden="true" /> Excel
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=pdf&${exportQuery}`}>
                    <Printer className="h-3 w-3" aria-hidden="true" /> PDF
                  </a>
                </Button>
              </div>
            ) : (
              <Badge variant="machine">
                <Download className="h-3 w-3" aria-hidden="true" /> View only
              </Badge>
            )}
          </div>

          {report.summaries.length > 0 ? (
            <MetricGrid
              className="mt-5 border border-obsidian/15"
              columns={4}
              items={report.summaries.map((summary) => ({
                label: summary.label.toUpperCase(),
                value: summary.value,
              }))}
            />
          ) : null}

          <TableFrame
            className="mt-6"
            title="Report detail"
            description={`${report.label} · generated ${report.generatedAt.slice(0, 10)}`}
            actions={<span className="mono-caption text-ink-muted">{report.rows.length} rows</span>}
          >
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="mono-label text-ink-muted">
                <tr className="border-b border-obsidian/15">
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={`py-3 pr-5 font-medium ${isNumericKind(column.kind) ? "text-right" : ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={`${report.key}-${index}`} className="data-row align-top">
                    {report.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`py-3 pr-5 ${isNumericKind(column.kind) ? "text-right font-mono tabular" : ""}`}
                      >
                        {formatCell(row[column.key] ?? null, column.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={report.columns.length} className="py-12 text-center text-ink-muted">
                      No records match this report view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableFrame>
        </section>
      </div>
    </div>
  );
}
