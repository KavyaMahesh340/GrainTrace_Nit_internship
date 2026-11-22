"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DispatchDetail, DispatchPlan, DispatchSummary } from "@/lib/workflows/dispatch";
import { salesApiRequest, salesFieldClass, salesLabelClass, salesStatusVariant } from "./sales-shared";

type OrderOption = { orderNumber: string; customerName: string; status: string };

type Props = {
  initialDispatches: DispatchSummary[];
  overview: { awaitingDispatch: number; inTransit: number; delivered: number; packetShortfall: number };
  orders: OrderOption[];
  canManage: boolean;
  focus?: string;
};

export function DispatchWorkspace({ initialDispatches, overview, orders, canManage, focus }: Props) {
  const [dispatches, setDispatches] = useState(initialDispatches);
  const [planOrder, setPlanOrder] = useState(focus ?? orders[0]?.orderNumber ?? "");
  const [plan, setPlan] = useState<DispatchPlan | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<DispatchDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dispatchFields, setDispatchFields] = useState({
    dispatchedAt: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    carrierName: "",
    trackingNumber: "",
    notes: "",
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dispatches;
    return dispatches.filter((dispatch) =>
      `${dispatch.dispatchNumber} ${dispatch.orderNumber ?? ""} ${dispatch.customerName}`
        .toLowerCase()
        .includes(needle),
    );
  }, [dispatches, query]);

  async function loadPlan(orderNumber = planOrder) {
    if (!orderNumber) return;
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ plan: DispatchPlan }>(
        `/api/dispatch/plan?orderNumber=${encodeURIComponent(orderNumber)}`,
      );
      setPlan(data.plan);
      setQuantities(
        Object.fromEntries(
          data.plan.lines.map((line) => [line.salesOrderItemId, String(line.fulfillablePackets)]),
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The fulfilment plan could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(dispatchNumber: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ detail: DispatchDetail }>(
        `/api/dispatch/${encodeURIComponent(dispatchNumber)}`,
      );
      setDetail(data.detail);
      setDetailOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dispatch could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    try {
      const data = await salesApiRequest<{ dispatches: DispatchSummary[] }>("/api/dispatch");
      setDispatches(data.dispatches);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dispatches could not be refreshed.");
    }
  }

  async function createDispatch() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const lines = plan.lines
        .map((line) => ({
          salesOrderItemId: line.salesOrderItemId,
          quantityPackets: Number(quantities[line.salesOrderItemId] ?? 0),
        }))
        .filter((line) => line.quantityPackets > 0);
      const data = await salesApiRequest<{ dispatch: DispatchDetail }>("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderNumber: plan.orderNumber,
          ...dispatchFields,
          status: "in_transit",
          lines,
        }),
      });
      setNotice(`${data.dispatch.dispatchNumber} created and finished-good stock posted to the ledger.`);
      setPlan(null);
      await refresh();
      await loadDetail(data.dispatch.dispatchNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dispatch could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(dispatchNumber: string, status: "in_transit" | "delivered" | "cancelled") {
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ dispatch: DispatchDetail }>(
        `/api/dispatch/${encodeURIComponent(dispatchNumber)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      setDetail(data.dispatch);
      setNotice(`${dispatchNumber} marked ${status}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">MATERIAL JOURNEY / 09</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Dispatch & fulfilment control.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Approved packets move against an order. The plan uses FEFO batches, records partial fulfilment, and posts
              stock only when a challan is created.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="TO DISPATCH" value={String(overview.awaitingDispatch)} />
            <Metric label="IN TRANSIT" value={String(overview.inTransit)} />
            <Metric label="DELIVERED" value={String(overview.delivered)} />
            <Metric label="SHORTFALL" value={String(overview.packetShortfall)} />
          </div>
        </div>
      </header>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}
        {notice ? <p className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">{notice}</p> : null}

        {canManage ? (
          <section className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="border border-obsidian/15 bg-paper p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mono-label text-machine">CHALLAN BUILDER</p>
                  <h2 className="mt-1 text-2xl font-semibold">Plan a dispatch</h2>
                </div>
                <Truck className="h-7 w-7 text-forest" />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={salesLabelClass()}>APPROVED ORDER</span>
                  <select
                    value={planOrder}
                    onChange={(event) => setPlanOrder(event.target.value)}
                    className={salesFieldClass()}
                  >
                    <option value="">Select order</option>
                    {orders.map((order) => (
                      <option key={order.orderNumber} value={order.orderNumber}>
                        {order.orderNumber} · {order.customerName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="outline" className="self-end" onClick={() => void loadPlan()} disabled={busy || !planOrder}>
                  <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Load plan
                </Button>
              </div>

              {plan ? (
                <div className="mt-6 space-y-4">
                  <div className="border-l-2 border-signal pl-3">
                    <p className="mono-label text-machine">{plan.orderNumber}</p>
                    <p className="text-sm text-machine">Order status: {plan.status.replaceAll("_", " ")}</p>
                  </div>
                  {plan.lines.map((line) => (
                    <div key={line.salesOrderItemId} className="border border-obsidian/15 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{line.productName}</p>
                          <p className="mt-1 font-mono text-xs text-machine">{line.productCode}</p>
                        </div>
                        {line.isPartial ? <Badge variant="machine">PARTIAL</Badge> : null}
                      </div>
                      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
                        <span>Ordered: {line.orderedPackets}</span>
                        <span>Fulfilled: {line.fulfilledPackets}</span>
                        <span>Available: {line.availablePackets}</span>
                        <span>Backorder: {line.backorderPackets}</span>
                      </div>
                      <label className="mt-4 block">
                        <span className={salesLabelClass()}>PACKETS TO DISPATCH</span>
                        <Input
                          inputMode="numeric"
                          value={quantities[line.salesOrderItemId] ?? "0"}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [line.salesOrderItemId]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ))}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className={salesLabelClass()}>DISPATCH DATE</span>
                      <Input
                        type="date"
                        value={dispatchFields.dispatchedAt}
                        onChange={(event) => setDispatchFields({ ...dispatchFields, dispatchedAt: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className={salesLabelClass()}>EXPECTED DATE</span>
                      <Input
                        type="date"
                        value={dispatchFields.expectedDate}
                        onChange={(event) => setDispatchFields({ ...dispatchFields, expectedDate: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className={salesLabelClass()}>CARRIER</span>
                      <Input
                        value={dispatchFields.carrierName}
                        onChange={(event) => setDispatchFields({ ...dispatchFields, carrierName: event.target.value })}
                      />
                    </label>
                    <label>
                      <span className={salesLabelClass()}>TRACKING NO.</span>
                      <Input
                        value={dispatchFields.trackingNumber}
                        onChange={(event) => setDispatchFields({ ...dispatchFields, trackingNumber: event.target.value })}
                      />
                    </label>
                  </div>
                  <Button onClick={() => void createDispatch()} disabled={busy}>
                    <PackageCheck className="h-4 w-4" /> Create challan and post stock
                  </Button>
                </div>
              ) : (
                <p className="mt-6 border border-dashed border-obsidian/20 p-8 text-center text-sm text-machine">
                  Load an approved order to inspect packet availability and partial fulfilment.
                </p>
              )}
            </div>
            <aside className="surface-dark self-start p-6 text-paper">
              <p className="mono-label text-signal">BATCH DISCIPLINE</p>
              <h3 className="mt-2 text-xl font-semibold">No phantom stock.</h3>
              <p className="mt-3 text-sm text-paper/65">
                Packets are selected by expiry date and status. Dispatch reserves whole packets, updates order
                fulfilment counters, and posts one ledger decrement per finished good batch.
              </p>
            </aside>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono-label text-machine">CHALLAN REGISTER</p>
              <h2 className="mt-1 text-2xl font-semibold">Dispatches</h2>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-machine" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dispatches"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Challan</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Order</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Customer</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Dispatched</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((dispatch) => (
                  <tr key={dispatch.id} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                    <td className="px-4 py-3 font-mono">{dispatch.dispatchNumber}</td>
                    <td className="px-4 py-3 font-mono">{dispatch.orderNumber ?? "—"}</td>
                    <td className="px-4 py-3">{dispatch.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-machine">{dispatch.dispatchedAt}</td>
                    <td className="px-4 py-3">
                      <Badge variant={salesStatusVariant(dispatch.status)}>
                        {dispatch.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => void loadDetail(dispatch.dispatchNumber)}>
                        View <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-machine">
                      No dispatches recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="font-mono">{detail?.dispatchNumber}</SheetTitle>
            <SheetDescription>
              {detail?.customerName} · {detail?.carrierName || "Carrier not set"}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="space-y-6 px-6 pb-10">
              <div className="space-y-3">
                {detail.lines.map((line, index) => (
                  <div key={index} className="border border-paper/15 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-paper">{line.productName}</span>
                      <span className="font-mono text-signal">{line.quantityPackets} packets</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper/60">
                      Batch {line.batchCode} · Packet {line.packetCode}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 text-sm text-paper/70">
                <p>Expected: {detail.expectedDate || "—"}</p>
                <p>Delivered: {detail.deliveredAt || "—"}</p>
                <p>Tracking: {detail.trackingNumber || "—"}</p>
                {detail.notes ? <p>Notes: {detail.notes}</p> : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {detail.status !== "delivered" ? (
                    <Button onClick={() => void updateStatus(detail.dispatchNumber, "delivered")} disabled={busy}>
                      Mark delivered
                    </Button>
                  ) : null}
                  {detail.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      onClick={() => void updateStatus(detail.dispatchNumber, "cancelled")}
                      disabled={busy}
                    >
                      Cancel dispatch
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {detail.orderNumber ? (
                <Button variant="light" asChild className="w-full">
                  <a href={`/orders?focus=${encodeURIComponent(detail.orderNumber)}`}>
                    Track source order <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 border-l-2 border-signal pl-3">
      <p className="mono-label text-paper/50">{label}</p>
      <p className="mt-1 font-mono text-lg text-signal">{value}</p>
    </div>
  );
}
