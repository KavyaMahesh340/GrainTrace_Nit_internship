"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="grid gap-8 border-b border-obsidian/15 pb-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="mono-label text-rust">04 / Material intelligence</p>
          <h1 className="mt-4 text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
            Inventory
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-obsidian/60">
            Every unit has a batch, a cost, and a source document. Balances are derived from the
            append-only stock ledger, never edited in place.
          </p>
        </div>
        <div className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
          <div className="grid grid-cols-2 gap-px bg-obsidian/10">
            <div className="bg-paper p-4">
              <p className="mono-label text-machine">Low / out</p>
              <p className="mt-2 font-mono text-2xl tabular">{overview.lowStock.length}</p>
            </div>
            <div className="bg-paper p-4">
              <p className="mono-label text-machine">Expiry watch</p>
              <p className="mt-2 font-mono text-2xl tabular">{overview.expiring.length}</p>
            </div>
          </div>
          <div className="mt-4">
            {canManage ? (
              <Button onClick={() => setAdjustmentOpen(true)}><ClipboardList className="h-3.5 w-3.5" /> New adjustment</Button>
            ) : (
              <p className="text-xs leading-6 text-obsidian/55">Read-only access. Adjustments require inventory management permission.</p>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="mt-6 border border-rust/40 bg-rust/10 px-4 py-3 text-sm text-rust">{error}</p> : null}
      {notice ? <p className="mt-6 border border-signal bg-signal/20 px-4 py-3 text-sm text-forest">{notice}</p> : null}

      {overview.lowStock.length > 0 || overview.expiring.length > 0 ? (
        <section className="mt-8 grid gap-px border border-obsidian/15 bg-obsidian/10 sm:grid-cols-2">
          <div className="bg-paper p-5">
            <p className="mono-label flex items-center gap-2 text-rust"><AlertTriangle className="h-3.5 w-3.5" /> Stock alerts</p>
            <div className="mt-4 space-y-2">
              {overview.lowStock.slice(0, 4).map((item) => (
                <button key={`low-${item.key}`} type="button" onClick={() => openDetail(item)} className="flex w-full justify-between gap-3 text-left text-xs hover:text-rust">
                  <span className="font-mono">{item.code}</span>
                  <span>{formatQuantity(item.currentStock)} {item.unit}</span>
                </button>
              ))}
              {overview.lowStock.length === 0 ? <p className="text-xs text-obsidian/55">No low-stock items.</p> : null}
            </div>
          </div>
          <div className="bg-paper p-5">
            <p className="mono-label flex items-center gap-2 text-machine"><AlertTriangle className="h-3.5 w-3.5" /> Expiry watch</p>
            <div className="mt-4 space-y-2">
              {overview.expiring.slice(0, 4).map((item) => (
                <button key={`exp-${item.key}`} type="button" onClick={() => openDetail(item)} className="flex w-full justify-between gap-3 text-left text-xs hover:text-rust">
                  <span className="font-mono">{item.code}</span>
                  <span>{item.expiringBatchCount} batch{item.expiringBatchCount === 1 ? "" : "es"}</span>
                </button>
              ))}
              {overview.expiring.length === 0 ? <p className="text-xs text-obsidian/55">No batches in the 30-day window.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1 border-b border-obsidian/15">
          {(["stock", "adjustments"] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`px-4 py-3 font-mono text-[10px] uppercase tracking-label transition-colors ${
                view === item ? "border-b-2 border-rust text-obsidian" : "text-machine hover:text-obsidian"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {view === "stock" ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-machine" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item or code" className="pl-9" aria-label="Search inventory" />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass()} aria-label="Filter by stock status">
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
              <option value="expiring">Expiring</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={fieldClass()} aria-label="Sort inventory">
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
          <div className="mt-6 flex flex-wrap gap-2">
            {([
              ["raw", "Raw materials"],
              ["packaging", "Packaging"],
              ["finished_good", "Finished goods"],
            ] as [Category, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-label transition-colors ${
                  category === value ? "border-obsidian bg-obsidian text-paper" : "border-obsidian/20 text-machine hover:border-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 border border-obsidian/15 bg-paper">
            {loading ? (
              <div className="space-y-px bg-obsidian/10">
                {[0, 1, 2, 3].map((row) => <div key={row} className="h-16 bg-paper" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="mono-label text-machine">No inventory rows</p>
                <p className="mt-3 text-sm text-obsidian/60">Adjust the filters or post a goods receipt to create stock.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead>
                    <tr className="mono-label text-machine">
                      <th className="px-5 py-4 font-medium">Item</th>
                      <th className="px-3 py-4 font-medium">On hand</th>
                      <th className="px-3 py-4 font-medium">Avg cost</th>
                      <th className="px-3 py-4 font-medium">Stock value</th>
                      <th className="px-3 py-4 font-medium">Minimum</th>
                      <th className="px-3 py-4 font-medium">Status</th>
                      <th className="px-3 py-4 font-medium">Last movement</th>
                      <th className="px-5 py-4 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className="border-t border-obsidian/10 hover:bg-sage/20">
                        <td className="px-5 py-4">
                          <p className="font-mono text-xs">{item.code}</p>
                          <p className="mt-1 text-sm">{item.name}</p>
                          <p className="mono-label mt-1 text-machine">{item.unit}</p>
                        </td>
                        <td className="px-3 py-4 font-mono text-xs tabular">{formatQuantity(item.currentStock)}</td>
                        <td className="px-3 py-4 font-mono text-xs tabular">{formatPaise(item.averageCostPaise)}</td>
                        <td className="px-3 py-4 font-mono text-xs tabular">{formatPaise(item.stockValuePaise)}</td>
                        <td className="px-3 py-4 font-mono text-xs tabular text-machine">{formatQuantity(item.minimumStock)}</td>
                        <td className="px-3 py-4">
                          <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                          {item.alerts.length > 1 ? <p className="mono-label mt-2 text-rust">{item.alerts[1]}</p> : null}
                        </td>
                        <td className="px-3 py-4">
                          <p className="font-mono text-xs tabular">{item.lastMovementAt ? item.lastMovementAt.slice(0, 10) : "—"}</p>
                          {item.lastMovementSource ? <p className="mono-label mt-1 text-machine">{item.lastMovementSource}</p> : null}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button size="sm" variant="outline" onClick={() => openDetail(item)} disabled={busy}>Inspect</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 border border-obsidian/15 bg-paper">
          {adjustments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="mono-label text-machine">No adjustments</p>
              <p className="mt-3 text-sm text-obsidian/60">Stock corrections appear here with their ledger source.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="mono-label text-machine">
                    <th className="px-5 py-4 font-medium">Adjustment</th>
                    <th className="px-3 py-4 font-medium">Target</th>
                    <th className="px-3 py-4 font-medium">Direction</th>
                    <th className="px-3 py-4 font-medium">Quantity</th>
                    <th className="px-3 py-4 font-medium">Reason</th>
                    <th className="px-3 py-4 font-medium">Recorded by</th>
                    <th className="px-3 py-4 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adjustment) => (
                    <tr key={adjustment.id} className="border-t border-obsidian/10 hover:bg-sage/20">
                      <td className="px-5 py-4 font-mono text-xs">{adjustment.adjustmentNumber}</td>
                      <td className="px-3 py-4 font-mono text-xs text-machine">{adjustment.targetType}:{adjustment.targetId}</td>
                      <td className="px-3 py-4"><Badge variant={adjustment.direction === "increment" ? "default" : "rust"}>{adjustment.direction}</Badge></td>
                      <td className="px-3 py-4 font-mono text-xs tabular">{formatQuantity(adjustment.quantity)} {adjustment.baseUnit}</td>
                      <td className="px-3 py-4 text-xs">{adjustment.reason.replace("_", " ")}</td>
                      <td className="px-3 py-4 text-xs text-obsidian/60">{adjustment.createdBy || "Unknown"}</td>
                      <td className="px-3 py-4 font-mono text-xs tabular">{adjustment.occurredAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adjustmentOpen ? (
        <section className="mt-8 border border-obsidian/20 bg-sage/20 p-5 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono-label text-rust">Ledger-backed correction</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Inventory adjustment</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setAdjustmentOpen(false)} aria-label="Close adjustment form"><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={submitAdjustment} className="mt-6 grid gap-4 sm:grid-cols-3">
            <label className="space-y-2"><span className="mono-label text-machine">Adjustment number</span><Input required pattern="[A-Za-z0-9_-]{2,64}" value={adjustmentDraft.adjustmentNumber} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, adjustmentNumber: event.target.value })} /></label>
            <label className="space-y-2"><span className="mono-label text-machine">Target lot / item</span><select required className={fieldClass()} value={adjustmentDraft.optionKey} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, optionKey: event.target.value })}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <label className="space-y-2"><span className="mono-label text-machine">Direction</span><select className={fieldClass()} value={adjustmentDraft.direction} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, direction: event.target.value as "increment" | "decrement" })}><option value="decrement">Decrease stock</option><option value="increment">Increase stock</option></select></label>
            <label className="space-y-2"><span className="mono-label text-machine">Quantity ({selectedOption?.baseUnit ?? "units"})</span><Input required type="number" min={1} step={1} value={adjustmentDraft.quantity} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, quantity: event.target.value })} /></label>
            <label className="space-y-2"><span className="mono-label text-machine">Reason</span><select className={fieldClass()} value={adjustmentDraft.reason} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value })}>{["damage", "shortage", "found_stock", "quality_check", "expiry_write_off", "correction"].map((reason) => <option key={reason} value={reason}>{reason.replace("_", " ")}</option>)}</select></label>
            <label className="space-y-2"><span className="mono-label text-machine">Occurred at</span><Input required type="date" value={adjustmentDraft.occurredAt} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, occurredAt: event.target.value })} /></label>
            {adjustmentDraft.direction === "increment" ? (
              <label className="space-y-2"><span className="mono-label text-machine">Unit cost (paise)</span><Input required type="number" min={0} step={1} value={adjustmentDraft.unitCostPaise} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, unitCostPaise: event.target.value })} /></label>
            ) : null}
            <label className="space-y-2 sm:col-span-3"><span className="mono-label text-machine">Notes</span><Input value={adjustmentDraft.notes} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, notes: event.target.value })} /></label>
            <div className="sm:col-span-3"><Button type="submit" disabled={busy || !selectedOption}>Post adjustment</Button></div>
          </form>
        </section>
      ) : null}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetHeader>
            <p className="mono-label text-rust">{detail?.category.replace("_", " ") ?? "Inventory"}</p>
            <SheetTitle className="text-2xl">{detail?.code ?? "Loading"}</SheetTitle>
            <SheetDescription>{detail ? `${detail.name} · ${detail.unit}` : "Fetching inventory detail"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {detail ? (
              <>
                <div className="grid grid-cols-3 gap-px bg-paper/10">
                  <div className="bg-obsidian p-4"><p className="mono-label text-paper/45">On hand</p><p className="mt-2 font-mono text-sm tabular">{formatQuantity(detail.currentStock)}</p></div>
                  <div className="bg-obsidian p-4"><p className="mono-label text-paper/45">Avg cost</p><p className="mt-2 font-mono text-sm">{formatPaise(detail.averageCostPaise)}</p></div>
                  <div className="bg-obsidian p-4"><p className="mono-label text-paper/45">Value</p><p className="mt-2 font-mono text-sm">{formatPaise(detail.stockValuePaise)}</p></div>
                </div>
                <p className="mono-label mt-8 text-paper/45">Batches</p>
                <div className="mt-3 divide-y divide-paper/10 border-y border-paper/10">
                  {detail.batches.length === 0 ? <p className="py-4 text-xs text-paper/55">No batches recorded for this item.</p> : null}
                  {detail.batches.map((batch) => (
                    <div key={batch.id} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <p className="font-mono text-xs">{batch.batchCode}</p>
                        <p className="mono-label mt-1 text-paper/45">{batch.supplierName || "Supplier not linked"} · {batch.receivedAt.slice(0, 10)}</p>
                        {batch.expiresAt ? <p className="mono-label mt-1 text-rust">Expiry {batch.expiresAt.slice(0, 10)}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs tabular">{formatQuantity(batch.balance)} / {formatQuantity(batch.quantity)}</p>
                        <p className="mono-label mt-1 text-paper/45">{batch.unitCostPaise === null ? "No cost" : formatPaise(batch.unitCostPaise)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mono-label mt-8 text-paper/45">Stock ledger</p>
                <ol className="mt-3 space-y-3">
                  {detail.movements.length === 0 ? <li className="text-xs text-paper/55">No movements recorded.</li> : null}
                  {detail.movements.map((movement) => (
                    <li key={movement.id} className="border-l border-signal/50 pl-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-xs">{movement.transactionType} · {movement.sourceType}</p>
                        <p className="font-mono text-xs tabular">{movement.quantityDelta > 0 ? "+" : ""}{formatQuantity(movement.quantityDelta)}</p>
                      </div>
                      <p className="mono-label mt-1 text-paper/45">Balance {formatQuantity(movement.balance)} · {movement.occurredAt.slice(0, 10)}</p>
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
              <p className="mt-8 text-sm text-paper/60">Loading inventory detail…</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
