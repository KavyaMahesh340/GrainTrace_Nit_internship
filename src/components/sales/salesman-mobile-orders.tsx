"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardList, CloudOff, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPaise } from "@/domain";
import { enqueueMutation, getQueueCount, listMutations, subscribeToQueueChanges } from "@/lib/offline/queue";
import type { SalesOrderDetail, SalesOrderSummary } from "@/lib/workflows/sales";
import {
  parseAmount,
  salesApiRequest,
  salesFieldClass,
  salesLabelClass,
  salesStatusVariant,
} from "./sales-shared";

type SalesOption = {
  id: number;
  code: string;
  name: string;
  customerType?: string;
  state?: string | null;
  packetGrams?: number;
  hsnCode?: string | null;
};

type Props = {
  initialOrders: SalesOrderSummary[];
  options: { customers: SalesOption[]; products: SalesOption[] };
  canManage: boolean;
};

type Draft = {
  orderNumber: string;
  customerId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  requestedDate: string;
  notes: string;
};

const emptyDraft: Draft = {
  orderNumber: "",
  customerId: "",
  productId: "",
  quantity: "1",
  unitPrice: "",
  discount: "0",
  requestedDate: "",
  notes: "",
};

const steps = ["Customer", "Product", "Quantity", "Review"];

export function SalesmanMobileOrders({ initialOrders, options, canManage }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeCustomer = useMemo(
    () => options.customers.find((customer) => customer.id === Number(draft.customerId)),
    [draft.customerId, options.customers],
  );
  const activeProduct = useMemo(
    () => options.products.find((product) => product.id === Number(draft.productId)),
    [draft.productId, options.products],
  );
  const estimatePaise = useMemo(() => {
    const quantity = Math.max(0, Number(draft.quantity) || 0);
    return Math.max(0, parseAmount(draft.unitPrice) - parseAmount(draft.discount)) * quantity;
  }, [draft.discount, draft.quantity, draft.unitPrice]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    const updateQueue = () => {
      void getQueueCount().then(setQueued).catch(() => undefined);
    };
    updateQueue();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const unsubscribe = subscribeToQueueChanges(updateQueue);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      unsubscribe();
    };
  }, []);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
    setNotice(null);
  }

  function startOrder() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    setDraft({ ...emptyDraft, orderNumber: `SO-M-${stamp}`, customerId: String(options.customers[0]?.id ?? "") });
    setStep(0);
    setError(null);
    setNotice(null);
  }

  async function queueDraft(action: "submit" | "draft") {
    await enqueueMutation({
      id: `${action}-${draft.orderNumber || Date.now()}`,
      type: "sales-order-draft",
      payload: JSON.stringify({ action, draft }),
      createdAt: new Date().toISOString(),
      status: "queued",
    });
    setQueued((count) => count + 1);
    setNotice(action === "submit" ? "Order queued for submission when the network returns." : "Draft saved on this device.");
    setDraft(emptyDraft);
    setStep(0);
  }

  async function submitOrder() {
    if (!canManage) {
      setError("Your role cannot create sales orders.");
      return;
    }
    if (!navigator.onLine) {
      await queueDraft("submit");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const product = options.products.find((item) => item.id === Number(draft.productId));
      const result = await salesApiRequest<{ order: SalesOrderDetail }>("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: draft.orderNumber,
          customerId: Number(draft.customerId),
          orderDate: new Date().toISOString().slice(0, 10),
          requestedDate: draft.requestedDate || undefined,
          notes: draft.notes,
          lines: [
            {
              productId: Number(draft.productId),
              quantityPackets: Number(draft.quantity),
              unitPricePaise: parseAmount(draft.unitPrice),
              discountPaise: parseAmount(draft.discount),
            },
          ],
        }),
      });
      const refreshed = await salesApiRequest<{ orders: SalesOrderSummary[] }>("/api/sales/orders");
      setOrders(refreshed.orders);
      setDetail(result.order);
      setDetailOpen(true);
      setNotice(`Order ${result.order.orderNumber} submitted. Product: ${product?.name ?? "selected item"}.`);
      setDraft(emptyDraft);
      setStep(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(orderNumber: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ detail: SalesOrderDetail }>(
        `/api/sales/orders/${encodeURIComponent(orderNumber)}`,
      );
      setDetail(data.detail);
      setDetailOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshOrders() {
    try {
      const data = await salesApiRequest<{ orders: SalesOrderSummary[] }>("/api/sales/orders");
      setOrders(data.orders);
      const mutations = await listMutations();
      setQueued(mutations.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Orders could not be refreshed.");
    }
  }

  const canAdvance =
    (step === 0 && Boolean(draft.customerId)) ||
    (step === 1 && Boolean(draft.productId)) ||
    (step === 2 && Number(draft.quantity) > 0 && parseAmount(draft.unitPrice) > 0) ||
    step === 3;

  return (
    <div className="mx-auto w-full max-w-3xl pb-32">
      <header className="surface-dark px-5 py-7 text-paper">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label text-signal">SALESMAN CONSOLE</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders, one hand at a time.</h1>
            <p className="mt-2 max-w-md text-sm text-paper/65">
              Large targets, short steps, live price preview, and honest offline drafts.
            </p>
          </div>
          <div className="rounded-sm border border-paper/20 px-3 py-2 text-right">
            <p className="mono-label text-paper/50">{online ? "CONNECTED" : "OFFLINE"}</p>
            <p className="mt-1 font-mono text-sm text-signal">{queued} queued</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 pt-5">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}
        {notice ? (
          <p className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">{notice}</p>
        ) : null}

        <section aria-label="New order" className="border border-obsidian/15 bg-paper p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono-label text-machine">STEP {step + 1} / 4</p>
              <h2 className="mt-1 text-xl font-semibold">{steps[step]}</h2>
            </div>
            {draft.orderNumber ? (
              <Button variant="outline" onClick={() => setDraft(emptyDraft)} className="min-h-11">
                Clear
              </Button>
            ) : null}
          </div>
          <div className="mt-4 flex gap-2" aria-hidden="true">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-forest" : "bg-obsidian/15"}`}
              />
            ))}
          </div>

          <div className="mt-6 space-y-5">
            {step === 0 ? (
              <div className="space-y-4">
                <label className="block">
                  <span className={salesLabelClass()}>CUSTOMER</span>
                  <select
                    value={draft.customerId}
                    onChange={(event) => update("customerId", event.target.value)}
                    className={`${salesFieldClass()} min-h-14 text-base`}
                  >
                    <option value="">Select customer</option>
                    {options.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.customerType}
                      </option>
                    ))}
                  </select>
                </label>
                {activeCustomer ? (
                  <div className="border border-obsidian/15 bg-paper/70 p-4 text-sm">
                    <p className="font-semibold">{activeCustomer.name}</p>
                    <p className="mt-1 text-machine">{activeCustomer.state}</p>
                    <p className="mt-1 font-mono text-xs">{activeCustomer.code}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <label className="block">
                  <span className={salesLabelClass()}>PRODUCT</span>
                  <select
                    value={draft.productId}
                    onChange={(event) => update("productId", event.target.value)}
                    className={`${salesFieldClass()} min-h-14 text-base`}
                  >
                    <option value="">Select product</option>
                    {options.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.packetGrams} g
                      </option>
                    ))}
                  </select>
                </label>
                {activeProduct ? (
                  <div className="border border-obsidian/15 bg-paper/70 p-4 text-sm">
                    <p className="font-semibold">{activeProduct.name}</p>
                    <p className="mt-1 font-mono text-xs">HSN {activeProduct.hsnCode || "missing"}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <label className="block">
                  <span className={salesLabelClass()}>PACKETS</span>
                  <Input
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(event) => update("quantity", event.target.value)}
                    className="h-14 text-lg"
                  />
                </label>
                <label className="block">
                  <span className={salesLabelClass()}>PRICE PER PACKET (₹)</span>
                  <Input
                    inputMode="decimal"
                    value={draft.unitPrice}
                    onChange={(event) => update("unitPrice", event.target.value)}
                    placeholder="0.00"
                    className="h-14 text-lg"
                  />
                </label>
                <label className="block">
                  <span className={salesLabelClass()}>DISCOUNT PER PACKET (₹)</span>
                  <Input
                    inputMode="decimal"
                    value={draft.discount}
                    onChange={(event) => update("discount", event.target.value)}
                    className="h-14 text-lg"
                  />
                </label>
                <div className="surface-dark flex items-center justify-between p-4 text-paper">
                  <span className="mono-label text-paper/60">LIVE PREVIEW</span>
                  <span className="font-mono text-2xl text-signal">{formatPaise(estimatePaise)}</span>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={salesLabelClass()}>REQUESTED DATE</span>
                    <Input
                      type="date"
                      value={draft.requestedDate}
                      onChange={(event) => update("requestedDate", event.target.value)}
                      className="h-14 text-base"
                    />
                  </label>
                  <label className="block">
                    <span className={salesLabelClass()}>REFERENCE</span>
                    <Input
                      value={draft.orderNumber}
                      onChange={(event) => update("orderNumber", event.target.value)}
                      className="h-14 font-mono text-base"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className={salesLabelClass()}>NOTES</span>
                  <textarea
                    value={draft.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    className="min-h-24 w-full rounded-sm border border-obsidian/25 bg-paper p-3 text-base"
                  />
                </label>
                <div className="border border-obsidian/15 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-machine">Customer</span>
                    <span className="font-semibold">{activeCustomer?.name ?? "—"}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-machine">Product</span>
                    <span className="font-semibold">{activeProduct?.name ?? "—"}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-machine">Packets</span>
                    <span className="font-mono">{draft.quantity}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-obsidian/15 pt-3">
                    <span className="font-semibold">Order value</span>
                    <span className="font-mono text-xl">{formatPaise(estimatePaise)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-label="Recent orders" className="border border-obsidian/15 bg-paper p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono-label text-machine">FIELD HISTORY</p>
              <h2 className="mt-1 text-lg font-semibold">Your orders</h2>
            </div>
            <Button variant="outline" size="icon" onClick={() => void refreshOrders()} aria-label="Refresh orders">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <p className="border border-dashed border-obsidian/20 p-6 text-center text-sm text-machine">
                No orders yet. Start with a customer.
              </p>
            ) : (
              orders.slice(0, 8).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => void openDetail(order.orderNumber)}
                  className="flex w-full items-center justify-between border border-obsidian/15 bg-paper/70 p-4 text-left transition-colors hover:border-forest"
                >
                  <div>
                    <p className="font-mono text-sm">{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-machine">{order.customerName}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={salesStatusVariant(order.status)}>{order.status.replaceAll("_", " ")}</Badge>
                    <p className="mt-2 font-mono text-xs">{formatPaise(order.totalAmountPaise)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-paper/15 bg-obsidian p-4 text-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {draft.orderNumber && step > 0 ? (
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 shrink-0"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              aria-label="Previous step"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          {!draft.orderNumber ? (
            <Button className="h-14 flex-1 text-base" onClick={startOrder}>
              <Plus className="h-5 w-5" /> Start order
            </Button>
          ) : step < 3 ? (
            <Button
              className="h-14 flex-1 text-base"
              disabled={!canAdvance}
              onClick={() => setStep((current) => Math.min(3, current + 1))}
            >
              Continue <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button className="h-14 flex-1 text-base" disabled={busy} onClick={() => void submitOrder()}>
              {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {online ? "Submit order" : "Queue submission"}
            </Button>
          )}
          {draft.orderNumber ? (
            <Button
              variant="outline"
              className="h-14 shrink-0 px-4"
              onClick={() => void queueDraft("draft")}
              disabled={busy}
            >
              <CloudOff className="h-5 w-5" /> Draft
            </Button>
          ) : null}
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">{detail?.orderNumber}</SheetTitle>
            <SheetDescription>
              {detail?.customerName} · {detail?.status.replaceAll("_", " ")}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-6 pb-8">
            {detail?.lines.map((line) => (
              <div key={line.id} className="border border-paper/15 p-4 text-sm">
                <p className="font-semibold text-paper">{line.productName}</p>
                <p className="mt-1 font-mono text-xs text-paper/60">
                  {line.quantityPackets} packets × {formatPaise(line.unitPricePaise)}
                </p>
                <p className="mt-2 font-mono text-signal">{formatPaise(line.lineTotalPaise)}</p>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-paper/20 pt-4">
              <span className="text-paper/60">Order total</span>
              <span className="font-mono text-xl text-signal">{formatPaise(detail?.totalAmountPaise ?? 0)}</span>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setDetailOpen(false)}>
              <ClipboardList className="h-4 w-4" /> Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
