"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  CloudOff,
  CloudUpload,
  Pencil,
  Plus,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPaise } from "@/domain";
import {
  createIdempotencyKey,
  getOfflineQueueSummary,
  listOfflineOrders,
  markOfflineOrderFailed,
  queueOfflineOrder,
  removeOfflineOrder,
  saveOfflineOrder,
  subscribeToOfflineChanges,
  type OfflineOrderPayloadInput,
  type OfflineOrderRecord,
  type OfflineOrderState,
  type OfflineQueueSummary,
} from "@/lib/offline/queue";
import { getSalesReferenceCache, saveSalesReferenceCache, toSalesReferenceCache } from "@/lib/offline/reference-cache";
import { syncQueuedOrders } from "@/lib/offline/sync";
import type { SalesOrderDetail, SalesOrderSummary } from "@/lib/workflows/sales";
import { parseAmount, salesApiRequest, salesFieldClass, salesLabelClass, salesStatusVariant } from "./sales-shared";

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
  focus?: string;
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

type OfflineSyncResult = {
  attempted: number;
  synced: number;
  replayed: number;
  failed: number;
  errors: string[];
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
const emptySummary: OfflineQueueSummary = {
  total: 0,
  drafts: 0,
  pending: 0,
  failed: 0,
  synced: 0,
  lastSuccessfulSync: null,
};
const emptySyncResult: OfflineSyncResult = { attempted: 0, synced: 0, replayed: 0, failed: 0, errors: [] };

function offlineStateVariant(state: OfflineOrderState) {
  if (state === "synced") return "default" as const;
  if (state === "queued" || state === "syncing") return "machine" as const;
  if (state === "failed") return "rust" as const;
  return "outline" as const;
}

function formatSyncTime(value: string | null) {
  if (!value) return "never";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function toPayload(draft: Draft): OfflineOrderPayloadInput {
  return {
    orderNumber: draft.orderNumber,
    customerId: draft.customerId,
    productId: draft.productId,
    quantityPackets: draft.quantity,
    unitPrice: draft.unitPrice,
    discount: draft.discount,
    orderDate: new Date().toISOString().slice(0, 10),
    requestedDate: draft.requestedDate,
    notes: draft.notes,
  };
}

function toDraft(record: OfflineOrderRecord): Draft {
  return {
    orderNumber: record.payload.orderNumber,
    customerId: record.payload.customerId,
    productId: record.payload.productId,
    quantity: record.payload.quantityPackets,
    unitPrice: record.payload.unitPrice,
    discount: record.payload.discount,
    requestedDate: record.payload.requestedDate,
    notes: record.payload.notes,
  };
}

export function SalesmanMobileOrders({ initialOrders, options, canManage, focus }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [referenceOptions, setReferenceOptions] = useState(options);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [online, setOnline] = useState(true);
  const [offlineOrders, setOfflineOrders] = useState<OfflineOrderRecord[]>([]);
  const [summary, setSummary] = useState<OfflineQueueSummary>(emptySummary);
  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const syncingRef = useRef(false);
  const focusOpenedRef = useRef<string | null>(null);
  const synchronizeRef = useRef<() => Promise<OfflineSyncResult>>(async () => emptySyncResult);

  const activeCustomer = useMemo(
    () => referenceOptions.customers.find((customer) => customer.id === Number(draft.customerId)),
    [draft.customerId, referenceOptions.customers],
  );
  const activeProduct = useMemo(
    () => referenceOptions.products.find((product) => product.id === Number(draft.productId)),
    [draft.productId, referenceOptions.products],
  );
  const estimatePaise = useMemo(() => {
    const quantity = Math.max(0, Number(draft.quantity) || 0);
    return Math.max(0, parseAmount(draft.unitPrice) - parseAmount(draft.discount)) * quantity;
  }, [draft.discount, draft.quantity, draft.unitPrice]);
  const editableOfflineOrders = offlineOrders.filter((record) => record.state === "draft");
  const visibleOfflineOrders = showAllQueue ? offlineOrders : offlineOrders.slice(0, 8);
  const visibleOrders = showAllHistory ? orders : orders.slice(0, 8);

  async function refreshOfflineState() {
    const [records, queueSummary] = await Promise.all([listOfflineOrders(), getOfflineQueueSummary()]);
    setOfflineOrders(records);
    setSummary(queueSummary);
  }

  async function refreshOrders() {
    if (!navigator.onLine) return;
    const data = await salesApiRequest<{ orders: SalesOrderSummary[] }>("/api/sales/orders");
    setOrders(data.orders);
  }

  async function synchronize(): Promise<OfflineSyncResult> {
    if (syncingRef.current) return emptySyncResult;
    syncingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await syncQueuedOrders();
      await refreshOfflineState();
      await refreshOrders().catch(() => undefined);
      if (result.failed > 0) {
        setError(result.errors.join(" · "));
      } else if (result.synced > 0) {
        setNotice(
          `${result.synced} order${result.synced === 1 ? "" : "s"} synchronized${
            result.replayed > 0 ? ` · ${result.replayed} replayed safely` : ""
          }.`,
        );
      }
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Synchronization could not start.";
      setError(message);
      return { ...emptySyncResult, failed: 1, errors: [message] };
    } finally {
      syncingRef.current = false;
      setBusy(false);
    }
  }

  synchronizeRef.current = synchronize;

  const openDetail = useCallback(async (orderNumber: string) => {
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
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshOfflineState().catch(() => undefined);
    const handleOnline = () => {
      setOnline(true);
      void synchronizeRef.current();
    };
    const handleOffline = () => {
      setOnline(false);
      setError(null);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const unsubscribe = subscribeToOfflineChanges(() => {
      void refreshOfflineState().catch(() => undefined);
    });
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!focus || focusOpenedRef.current === focus || !navigator.onLine) return;
    if (!orders.some((order) => order.orderNumber === focus)) return;
    focusOpenedRef.current = focus;
    void openDetail(focus);
  }, [focus, orders, openDetail]);

  useEffect(() => {
    let mounted = true;
    const prepareReferences = async () => {
      try {
        const cached = await getSalesReferenceCache();
        if (!mounted) return;
        if (cached && !navigator.onLine) {
          setReferenceOptions({
            customers: cached.customers.map((option) => ({
              id: option.id,
              code: option.code,
              name: option.name,
              customerType: option.customerType,
              state: option.state,
              packetGrams: option.packetGrams,
              hsnCode: option.hsnCode,
            })),
            products: cached.products.map((option) => ({
              id: option.id,
              code: option.code,
              name: option.name,
              packetGrams: option.packetGrams,
              hsnCode: option.hsnCode,
            })),
          });
        }
        if (navigator.onLine) {
          await saveSalesReferenceCache(
            toSalesReferenceCache({
              customers: options.customers as unknown as Array<Record<string, unknown>>,
              products: options.products as unknown as Array<Record<string, unknown>>,
            }),
          );
        }
      } catch {
        return;
      }
    };
    void prepareReferences();
    return () => {
      mounted = false;
    };
  }, [options]);

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
    setNotice(null);
  }

  function startOrder() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    setActiveId(null);
    setDraft({ ...emptyDraft, orderNumber: `SO-M-${stamp}`, customerId: String(referenceOptions.customers[0]?.id ?? "") });
    setStep(0);
    setError(null);
    setNotice(null);
  }

  function editRecord(record: OfflineOrderRecord) {
    setActiveId(record.id);
    setDraft(toDraft(record));
    setStep(0);
    setError(null);
    setNotice(null);
  }

  async function saveDraft() {
    if (!draft.orderNumber) {
      setError("Start an order before saving a draft.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const record = await saveOfflineOrder(toPayload(draft), {
        idempotencyKey: activeId ?? createIdempotencyKey(),
        state: "draft",
      });
      setActiveId(record.id);
      await refreshOfflineState();
      setNotice(`Draft ${record.orderNumber} saved on this device.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function queueSubmission() {
    if (!canManage) {
      setError("Your role cannot create sales orders.");
      return;
    }
    if (!draft.orderNumber) {
      setError("Start an order before queueing it.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const orderNumber = draft.orderNumber;
    try {
      await saveOfflineOrder(toPayload(draft), {
        idempotencyKey: activeId ?? createIdempotencyKey(),
        state: "queued",
      });
      setActiveId(null);
      setDraft(emptyDraft);
      setStep(0);
      await refreshOfflineState();
      if (navigator.onLine) {
        const result = await synchronize();
        if (result.synced > 0) {
          try {
            const data = await salesApiRequest<{ detail: SalesOrderDetail }>(
              `/api/sales/orders/${encodeURIComponent(orderNumber)}`,
            );
            setDetail(data.detail);
            setDetailOpen(true);
          } catch {
            setNotice(`${orderNumber} synchronized. Open it from field history for details.`);
          }
        }
      } else {
        setNotice(`${orderNumber} queued with a unique sync key. It will submit automatically when online.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be queued.");
    } finally {
      setBusy(false);
    }
  }

  async function retryRecord(record: OfflineOrderRecord) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await queueOfflineOrder(record.id);
      await refreshOfflineState();
      if (navigator.onLine) await synchronize();
      else setNotice(`${record.orderNumber} is queued again and will retry when online.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be retried.");
    } finally {
      setBusy(false);
    }
  }

  async function retryAllFailed() {
    const failed = offlineOrders.filter((record) => record.state === "failed");
    if (failed.length === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      for (const record of failed) {
        await queueOfflineOrder(record.id);
      }
      await refreshOfflineState();
      if (navigator.onLine) await synchronize();
      else setNotice(`${failed.length} order${failed.length === 1 ? "" : "s"} queued again for retry.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed orders could not be requeued.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(record: OfflineOrderRecord) {
    setBusy(true);
    try {
      await removeOfflineOrder(record.id);
      await refreshOfflineState();
      setNotice(`${record.orderNumber} removed from this device.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The local record could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetRecord(record: OfflineOrderRecord) {
    setBusy(true);
    try {
      await markOfflineOrderFailed(record.id, "Synchronization was reset manually. Retry or remove this order.");
      await refreshOfflineState();
      setNotice(`${record.orderNumber} was reset and can be retried or removed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The local record could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  const canAdvance =
    (step === 0 && Boolean(draft.customerId)) ||
    (step === 1 && Boolean(draft.productId)) ||
    (step === 2 && Number(draft.quantity) > 0 && parseAmount(draft.unitPrice) > 0) ||
    step === 3;

  return (
    <div className="mx-auto w-full max-w-3xl pb-40">
      <header className="surface-dark px-5 py-7 text-paper">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mono-label text-signal">SALESMAN CONSOLE / PHASE 8</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Orders, one hand at a time.</h1>
            <p className="mt-2 max-w-md text-sm text-paper/65">
              Durable drafts, visible sync states, and safe retries when the network is unreliable.
            </p>
          </div>
          <div className="min-w-0 border border-paper/20 px-3 py-2 sm:text-right">
            <p className="mono-label text-paper/50">{online ? "CONNECTED" : "OFFLINE"}</p>
            <p className="mt-1 font-mono text-sm text-signal">
              {summary.pending} pending · {summary.failed} failed
            </p>
            <p className="mt-1 font-mono text-xs text-paper/55">
              Last sync {formatSyncTime(summary.lastSuccessfulSync)}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void synchronize()}
            disabled={busy || !online || summary.pending === 0}
          >
            <CloudUpload className="h-4 w-4" /> Sync now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void retryAllFailed()}
            disabled={busy || summary.failed === 0}
          >
            <RefreshCw className="h-4 w-4" /> Retry failed
          </Button>
        </div>
      </header>

      <div className="space-y-5 px-5 pt-5">
        {error ? (
          <p role="alert" className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" aria-live="polite" className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">
            {notice}
          </p>
        ) : null}

        {!online ? (
          <div role="status" aria-live="polite" className="flex items-start gap-3 border border-rust/30 bg-rust/10 p-4 text-sm text-rust">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              You are offline. Orders saved here stay on this device with a unique key and sync in order
              when the connection returns.
            </p>
          </div>
        ) : null}

        <section aria-label="Saved on this device" className="border border-obsidian/15 bg-paper p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono-label text-machine">LOCAL QUEUE</p>
              <h2 className="mt-1 text-lg font-semibold">Saved orders</h2>
            </div>
            <p className="font-mono text-xs text-machine">{summary.total} total</p>
          </div>
          <div className="mt-4 space-y-3">
            {offlineOrders.length === 0 ? (
              <p className="border border-dashed border-obsidian/20 p-6 text-center text-sm text-machine">
                No orders saved on this device yet.
              </p>
            ) : (
              visibleOfflineOrders.map((record) => (
                <div key={record.id} className="min-w-0 border border-obsidian/15 bg-white/50 p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm">{record.orderNumber}</p>
                      <p className="mt-1 text-sm text-machine">
                        {referenceOptions.customers.find((item) => item.id === Number(record.payload.customerId))
                          ?.name ?? `Customer ${record.payload.customerId}`}
                      </p>
                      <p className="mt-1 font-mono text-xs text-machine">
                        {record.payload.quantityPackets} packets · {record.state.replaceAll("_", " ")}
                      </p>
                    </div>
                    <Badge variant={offlineStateVariant(record.state)}>{record.state}</Badge>
                  </div>
                  {record.lastError ? (
                    <p className="mt-3 flex items-start gap-2 border-l-2 border-rust bg-rust/10 px-3 py-2 text-xs text-rust">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{record.lastError}</span>
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editableOfflineOrders.some((item) => item.id === record.id) ? (
                      <Button variant="outline" size="sm" onClick={() => editRecord(record)} disabled={busy}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    ) : null}
                    {record.state === "failed" ? (
                      <Button variant="outline" size="sm" onClick={() => void retryRecord(record)} disabled={busy}>
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    ) : null}
                    {record.state === "syncing" ? (
                      <Button variant="outline" size="sm" onClick={() => void resetRecord(record)} disabled={busy}>
                        Reset
                      </Button>
                    ) : null}
                    {record.state !== "syncing" ? (
                      <Button variant="ghost" size="sm" onClick={() => void removeRecord(record)} disabled={busy}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          {offlineOrders.length > 8 ? (
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowAllQueue((value) => !value)}>
              {showAllQueue ? "Show recent 8" : `Show all ${offlineOrders.length}`}
            </Button>
          ) : null}
        </section>

        <section aria-label="New order" className="border border-obsidian/15 bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono-label text-machine">STEP {step + 1} / 4</p>
              <h2 className="mt-1 text-xl font-semibold">{steps[step]}</h2>
            </div>
            {draft.orderNumber ? (
              <Button variant="outline" onClick={() => {
                setActiveId(null);
                setDraft(emptyDraft);
                setStep(0);
              }} className="min-h-11">
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
                    {referenceOptions.customers.map((customer) => (
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
                    {referenceOptions.products.map((product) => (
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
                <div className="surface-dark flex items-center justify-between gap-3 p-4 text-paper">
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
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-machine">Customer</span>
                    <span className="text-right font-semibold">{activeCustomer?.name ?? "—"}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-sm">
                    <span className="text-machine">Product</span>
                    <span className="text-right font-semibold">{activeProduct?.name ?? "—"}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-sm">
                    <span className="text-machine">Packets</span>
                    <span className="font-mono">{draft.quantity}</span>
                  </div>
                  <div className="mt-3 flex justify-between gap-3 border-t border-obsidian/15 pt-3">
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refreshOrders().catch((caught) => setError(String(caught)))}
              aria-label="Refresh orders"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {orders.length === 0 ? (
              <p className="border border-dashed border-obsidian/20 p-6 text-center text-sm text-machine">
                No synchronized orders yet. Queue one locally to start.
              </p>
            ) : (
              visibleOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => void openDetail(order.orderNumber)}
                  className="flex w-full items-center justify-between gap-3 border border-obsidian/15 bg-paper/70 p-4 text-left transition-colors hover:border-forest"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{order.orderNumber}</p>
                    <p className="mt-1 truncate text-sm text-machine">{order.customerName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={salesStatusVariant(order.status)}>{order.status.replaceAll("_", " ")}</Badge>
                    <p className="mt-2 font-mono text-xs">{formatPaise(order.totalAmountPaise)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
          {orders.length > 8 ? (
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowAllHistory((value) => !value)}>
              {showAllHistory ? "Show recent 8" : `Show all ${orders.length}`}
            </Button>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-paper/15 bg-obsidian p-4 text-paper">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
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
            <Button className="h-14 flex-1 text-base" disabled={busy || !canManage} onClick={() => void queueSubmission()}>
              {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {online ? "Queue and sync" : "Queue for later"}
            </Button>
          )}
          {draft.orderNumber ? (
            <Button
              variant="outline"
              className="h-14 shrink-0 px-3 sm:px-4"
              onClick={() => void saveDraft()}
              disabled={busy}
            >
              <CloudOff className="h-5 w-5" /> <span className="hidden sm:inline">Save draft</span>
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
