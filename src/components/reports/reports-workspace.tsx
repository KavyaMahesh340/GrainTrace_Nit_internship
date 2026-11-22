"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">ACCOUNTABILITY / 13</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reports & exports.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Ten operational views over the same posted records. Every export uses the filters shown below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="dark">10 reports</Badge>
            <Badge variant="dark">CSV · XLSX · PDF</Badge>
          </div>
        </div>
      </header>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {catalog.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => void selectReport(item.key)}
              className={`border p-4 text-left transition-colors ${
                item.key === report.key
                  ? "border-forest bg-pale-sage"
                  : "border-obsidian/15 bg-paper hover:border-forest/50"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-machine">{item.description}</p>
            </button>
          ))}
        </section>

        <section className="border border-obsidian/15 bg-paper p-5">
          <div className="flex flex-wrap items-end gap-4">
            <label>
              <span className="mono-label text-machine">FROM</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                className="mt-1"
              />
            </label>
            <label>
              <span className="mono-label text-machine">TO</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                className="mt-1"
              />
            </label>
            <label>
              <span className="mono-label text-machine">CUSTOMER</span>
              <select
                value={filters.customerId}
                onChange={(event) => setFilters({ ...filters, customerId: event.target.value })}
                className="mt-1 h-10 border border-obsidian/20 bg-transparent px-3 text-sm"
              >
                <option value="">All customers</option>
                {options.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mono-label text-machine">PRODUCT</span>
              <select
                value={filters.productId}
                onChange={(event) => setFilters({ ...filters, productId: event.target.value })}
                className="mt-1 h-10 border border-obsidian/20 bg-transparent px-3 text-sm"
              >
                <option value="">All products</option>
                {options.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mono-label text-machine">CATEGORY</span>
              <select
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                className="mt-1 h-10 border border-obsidian/20 bg-transparent px-3 text-sm"
              >
                <option value="">All categories</option>
                {options.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => void loadReport(report.key, filters)} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Apply filters
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mono-label text-machine">{activeCatalog.label.toUpperCase()}</p>
              <h2 className="mt-1 text-2xl font-semibold">{report.label}</h2>
              <p className="mt-1 text-sm text-machine">{report.description}</p>
            </div>
            {canExport ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=csv&${exportQuery}`}>
                    <FileText className="h-3 w-3" /> CSV
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=xlsx&${exportQuery}`}>
                    <FileSpreadsheet className="h-3 w-3" /> Excel
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${report.key}/export?format=pdf&${exportQuery}`}>
                    <Printer className="h-3 w-3" /> PDF
                  </a>
                </Button>
              </div>
            ) : (
              <Badge variant="machine">
                <Download className="h-3 w-3" /> View only
              </Badge>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            {report.summaries.map((summary) => (
              <div key={summary.label} className="border border-obsidian/15 bg-paper px-4 py-3">
                <p className="mono-label text-machine">{summary.label.toUpperCase()}</p>
                <p className="mt-1 font-mono text-lg">{summary.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-4 py-3 font-mono text-[10px] uppercase tracking-label ${
                        column.kind === "paise" || column.kind === "integer" || column.kind === "basis_points"
                          ? "text-right"
                          : ""
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <tr key={`${report.key}-${index}`} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                    {report.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 ${
                          column.kind === "paise" || column.kind === "integer" || column.kind === "basis_points"
                            ? "text-right font-mono"
                            : ""
                        }`}
                      >
                        {formatCell(row[column.key] ?? null, column.kind)}
                      </td>
                    ))}
                  </tr>
                ))}
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={report.columns.length} className="px-4 py-12 text-center text-machine">
                      No records match this report view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
