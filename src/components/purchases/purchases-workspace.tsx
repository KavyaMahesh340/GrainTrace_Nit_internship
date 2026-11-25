"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, PackageCheck, Plus, Search, X } from "lucide-react";
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
import type {
  PurchaseOrderDetail,
  PurchaseOrderSummary,
  GoodsReceiptSummary,
} from "@/lib/workflows/purchases";

type MaterialOption = {
  id: number;
  code: string;
  name: string;
  unit: string;
  kind: "raw" | "packaging";
};

type Supplier = {
  id: number;
  code: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
};

type Props = {
  initialOrders: PurchaseOrderSummary[];
  initialReceipts: GoodsReceiptSummary[];
  suppliers: Supplier[];
  materials: MaterialOption[];
  canManage: boolean;
  focus?: string;
};

type Tab = "orders" | "receipts" | "suppliers";

const tabItems: readonly { value: Tab; label: string; hint?: string }[] = [
  { value: "orders", label: "Orders", hint: "Commitments" },
  { value: "receipts", label: "Receipts", hint: "Ledger entries" },
  { value: "suppliers", label: "Suppliers", hint: "Master" },
];

type PoLineDraft = {
  kind: "raw" | "packaging";
  materialId: number;
  quantity: string;
  unitCostPaise: string;
};
type ReceiptLineDraft = {
  sourceLineId: number;
  kind: "raw" | "packaging";
  remaining: number;
  unit: string;
  acceptedQuantity: string;
  damagedQuantity: string;
  rejectedQuantity: string;
  lotCode: string;
  expiresAt: string;
  unitCostPaise: string;
};

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
  if (status === "received") return "default";
  if (status === "approved" || status === "partially_received") return "machine";
  if (status === "cancelled") return "rust";
  return "outline";
}

function nextStatuses(status: string) {
  if (status === "draft") return ["submitted", "cancelled"];
  if (status === "submitted") return ["approved", "cancelled"];
  if (status === "approved") return ["cancelled"];
  return [];
}

function fieldClass() {
  return "h-11 w-full rounded-sm border border-obsidian/25 bg-paper px-3 text-sm text-obsidian focus-visible:border-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/25";
}

export function PurchasesWorkspace({ initialOrders, initialReceipts, suppliers, materials, canManage, focus }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState(initialOrders);
  const [receipts, setReceipts] = useState(initialReceipts);
  const [supplierRows, setSupplierRows] = useState(suppliers);
  const [query, setQuery] = useState(focus ?? "");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [poDraft, setPoDraft] = useState<{
    orderNumber: string;
    supplierId: string;
    orderDate: string;
    expectedDate: string;
    lines: PoLineDraft[];
  }>({
    orderNumber: "",
    supplierId: String(suppliers[0]?.id ?? ""),
    orderDate: today,
    expectedDate: "",
    lines: [{ kind: "raw" as const, materialId: materials[0]?.id ?? 0, quantity: "", unitCostPaise: "" }],
  });

  const [receiptDraft, setReceiptDraft] = useState({
    orderNumber: "",
    receiptNumber: "",
    receivedAt: today,
    notes: "",
    lines: [] as ReceiptLineDraft[],
  });

  const [supplierDraft, setSupplierDraft] = useState({
    code: "",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
  });

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery =
        needle.length === 0 ||
        order.orderNumber.toLowerCase().includes(needle) ||
        order.supplierName.toLowerCase().includes(needle);
      const matchesStatus = status === "all" || order.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [orders, query, status]);

  async function refresh() {
    const [orderData, receiptData, supplierData] = await Promise.all([
      apiRequest<{ orders: PurchaseOrderSummary[] }>("/api/purchases/orders"),
      apiRequest<{ receipts: GoodsReceiptSummary[] }>("/api/purchases/receipts"),
      apiRequest<{ suppliers: Supplier[] }>("/api/purchases/suppliers"),
    ]);
    setOrders(orderData.orders);
    setReceipts(receiptData.receipts);
    setSupplierRows(supplierData.suppliers);
    router.refresh();
  }

  function handleError(caught: unknown) {
    setError(caught instanceof Error ? caught.message : "The request could not be completed.");
    setNotice(null);
  }

  async function openDetail(orderNumber: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<{ order: PurchaseOrderDetail }>(
        `/api/purchases/orders/${encodeURIComponent(orderNumber)}`,
      );
      setDetail(data.order);
      setDetailOpen(true);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt(order: PurchaseOrderSummary) {
    if (!canManage || (order.status !== "approved" && order.status !== "partially_received")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<{ order: PurchaseOrderDetail }>(
        `/api/purchases/orders/${encodeURIComponent(order.orderNumber)}`,
      );
      setReceiptDraft({
        orderNumber: data.order.orderNumber,
        receiptNumber: "",
        receivedAt: today,
        notes: "",
        lines: data.order.lines
          .map((line) => ({
            sourceLineId: line.id,
            kind: line.kind,
            remaining: line.quantity - line.receivedQuantity,
            unit: line.unit,
            acceptedQuantity: String(line.quantity - line.receivedQuantity),
            damagedQuantity: "0",
            rejectedQuantity: "0",
            lotCode: "",
            expiresAt: "",
            unitCostPaise: String(line.unitCostPaise),
          }))
          .filter((line) => line.remaining > 0),
      });
      setReceiptOpen(true);
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function submitPo(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: poDraft.orderNumber,
          supplierId: Number(poDraft.supplierId),
          orderDate: poDraft.orderDate,
          expectedDate: poDraft.expectedDate,
          lines: poDraft.lines.map((line) => ({
            kind: line.kind,
            ...(line.kind === "raw"
              ? { rawMaterialId: Number(line.materialId) }
              : { packagingMaterialId: Number(line.materialId) }),
            quantity: Number(line.quantity),
            unitCostPaise: Number(line.unitCostPaise),
          })),
        }),
      });
      setPoOpen(false);
      setPoDraft({
        orderNumber: "",
        supplierId: String(supplierRows[0]?.id ?? ""),
        orderDate: today,
        expectedDate: "",
        lines: [{ kind: "raw", materialId: materials[0]?.id ?? 0, quantity: "", unitCostPaise: "" }],
      });
      setNotice("Purchase order created as a draft.");
      await refresh();
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function submitReceipt(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/purchases/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptNumber: receiptDraft.receiptNumber,
          purchaseOrderId: orders.find((order) => order.orderNumber === receiptDraft.orderNumber)?.id,
          receivedAt: receiptDraft.receivedAt,
          notes: receiptDraft.notes,
          lines: receiptDraft.lines.map((line) => ({
            sourceLineId: line.sourceLineId,
            kind: line.kind,
            acceptedQuantity: Number(line.acceptedQuantity),
            damagedQuantity: Number(line.damagedQuantity),
            rejectedQuantity: Number(line.rejectedQuantity),
            lotCode: line.lotCode,
            expiresAt: line.expiresAt,
            unitCostPaise: Number(line.unitCostPaise),
          })),
        }),
      });
      setReceiptOpen(false);
      setNotice("Receipt posted to inventory ledger.");
      await refresh();
      if (detailOpen && detail) {
        await openDetail(detail.orderNumber);
      }
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function submitSupplier(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierDraft),
      });
      setSupplierOpen(false);
      setSupplierDraft({ code: "", name: "", contactName: "", email: "", phone: "", city: "" });
      setNotice("Supplier added.");
      await refresh();
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(statusValue: string) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/purchases/orders/${encodeURIComponent(detail.orderNumber)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      setNotice(`Order moved to ${statusValue.replace("_", " ")}.`);
      await openDetail(detail.orderNumber);
      await refresh();
    } catch (caught) {
      handleError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        code="03 / Procurement control desk"
        title="Purchases"
        description="Orders are commitments. Stock appears only when a receipt is posted, with lot identity, cost, and ledger source attached."
        footnote="Commitment → receipt → stock"
        tone="light"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-obsidian/15 bg-obsidian/10">
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Open orders</p>
                <p className="mt-2 font-mono text-2xl tabular">
                  {orders.filter((order) => !["received", "cancelled"].includes(order.status)).length}
                </p>
              </div>
              <div className="bg-paper p-4">
                <p className="mono-label text-ink-muted">Receipts</p>
                <p className="mt-2 font-mono text-2xl tabular">{receipts.length}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManage ? (
                <>
                  <Button onClick={() => setPoOpen(true)}><FilePlus2 className="h-3.5 w-3.5" /> New order</Button>
                  <Button variant="outline" onClick={() => setSupplierOpen(true)}><Plus className="h-3.5 w-3.5" /> Supplier</Button>
                </>
              ) : (
                <p className="text-xs leading-6 text-ink-muted">Read-only access. Posting requires purchase management permission.</p>
              )}
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
      {error ? <Notice tone="error" className="mb-8">{error}</Notice> : null}
      {notice ? <Notice tone="success" className="mb-8">{notice}</Notice> : null}

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <MotionTabs label="Procurement views" value={tab} onChange={setTab} items={tabItems} />
        {tab === "orders" ? (
          <div className="flex w-full flex-wrap items-center gap-2 border border-obsidian/15 bg-paper p-2 sm:w-auto">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search order or supplier"
                className="pl-9"
                aria-label="Search purchase orders"
              />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${fieldClass()} sm:w-40`} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {["draft", "submitted", "approved", "partially_received", "received", "cancelled"].map((item) => (
                <option key={item} value={item}>{item.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {tab === "orders" ? (
        <TableFrame
          className="mt-6"
          title="Order book"
          description="Commitments with delivery progress and value"
          actions={<span className="mono-caption text-ink-muted">{filteredOrders.length} orders in view</span>}
        >
          {filteredOrders.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="mono-label text-ink-muted">No matching orders</p>
              <p className="mt-3 text-sm text-ink-muted">Adjust the search or create a draft order.</p>
            </div>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Order</th>
                  <th scope="col" className="px-3 py-4 font-medium">Supplier</th>
                  <th scope="col" className="px-3 py-4 font-medium">Status</th>
                  <th scope="col" className="px-3 py-4 font-medium">Receipt progress</th>
                  <th scope="col" className="px-3 py-4 font-medium">Order date</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="data-row">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => openDetail(order.orderNumber)} className="font-mono text-xs font-medium underline-offset-4 hover:underline">
                        {order.orderNumber}
                      </button>
                      <p className="mono-label mt-1 text-ink-muted">{order.lineCount} lines · {formatPaise(order.totalAmountPaise)}</p>
                    </td>
                    <td className="px-3 py-4 text-sm">{order.supplierName}</td>
                    <td className="px-3 py-4"><Badge variant={statusVariant(order.status)}>{order.status.replace("_", " ")}</Badge></td>
                    <td className="px-3 py-4">
                      <div
                        className="meter-track w-28"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={order.status === "received" ? 100 : order.status === "partially_received" ? 55 : 0}
                        aria-label={`${order.orderNumber} receipt progress`}
                      >
                        <div
                          className="h-full bg-forest"
                          style={{ width: `${order.status === "received" ? 100 : order.status === "partially_received" ? 55 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{order.orderDate.slice(0, 10)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openDetail(order.orderNumber)}>Inspect</Button>
                        <Button
                          size="sm"
                          onClick={() => openReceipt(order)}
                          disabled={!canManage || !["approved", "partially_received"].includes(order.status) || busy}
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> Receive
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableFrame>
      ) : null}

      {tab === "receipts" ? (
        <TableFrame
          className="mt-6"
          title="Receipt ledger"
          description="Posted stock entries with lot and exception counts"
          actions={<span className="mono-caption text-ink-muted">{receipts.length} entries</span>}
        >
          {receipts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="mono-label text-ink-muted">No receipts posted</p>
              <p className="mt-3 text-sm text-ink-muted">Approve an order, then record actual delivered quantities.</p>
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Receipt</th>
                  <th scope="col" className="px-3 py-4 font-medium">Order</th>
                  <th scope="col" className="px-3 py-4 font-medium">Received</th>
                  <th scope="col" className="px-3 py-4 font-medium">Accepted</th>
                  <th scope="col" className="px-3 py-4 font-medium">Exceptions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{receipt.receiptNumber}</td>
                    <td className="px-3 py-4 font-mono text-xs text-ink-muted">{receipt.orderNumber}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular">{receipt.receivedAt.slice(0, 10)}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular">{receipt.acceptedQuantity}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular text-rust-ink">
                      {receipt.damagedQuantity} damaged / {receipt.rejectedQuantity} rejected
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableFrame>
      ) : null}

      {tab === "suppliers" ? (
        <TableFrame
          className="mt-6"
          title="Supplier master"
          description="Approved sources and contact points"
          actions={<span className="mono-caption text-ink-muted">{supplierRows.length} suppliers</span>}
        >
          {supplierRows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="mono-label text-ink-muted">No suppliers</p>
              <p className="mt-3 text-sm text-ink-muted">Add a supplier before creating purchase orders.</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Code</th>
                  <th scope="col" className="px-3 py-4 font-medium">Supplier</th>
                  <th scope="col" className="px-3 py-4 font-medium">Contact</th>
                  <th scope="col" className="px-3 py-4 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((supplier) => (
                  <tr key={supplier.id} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{supplier.code}</td>
                    <td className="px-3 py-4 text-sm">{supplier.name}</td>
                    <td className="px-3 py-4 text-xs text-ink-muted">{supplier.contactName || supplier.email || supplier.phone || "—"}</td>
                    <td className="px-3 py-4 text-xs text-ink-muted">{supplier.city || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableFrame>
      ) : null}

      {poOpen ? (
        <section className="mt-10 border border-obsidian/20 bg-sage/20" aria-labelledby="purchases-order-form">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian/15 px-5 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">04 / New commitment</p>
              <h2 id="purchases-order-form" className="mt-2 text-2xl font-semibold tracking-tight">Purchase order</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPoOpen(false)} aria-label="Close order form"><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={submitPo} className="space-y-5 p-5 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Order number</span><Input required pattern="[A-Za-z0-9_-]{2,64}" value={poDraft.orderNumber} onChange={(event) => setPoDraft({ ...poDraft, orderNumber: event.target.value })} /></label>
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Supplier</span><select required className={fieldClass()} value={poDraft.supplierId} onChange={(event) => setPoDraft({ ...poDraft, supplierId: event.target.value })}>{supplierRows.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Order date</span><Input required type="date" value={poDraft.orderDate} onChange={(event) => setPoDraft({ ...poDraft, orderDate: event.target.value })} /></label>
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Expected date</span><Input type="date" value={poDraft.expectedDate} onChange={(event) => setPoDraft({ ...poDraft, expectedDate: event.target.value })} /></label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="mono-label text-ink-muted">Order lines</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setPoDraft({ ...poDraft, lines: [...poDraft.lines, { kind: "raw", materialId: materials[0]?.id ?? 0, quantity: "", unitCostPaise: "" }] })}><Plus className="h-3.5 w-3.5" /> Line</Button>
              </div>
              {poDraft.lines.map((line, index) => (
                <div key={index} className="grid min-w-0 gap-3 border border-obsidian/10 bg-paper p-3 sm:grid-cols-5">
                  <select className={fieldClass()} value={line.kind} onChange={(event) => {
                    const kind = event.target.value as "raw" | "packaging";
                    const first = materials.find((material) => material.kind === kind);
                    setPoDraft({ ...poDraft, lines: poDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, kind, materialId: first?.id ?? 0 } : item) });
                  }}>
                    <option value="raw">Raw material</option>
                    <option value="packaging">Packaging</option>
                  </select>
                  <select className={fieldClass()} value={line.materialId} onChange={(event) => setPoDraft({ ...poDraft, lines: poDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, materialId: Number(event.target.value) } : item) })}>
                    {materials.filter((material) => material.kind === line.kind).map((material) => <option key={material.id} value={material.id}>{material.code} · {material.name}</option>)}
                  </select>
                  <Input required type="number" min={1} step={1} placeholder="Quantity (base units)" value={line.quantity} onChange={(event) => setPoDraft({ ...poDraft, lines: poDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item) })} />
                  <Input required type="number" min={0} step={1} placeholder="Unit cost (paise)" value={line.unitCostPaise} onChange={(event) => setPoDraft({ ...poDraft, lines: poDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, unitCostPaise: event.target.value } : item) })} />
                  <Button type="button" variant="outline" onClick={() => setPoDraft({ ...poDraft, lines: poDraft.lines.filter((_, itemIndex) => itemIndex !== index) })} disabled={poDraft.lines.length === 1}>Remove</Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end"><Button type="submit" disabled={busy || !poDraft.supplierId || supplierRows.length === 0}>Create draft order</Button></div>
          </form>
        </section>
      ) : null}

      {receiptOpen ? (
        <section className="mt-10 border border-obsidian/20 bg-sage/20" aria-labelledby="purchases-receipt-form">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian/15 px-5 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">05 / Goods receipt</p>
              <h2 id="purchases-receipt-form" className="mt-2 text-2xl font-semibold tracking-tight">{receiptDraft.orderNumber}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setReceiptOpen(false)} aria-label="Close receipt form"><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={submitReceipt} className="space-y-5 p-5 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Receipt number</span><Input required pattern="[A-Za-z0-9_-]{2,64}" value={receiptDraft.receiptNumber} onChange={(event) => setReceiptDraft({ ...receiptDraft, receiptNumber: event.target.value })} /></label>
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Received at</span><Input required type="date" value={receiptDraft.receivedAt} onChange={(event) => setReceiptDraft({ ...receiptDraft, receivedAt: event.target.value })} /></label>
              <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Notes</span><Input value={receiptDraft.notes} onChange={(event) => setReceiptDraft({ ...receiptDraft, notes: event.target.value })} /></label>
            </div>
            <div className="space-y-3">
              {receiptDraft.lines.length === 0 ? (
                <p className="border border-obsidian/15 bg-paper px-4 py-6 text-sm text-ink-muted">This order has no remaining quantity to receive.</p>
              ) : null}
              {receiptDraft.lines.map((line, index) => (
                <div key={line.sourceLineId} className="grid min-w-0 gap-3 border border-obsidian/10 bg-paper p-3 sm:grid-cols-7">
                  <div className="sm:col-span-7"><p className="mono-label text-ink-muted">Line {line.sourceLineId} · {line.remaining} remaining {line.unit}</p></div>
                  <Input required type="number" min={1} step={1} placeholder="Accepted" value={line.acceptedQuantity} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, acceptedQuantity: event.target.value } : item) })} />
                  <Input required type="number" min={0} step={1} placeholder="Damaged" value={line.damagedQuantity} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, damagedQuantity: event.target.value } : item) })} />
                  <Input required type="number" min={0} step={1} placeholder="Rejected" value={line.rejectedQuantity} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, rejectedQuantity: event.target.value } : item) })} />
                  <Input required pattern="[A-Za-z0-9_-]{2,64}" placeholder="Lot code" value={line.lotCode} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, lotCode: event.target.value } : item) })} />
                  <Input type="date" placeholder="Expiry" value={line.expiresAt} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, expiresAt: event.target.value } : item) })} />
                  <Input required type="number" min={0} step={1} placeholder="Unit cost (paise)" value={line.unitCostPaise} onChange={(event) => setReceiptDraft({ ...receiptDraft, lines: receiptDraft.lines.map((item, itemIndex) => itemIndex === index ? { ...item, unitCostPaise: event.target.value } : item) })} />
                </div>
              ))}
            </div>
            <div className="flex justify-end"><Button type="submit" disabled={busy || receiptDraft.lines.length === 0}>Post receipt to ledger</Button></div>
          </form>
        </section>
      ) : null}

      {supplierOpen ? (
        <section className="mt-10 border border-obsidian/20 bg-sage/20" aria-labelledby="purchases-supplier-form">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-obsidian/15 px-5 py-5 sm:px-8">
            <div className="min-w-0">
              <p className="mono-label text-rust-ink">06 / Supplier master</p>
              <h2 id="purchases-supplier-form" className="mt-2 text-2xl font-semibold tracking-tight">Add supplier</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSupplierOpen(false)} aria-label="Close supplier form"><X className="h-4 w-4" /></Button>
          </div>
          <form onSubmit={submitSupplier} className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Code</span><Input required pattern="[A-Za-z0-9_-]{2,64}" value={supplierDraft.code} onChange={(event) => setSupplierDraft({ ...supplierDraft, code: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Name</span><Input required value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Contact</span><Input value={supplierDraft.contactName} onChange={(event) => setSupplierDraft({ ...supplierDraft, contactName: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Email</span><Input type="email" value={supplierDraft.email} onChange={(event) => setSupplierDraft({ ...supplierDraft, email: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">Phone</span><Input value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })} /></label>
            <label className="min-w-0 space-y-2"><span className="mono-label text-ink-muted">City</span><Input value={supplierDraft.city} onChange={(event) => setSupplierDraft({ ...supplierDraft, city: event.target.value })} /></label>
            <div className="sm:col-span-3"><Button type="submit" disabled={busy}>Add supplier</Button></div>
          </form>
        </section>
      ) : null}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="sm:max-w-2xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-rust-ink">Purchase order</p>
            <SheetTitle className="text-2xl">{detail?.orderNumber ?? "Loading"}</SheetTitle>
            <SheetDescription>{detail ? `${detail.supplierName} · ${detail.orderDate.slice(0, 10)}` : "Fetching document"}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {detail ? (
              <>
                <MetricGrid
                  className="mt-6 border border-paper/10"
                  columns={3}
                  items={[
                    { label: "Status", value: detail.status.replace("_", " "), tone: "dark" },
                    { label: "Value", value: formatPaise(detail.totalAmountPaise), tone: "dark" },
                    { label: "Lines", value: String(detail.lines.length), tone: "dark" },
                  ]}
                />
                {canManage && nextStatuses(detail.status).length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {nextStatuses(detail.status).map((statusValue) => (
                      <Button key={statusValue} size="sm" variant={statusValue === "cancelled" ? "outline" : "default"} onClick={() => changeStatus(statusValue)} disabled={busy}>
                        {statusValue === "cancelled" ? "Cancel order" : `Mark ${statusValue}`}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-6 divide-y divide-paper/10 border-y border-paper/10">
                  {detail.lines.map((line) => (
                    <div key={line.id} className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="font-mono text-xs">{line.code} · {line.name}</p>
                        <p className="mono-label mt-1 text-paper-muted">{line.kind} · unit cost {formatPaise(line.unitCostPaise)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-xs tabular">{line.receivedQuantity} / {line.quantity}</p>
                        <p className="mono-label mt-1 text-paper-muted">{line.unit} received</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mono-label mt-6 text-paper-muted">Source: purchase order {detail.orderNumber}</p>
              </>
            ) : (
              <p className="mt-8 text-sm text-paper-muted">Loading purchase order…</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}
