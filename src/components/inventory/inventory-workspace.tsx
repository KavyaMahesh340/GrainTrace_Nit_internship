"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Search, X } from "lucide-react";
import { MotionTabs } from "@/components/system/motion-tabs";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricGrid } from "@/components/ui/metric";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
import { formatPaise } from "@/domain";
import { formatQuantity } from "@/lib/format";
import type {
  InventoryAdjustmentView,
  InventoryDetail,
  InventoryRow,
} from "@/lib/workflows/inventory";

type Overview = {
  lowStock: InventoryRow[];
  expiring: InventoryRow[];
};

type AdjustmentOption = {
  key: string;
  targetType: "raw" | "packaging" | "finished_good";
  targetId: number;
  label: string;
  baseUnit: "grams" | "pieces";
};

type Props = {
  initialItems: InventoryRow[];
  initialOverview: Overview;
  initialAdjustments: InventoryAdjustmentView[];
  options: AdjustmentOption[];
  canManage: boolean;
};

type View = "stock" | "adjustments";
type Category = "raw" | "packaging" | "finished_good";

const viewItems: readonly { value: View; label: string; hint?: string }[] = [
  { value: "stock", label: "Stock register", hint: "On hand" },
  { value: "adjustments", label: "Adjustment ledger", hint: "Corrections" },
];

const today = new Date().toISOString().slice(0, 10);

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as { ok?: boolean; error?: string } & T;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "The request could not be completed.");
  }
  return data;
}

function statusVariant(status: string) {
  if (status === "out" || status === "low") return "rust";
  if (status === "expiring") return "machine";
  return "default";
}

function fieldClass() {
  return "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";
}

export function InventoryWorkspace({ initialItems, initialOverview, initialAdjustments, options, canManage }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("stock");
  const [category, setCategory] = useState<Category>("raw");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [items, setItems] = useState(initialItems);
  const [overview, setOverview] = useState(initialOverview);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adjustmentDraft, setAdjustmentDraft] = useState({
    adjustmentNumber: "",
    optionKey: options[0]?.key ?? "",
    direction: "decrement" as "increment" | "decrement",
    quantity: "",
    reason: "correction",
    notes: "",
    occurredAt: today,
    unitCostPaise: "",
  });

  const selectedOption = useMemo(
    () => options.find((option) => option.key === adjustmentDraft.optionKey) ?? null,
    [options, adjustmentDraft.optionKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ category, status, sort });
    if (query) {
      params.set("query", query);
    }

    apiRequest<{ items: InventoryRow[] }>(`/api/inventory/items?${params.toString()}`, { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Inventory could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category, query, status, sort]);

  async function refresh() {
    const [itemData, overviewData, adjustmentData] = await Promise.all([
      apiRequest<{ items: InventoryRow[] }>("/api/inventory/items?category=raw"),
      apiRequest<{ overview: Overview }>("/api/inventory/overview"),
      apiRequest<{ adjustments: InventoryAdjustmentView[] }>("/api/inventory/adjustments"),
    ]);
    if (category === "raw") {
      setItems(itemData.items);
    }
    setOverview(overviewData.overview);
    setAdjustments(adjustmentData.adjustments);
    router.refresh();
  }

  async function openDetail(item: InventoryRow) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<{ detail: InventoryDetail }>(
        `/api/inventory/items/${encodeURIComponent(item.key)}`,
      );
      setDetail(data.detail);
      setDetailOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inventory detail could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedOption) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentNumber: adjustmentDraft.adjustmentNumber,
          targetType: selectedOption.targetType,
          targetId: selectedOption.targetId,
          direction: adjustmentDraft.direction,
          baseUnit: selectedOption.baseUnit,
          quantity: Number(adjustmentDraft.quantity),
          reason: adjustmentDraft.reason,
          notes: adjustmentDraft.notes,
          occurredAt: adjustmentDraft.occurredAt,
          ...(adjustmentDraft.direction === "increment"
            ? { unitCostPaise: Number(adjustmentDraft.unitCostPaise) }
            : {}),
        }),
      });
      setAdjustmentOpen(false);
      setAdjustmentDraft({
        adjustmentNumber: "",
        optionKey: options[0]?.key ?? "",
        direction: "decrement",
        quantity: "",
        reason: "correction",
        notes: "",
        occurredAt: today,
        unitCostPaise: "",
      });
      setNotice("Adjustment posted with a linked ledger entry.");
      await refresh();
      if (detailOpen && detail) {
        await openDetail(detail);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Adjustment could not be posted.");
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        code="04 / Material intelligence"
        title="Inventory"
        description="Every unit has a batch, a cost, and a source document. Balances are derived from the append-only stock ledger, never edited in place."
        footnote="Stock register / ledger-backed balances"
        tone="ledger"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-obsidian/15 bg-obsidian/10">
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Low / out</p>
                <p className="mt-2 font-mono text-2xl tabular">{overview.lowStock.length}</p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Expiry watch</p>
                <p className="mt-2 font-mono text-2xl tabular">{overview.expiring.length}</p>
              </div>
            </div>
            <div className="mt-4">
              {canManage ? (
                <Button onClick={() => setAdjustmentOpen(true)}><ClipboardList className="h-3.5 w-3.5" /> New adjustment</Button>
              ) : (
                <p className="text-xs leading-6 text-ink-muted">Read-only access. Adjustments require inventory management permission.</p>
              )}
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
      {error ? <Notice tone="error" className="mb-8">{error}</Notice> : null}
      {notice ? <Notice tone="success" className="mb-8">{notice}</Notice> : null}

      {overview.lowStock.length > 0 || overview.expiring.length > 0 ? (
        <section className="mt-10" aria-labelledby="inventory-watch">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-obsidian/15 pb-3">
            <div>
              <p className="mono-label text-rust-ink">01 / Watch list</p>
              <h2 id="inventory-watch" className="mt-2 text-xl font-semibold tracking-tight">Stock alerts</h2>
            </div>
            <p className="mono-caption text-ink-muted">Live exceptions from the stock ledger</p>
          </div>
          <div className="mt-px grid gap-px border border-obsidian/15 bg-obsidian/10 sm:grid-cols-2">
            <div className="min-w-0 bg-paper p-5">
              <p className="mono-label flex items-center gap-2 text-rust-ink"><AlertTriangle className="h-3.5 w-3.5" /> Stock alerts</p>
              <div className="mt-4 space-y-1">
                {overview.lowStock.slice(0, 4).map((item) => (
                  <button key={`low-${item.key}`} type="button" onClick={() => openDetail(item)} className="flex w-full min-w-0 justify-between gap-3 border-b border-obsidian/10 py-2 text-left text-xs transition-colors hover:text-rust-ink">
                    <span className="min-w-0 truncate font-mono">{item.code}</span>
                    <span className="shrink-0 tabular">{formatQuantity(item.currentStock)} {item.unit}</span>
                  </button>
                ))}
                {overview.lowStock.length === 0 ? <p className="py-2 text-xs text-ink-muted">No low-stock items.</p> : null}
              </div>
            </div>
            <div className="min-w-0 bg-paper p-5">
              <p className="mono-label flex items-center gap-2 text-rust-ink"><AlertTriangle className="h-3.5 w-3.5" /> Expiry watch</p>
              <div className="mt-4 space-y-1">
                {overview.expiring.slice(0, 4).map((item) => (
                  <button key={`exp-${item.key}`} type="button" onClick={() => openDetail(item)} className="flex w-full min-w-0 justify-between gap-3 border-b border-obsidian/10 py-2 text-left text-xs transition-colors hover:text-rust-ink">
                    <span className="min-w-0 truncate font-mono">{item.code}</span>
                    <span className="shrink-0 tabular">{item.expiringBatchCount} batch{item.expiringBatchCount === 1 ? "" : "es"}</span>
                  </button>
                ))}
                {overview.expiring.length === 0 ? <p className="py-2 text-xs text-ink-muted">No batches in the 30-day window.</p> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <MotionTabs label="Inventory views" value={view} onChange={setView} items={viewItems} />
        {view === "stock" ? (
          <div className="flex w-full flex-wrap items-center gap-2 border border-obsidian/15 bg-paper p-2 sm:w-auto">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item or code" className="pl-9" aria-label="Search inventory" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${fieldClass()} sm:w-40`} aria-label="Filter by stock status">
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
              <option value="expiring">Expiring</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={`${fieldClass()} sm:w-40`} aria-label="Sort inventory">
              <option value="name">Sort: code</option>
              <option value="stock">Sort: stock</option>
              <option value="value">Sort: value</option>
              <option value="status">Sort: risk</option>
            </select>
          </div>
        ) : null}
      </div>

      {view === "stock" ? (
        <>
          <div className="mt-6 flex flex-wrap gap-px border border-obsidian/15 bg-obsidian/10">
            {([
              ["raw", "Raw materials"],
              ["packaging", "Packaging"],
              ["finished_good", "Finished goods"],
            ] as [Category, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`min-w-[150px] flex-1 px-4 py-3 font-mono text-[10px] uppercase tracking-label transition-colors ${
                  category === value ? "bg-obsidian text-paper" : "bg-paper text-ink-muted hover:bg-sage/40 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <TableFrame
            className="mt-4"
            title="Stock register"
            description={`${items.length} items · ${category.replace("_", " ")}`}
            actions={<span className="mono-caption text-ink-muted">Ledger-backed balances</span>}
          >
            {loading ? (
              <div className="space-y-px bg-obsidian/10">
                {[0, 1, 2, 3].map((row) => <div key={row} className="h-16 bg-paper" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="mono-label text-ink-muted">No inventory rows</p>
                <p className="mt-3 text-sm text-ink-muted">Adjust the filters or post a goods receipt to create stock.</p>
              </div>
            ) : (
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="mono-label text-ink-muted">
                    <th scope="col" className="px-5 py-4 font-medium">Item</th>
                    <th scope="col" className="px-3 py-4 font-medium">On hand</th>
                    <th scope="col" className="px-3 py-4 font-medium">Avg cost</th>
                    <th scope="col" className="px-3 py-4 font-medium">Stock value</th>
                    <th scope="col" className="px-3 py-4 font-medium">Minimum</th>
                    <th scope="col" className="px-3 py-4 font-medium">Status</th>
                    <th scope="col" className="px-3 py-4 font-medium">Last movement</th>
                    <th scope="col" className="px-5 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.key} className="data-row">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs">{item.code}</p>
                        <p className="mt-1 text-sm">{item.name}</p>
                        <p className="mono-label mt-1 text-ink-muted">{item.unit}</p>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs tabular">{formatQuantity(item.currentStock)}</td>
                      <td className="px-3 py-4 font-mono text-xs tabular">{formatPaise(item.averageCostPaise)}</td>
                      <td className="px-3 py-4 font-mono text-xs tabular">{formatPaise(item.stockValuePaise)}</td>
                      <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{formatQuantity(item.minimumStock)}</td>
                      <td className="px-3 py-4">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                        {item.alerts.length > 1 ? <p className="mono-label mt-2 text-rust-ink">{item.alerts[1]}</p> : null}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-mono text-xs tabular">{item.lastMovementAt ? item.lastMovementAt.slice(0, 10) : "—"}</p>
                        {item.lastMovementSource ? <p className="mono-label mt-1 text-ink-muted">{item.lastMovementSource}</p> : null}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => openDetail(item)} disabled={busy}>Inspect</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableFrame>
        </>
      ) : (
        <TableFrame
          className="mt-6"
          title="Adjustment ledger"
          description="Corrections and their source documents"
          actions={<span className="mono-caption text-ink-muted">{adjustments.length} entries</span>}
        >
          {adjustments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="mono-label text-ink-muted">No adjustments</p>
              <p className="mt-3 text-sm text-ink-muted">Stock corrections appear here with their ledger source.</p>
            </div>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Adjustment</th>
                  <th scope="col" className="px-3 py-4 font-medium">Target</th>
                  <th scope="col" className="px-3 py-4 font-medium">Direction</th>
                  <th scope="col" className="px-3 py-4 font-medium">Quantity</th>
                  <th scope="col" className="px-3 py-4 font-medium">Reason</th>
                  <th scope="col" className="px-3 py-4 font-medium">Recorded by</th>
                  <th scope="col" className="px-3 py-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adjustment) => (
                  <tr key={adjustment.id} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{adjustment.adjustmentNumber}</td>
                    <td className="px-3 py-4 font-mono text-xs text-ink-muted">{adjustment.targetType}:{adjustment.targetId}</td>
                    <td className="px-3 py-4"><Badge variant={adjustment.direction === "increment" ? "default" : "rust"}>{adjustment.direction}</Badge></td>
                    <td className="px-3 py-4 font-mono text-xs tabular">{formatQuantity(adjustment.quantity)} {adjustment.baseUnit}</td>
                    <td className="px-3 py-4 text-xs">{adjustment.reason.replace("_", " ")}</td>
                    <td className="px-3 py-4 text-xs text-ink-muted">{adjustment.createdBy || "Unknown"}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular">{adjustment.occurredAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableFrame>
      )}

      {adjustmentOpen ? (
        <section className="mt-10 border border-obsidian/20 bg-sage/20" aria-labelledby="inventory-adjustment-form">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian/15 px-5 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">02 / Ledger-backed correction</p>
              <h2 id="inventory-adjustment-form" className="mt-2 text-2xl font-semibold tracking-tight">Inventory adjustment</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setAdjustmentOpen(false)} aria-label="Close adjustment form"><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={submitAdjustment} className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Adjustment number</span><Input required pattern="[A-Za-z0-9_-]{2,64}" value={adjustmentDraft.adjustmentNumber} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, adjustmentNumber: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Target lot / item</span><select required className={fieldClass()} value={adjustmentDraft.optionKey} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, optionKey: event.target.value })}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Direction</span><select className={fieldClass()} value={adjustmentDraft.direction} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, direction: event.target.value as "increment" | "decrement" })}><option value="decrement">Decrease stock</option><option value="increment">Increase stock</option></select></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Quantity ({selectedOption?.baseUnit ?? "units"})</span><Input required type="number" min={1} step={1} value={adjustmentDraft.quantity} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, quantity: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Reason</span><select className={fieldClass()} value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value })}>{["damage", "shortage", "found_stock", "quality_check", "expiry_write_off", "correction"].map((reason) => <option key={reason} value={reason}>{reason.replace("_", " ")}</option>)}</select></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Occurred at</span><Input required type="date" value={adjustmentDraft.occurredAt} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, occurredAt: event.target.value })} /></label>
            {adjustmentDraft.direction === "increment" ? (
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Unit cost (paise)</span><Input required type="number" min={0} step={1} value={adjustmentDraft.unitCostPaise} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, unitCostPaise: event.target.value })} /></label>
            ) : null}
            <label className="min-w-0 space-y-2 sm:col-span-3"><span className="mono-label text-ink-muted">Notes</span><Input value={adjustmentDraft.notes} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, notes: event.target.value })} /></label>
            <div className="sm:col-span-3"><Button type="submit" disabled={busy || !selectedOption}>Post adjustment</Button></div>
          </form>
        </section>
      ) : null}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-rust-ink">{detail?.category.replace("_", " ") ?? "Inventory"}</p>
            <SheetTitle className="text-2xl">{detail?.code ?? "Loading"}</SheetTitle>
            <SheetDescription>{detail ? `${detail.name} · ${detail.unit}` : "Fetching inventory detail"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {detail ? (
              <>
                <MetricGrid
                  className="mt-6 border border-paper/10"
                  columns={3}
                  items={[
                    { label: "On hand", value: formatQuantity(detail.currentStock), tone: "dark" },
                    { label: "Avg cost", value: formatPaise(detail.averageCostPaise), tone: "dark" },
                    { label: "Value", value: formatPaise(detail.stockValuePaise), tone: "dark" },
                  ]}
                />
                <p className="mono-label mt-8 text-paper-muted">Batches</p>
                <div className="mt-3 divide-y divide-paper/10 border-y border-paper/10">
                  {detail.batches.length === 0 ? <p className="py-4 text-xs text-paper-muted">No batches recorded for this item.</p> : null}
                  {detail.batches.map((batch) => (
                    <div key={batch.id} className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs">{batch.batchCode}</p>
                        <p className="mono-label mt-1 text-paper-muted">{batch.supplierName || "Supplier not linked"} · {batch.receivedAt.slice(0, 10)}</p>
                        {batch.expiresAt ? <p className="mono-label mt-1 text-rust-ink">Expiry {batch.expiresAt.slice(0, 10)}</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs tabular">{formatQuantity(batch.balance)} / {formatQuantity(batch.quantity)}</p>
                        <p className="mono-label mt-1 text-paper-muted">{batch.unitCostPaise === null ? "No cost" : formatPaise(batch.unitCostPaise)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mono-label mt-8 text-paper-muted">Stock ledger</p>
                <ol className="mt-3 space-y-3">
                  {detail.movements.length === 0 ? <li className="text-xs text-paper-muted">No movements recorded.</li> : null}
                  {detail.movements.map((movement) => (
                    <li key={movement.id} className="border-l border-signal/50 pl-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 font-mono text-xs">{movement.transactionType} · {movement.sourceType}</p>
                        <p className="shrink-0 font-mono text-xs tabular">{movement.quantityDelta > 0 ? "+" : ""}{formatQuantity(movement.quantityDelta)}</p>
                      </div>
                      <p className="mono-label mt-1 text-paper-muted">Balance {formatQuantity(movement.balance)} · {movement.occurredAt.slice(0, 10)}</p>
                      {movement.sourceNumber ? (
                        <Link href={`/purchases?focus=${encodeURIComponent(movement.sourceNumber)}`} className="mono-label mt-1 inline-block text-signal underline-offset-4 hover:underline">
                          {movement.sourceNumber}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-8 text-sm text-paper-muted">Loading inventory detail…</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}
