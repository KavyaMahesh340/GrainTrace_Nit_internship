"use client";

import { useMemo, useState } from "react";
import { Download, FileText, RefreshCw, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPaise } from "@/domain";
import type { InvoiceDetail, InvoiceSummary } from "@/lib/workflows/invoices";
import { salesApiRequest, salesFieldClass, salesLabelClass, salesStatusVariant } from "./sales-shared";

type InvoiceLineCandidate = {
  salesOrderItemId: number;
  productName: string;
  hsnCode: string | null;
  quantityPackets: number;
  fulfilledPackets: number;
  invoicedPackets: number;
  unitPricePaise: number;
  discountPaise: number;
  availableToInvoicePackets: number;
  netUnitPricePaise: number;
};

type Props = {
  initialInvoices: InvoiceSummary[];
  overview: { posted: number; outstandingPaise: number; overdue: number; cancelled: number };
  orders: { orderNumber: string; customerName: string; status: string }[];
  canManage: boolean;
  focus?: string;
};

export function InvoicesWorkspace({ initialInvoices, overview, orders, canManage, focus }: Props) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [orderNumber, setOrderNumber] = useState(focus ?? orders[0]?.orderNumber ?? "");
  const [lines, setLines] = useState<InvoiceLineCandidate[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [ratePercent, setRatePercent] = useState("5");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((invoice) =>
      `${invoice.invoiceNumber} ${invoice.customerName} ${invoice.financialYear}`.toLowerCase().includes(needle),
    );
  }, [invoices, query]);

  const estimatedValue = lines.reduce((sum, line) => {
    const quantity = Number(quantities[line.salesOrderItemId] ?? 0);
    return sum + line.netUnitPricePaise * quantity;
  }, 0);

  async function loadCandidates(nextOrder = orderNumber) {
    if (!nextOrder) return;
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ lines: InvoiceLineCandidate[] }>(
        `/api/invoices/candidates?orderNumber=${encodeURIComponent(nextOrder)}`,
      );
      const candidates = data.lines.filter((line) => line.availableToInvoicePackets > 0);
      setLines(candidates);
      setQuantities(
        Object.fromEntries(candidates.map((line) => [line.salesOrderItemId, String(line.availableToInvoicePackets)])),
      );
      if (candidates.length === 0) {
        setNotice("No dispatched packets are waiting to be invoiced on this order.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoice candidates could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(invoiceNumber: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ detail: InvoiceDetail }>(
        `/api/invoices/${encodeURIComponent(invoiceNumber)}`,
      );
      setDetail(data.detail);
      setDetailOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    try {
      const data = await salesApiRequest<{ invoices: InvoiceSummary[] }>("/api/invoices");
      setInvoices(data.invoices);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invoices could not be refreshed.");
    }
  }

  async function createInvoice() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payloadLines = lines
        .map((line) => ({
          salesOrderItemId: line.salesOrderItemId,
          quantityPackets: Number(quantities[line.salesOrderItemId] ?? 0),
        }))
        .filter((line) => line.quantityPackets > 0);
      const data = await salesApiRequest<{ invoice: InvoiceDetail }>("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesOrderNumber: orderNumber,
          invoiceDate,
          rateBasisPoints: Math.round(Number(ratePercent) * 100),
          lines: payloadLines,
        }),
      });
      setNotice(`${data.invoice.invoiceNumber} posted with ${formatPaise(data.invoice.totalPaise)} tax-inclusive total.`);
      await refresh();
      await loadDetail(data.invoice.invoiceNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice could not be posted.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvoice() {
    if (!detail || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const data = await salesApiRequest<{ invoice: InvoiceDetail }>(
        `/api/invoices/${encodeURIComponent(detail.invoiceNumber)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      setDetail(data.invoice);
      setCancelOpen(false);
      setReason("");
      setNotice(`${data.invoice.creditNoteNumber} created for ${formatPaise(data.invoice.creditNotePaise)}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invoice could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">MATERIAL JOURNEY / 08</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">GST invoices & credit notes.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Invoices post only against dispatched packets. Tax is calculated per HSN, state jurisdiction is frozen on
              the document, and cancellation always creates a reversing credit note.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="POSTED" value={String(overview.posted)} />
            <Metric label="OUTSTANDING" value={formatPaise(overview.outstandingPaise)} />
            <Metric label="OVERDUE" value={String(overview.overdue)} />
            <Metric label="CREDIT NOTES" value={String(overview.cancelled)} />
          </div>
        </div>
      </header>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}
        {notice ? <p className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">{notice}</p> : null}

        {canManage ? (
          <section className="border border-obsidian/15 bg-paper p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono-label text-machine">TAX INVOICE BUILDER</p>
                <h2 className="mt-1 text-2xl font-semibold">Invoice dispatched stock</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <label>
                  <span className={salesLabelClass()}>ORDER</span>
                  <select
                    value={orderNumber}
                    onChange={(event) => setOrderNumber(event.target.value)}
                    className={`${salesFieldClass()} min-w-60`}
                  >
                    <option value="">Select order</option>
                    {orders.map((order) => (
                      <option key={order.orderNumber} value={order.orderNumber}>
                        {order.orderNumber} · {order.customerName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="outline" className="self-end" onClick={() => void loadCandidates()} disabled={busy || !orderNumber}>
                  <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Load lines
                </Button>
              </div>
            </div>

            {lines.length ? (
              <div className="mt-6 space-y-4">
                {lines.map((line) => (
                  <div key={line.salesOrderItemId} className="grid gap-4 border border-obsidian/15 p-4 md:grid-cols-[1fr_140px]">
                    <div>
                      <p className="font-semibold">{line.productName}</p>
                      <p className="mt-1 font-mono text-xs text-machine">
                        HSN {line.hsnCode || "missing"} · fulfilled {line.fulfilledPackets} · already invoiced{" "}
                        {line.invoicedPackets}
                      </p>
                      <p className="mt-2 font-mono text-sm">{formatPaise(line.netUnitPricePaise)} net per packet</p>
                    </div>
                    <label>
                      <span className={salesLabelClass()}>PACKETS</span>
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
                <div className="grid gap-4 border-t border-obsidian/15 pt-5 sm:grid-cols-3">
                  <label>
                    <span className={salesLabelClass()}>INVOICE DATE</span>
                    <Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
                  </label>
                  <label>
                    <span className={salesLabelClass()}>GST RATE %</span>
                    <Input
                      inputMode="decimal"
                      value={ratePercent}
                      onChange={(event) => setRatePercent(event.target.value)}
                    />
                  </label>
                  <div className="surface-dark flex items-center justify-between px-4 text-paper">
                    <span className="mono-label text-paper/60">NET PREVIEW</span>
                    <span className="font-mono text-signal">{formatPaise(estimatedValue)}</span>
                  </div>
                </div>
                <Button onClick={() => void createInvoice()} disabled={busy}>
                  <FileText className="h-4 w-4" /> Post tax invoice
                </Button>
              </div>
            ) : (
              <p className="mt-6 border border-dashed border-obsidian/20 p-8 text-center text-sm text-machine">
                Load an approved or fulfilled order with dispatched packets to build a tax invoice.
              </p>
            )}
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono-label text-machine">TAX DOCUMENTS</p>
              <h2 className="mt-1 text-2xl font-semibold">Invoice register</h2>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-machine" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search invoices"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Invoice</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">FY</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Customer</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Due</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Status</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-label">Outstanding</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                    <td className="px-4 py-3 font-mono">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs">{invoice.financialYear}</td>
                    <td className="px-4 py-3">{invoice.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-machine">{invoice.dueDate}</td>
                    <td className="px-4 py-3">
                      <Badge variant={salesStatusVariant(invoice.status)}>{invoice.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatPaise(invoice.outstandingPaise)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => void loadDetail(invoice.invoiceNumber)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-machine">
                      No tax documents match this view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="font-mono">{detail?.invoiceNumber}</SheetTitle>
            <SheetDescription>
              {detail?.customerName} · {detail?.jurisdiction} · {detail?.financialYear}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="space-y-6 px-6 pb-10">
              <div className="flex flex-wrap gap-2">
                <Badge variant={salesStatusVariant(detail.status)}>{detail.status.replaceAll("_", " ")}</Badge>
                <Badge variant="outline">{formatPaise(detail.totalPaise)}</Badge>
              </div>
              <div className="grid gap-3 border border-paper/15 p-4 text-sm sm:grid-cols-2">
                <p className="text-paper/60">GSTIN: <span className="font-mono text-paper">{detail.toGstin || "—"}</span></p>
                <p className="text-paper/60">HSN: <span className="font-mono text-paper">{detail.hsnCode}</span></p>
                <p className="text-paper/60">Due: <span className="font-mono text-paper">{detail.dueDate}</span></p>
                <p className="text-paper/60">Paid: <span className="font-mono text-paper">{formatPaise(detail.amountPaidPaise)}</span></p>
              </div>
              <div className="space-y-3">
                {detail.lines.map((line) => (
                  <div key={line.id} className="border border-paper/15 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-paper">{line.productName}</span>
                      <span className="font-mono text-signal">{formatPaise(line.lineTotalPaise)}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper/60">
                      {line.quantityPackets} packets · taxable {formatPaise(line.taxablePaise)} · CGST{" "}
                      {formatPaise(line.cgstPaise)} · SGST {formatPaise(line.sgstPaise)} · IGST{" "}
                      {formatPaise(line.igstPaise)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-paper/20 pt-4 text-sm text-paper/80">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatPaise(detail.subtotalPaise)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span className="font-mono">{formatPaise(detail.taxPaise)}</span></div>
                <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="font-mono text-signal">{formatPaise(detail.totalPaise)}</span></div>
                <div className="flex justify-between"><span>Outstanding</span><span className="font-mono">{formatPaise(detail.outstandingPaise)}</span></div>
              </div>
              {detail.creditNoteNumber ? (
                <div className="border-l-2 border-rust bg-rust/10 p-4 text-sm text-rust">
                  <ShieldAlert className="mb-2 h-5 w-5" />
                  <p className="font-semibold">{detail.creditNoteNumber}</p>
                  <p className="mt-1">{formatPaise(detail.creditNotePaise)} reversed · {detail.cancellationReason}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="dark">
                  <a href={`/api/invoices/${encodeURIComponent(detail.invoiceNumber)}/pdf`} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" /> Print PDF
                  </a>
                </Button>
                {canManage && detail.status !== "cancelled" ? (
                  <Button variant="outline" onClick={() => setCancelOpen(true)}>
                    <RotateCcw className="h-4 w-4" /> Cancel with credit note
                  </Button>
                ) : null}
                <Button variant="light" asChild>
                  <a href={`/collections?focus=${encodeURIComponent(detail.invoiceNumber)}`}>Record collection</a>
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={cancelOpen} onOpenChange={setCancelOpen}>
        <SheetContent side="bottom" className="max-w-xl">
          <SheetHeader>
            <SheetTitle>Cancel invoice</SheetTitle>
            <SheetDescription>
              A full reversal credit note will be posted. The original invoice remains in the audit trail.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-8">
            <label className="block">
              <span className={salesLabelClass()}>REASON</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24 w-full rounded-sm border border-obsidian/25 bg-paper p-3 text-sm"
                placeholder="Customer returned dispatched goods"
              />
            </label>
            <Button className="mt-5" onClick={() => void cancelInvoice()} disabled={busy || reason.trim().length < 3}>
              Post credit note
            </Button>
          </div>
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
