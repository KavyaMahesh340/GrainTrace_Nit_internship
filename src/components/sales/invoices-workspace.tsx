"use client";

import { useMemo, useState } from "react";
import { Download, FileText, RefreshCw, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricGrid } from "@/components/ui/metric";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
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
      <PageHeader
        code="MATERIAL JOURNEY / 08"
        title="GST invoices & credit notes."
        description="Invoices post only against dispatched packets. Tax is calculated per HSN, state jurisdiction is frozen on the document, and cancellation always creates a reversing credit note."
        footnote="Dispatched packets → tax document → reversal"
        tone="ledger"
        aside={
          <div className="min-w-0">
            <MetricGrid
              className="border border-obsidian/20"
              items={[
                { label: "POSTED", value: String(overview.posted) },
                { label: "OUTSTANDING", value: formatPaise(overview.outstandingPaise) },
                { label: "OVERDUE", value: String(overview.overdue) },
                { label: "CREDIT NOTES", value: String(overview.cancelled) },
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">HSN-wise tax</Badge>
              <Badge variant="rust">Full reversal</Badge>
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
        {error ? <Notice tone="error" className="mb-6">{error}</Notice> : null}
        {notice ? <Notice tone="success" className="mb-6">{notice}</Notice> : null}

        {canManage ? (
          <div className="mt-2">
            <p className="mono-label text-rust-ink">01 / Tax document builder</p>
            <section className="mt-3 border border-obsidian/15 bg-paper p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="mono-label text-ink-muted">Tax invoice builder</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Invoice dispatched stock</h2>
                </div>
                <div className="flex w-full min-w-0 flex-wrap items-end gap-3 sm:w-auto">
                  <label className="min-w-0">
                    <span className={salesLabelClass()}>ORDER</span>
                    <select
                      value={orderNumber}
                      onChange={(event) => setOrderNumber(event.target.value)}
                      className={`${salesFieldClass()} min-w-0 sm:min-w-60`}
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
                    <div key={line.salesOrderItemId} className="grid min-w-0 gap-4 border border-obsidian/10 bg-paper p-4 md:grid-cols-[1fr_140px]">
                      <div className="min-w-0">
                        <p className="font-semibold">{line.productName}</p>
                        <p className="mt-1 font-mono text-xs text-ink-muted">
                          HSN {line.hsnCode || "missing"} · fulfilled {line.fulfilledPackets} · already invoiced{" "}
                          {line.invoicedPackets}
                        </p>
                        <p className="mt-2 font-mono text-sm tabular">{formatPaise(line.netUnitPricePaise)} net per packet</p>
                      </div>
                      <label className="min-w-0">
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
                  <div className="grid min-w-0 gap-4 border-t border-obsidian/15 pt-5 sm:grid-cols-3">
                    <label className="min-w-0">
                      <span className={salesLabelClass()}>INVOICE DATE</span>
                      <Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
                    </label>
                    <label className="min-w-0">
                      <span className={salesLabelClass()}>GST RATE %</span>
                      <Input
                        inputMode="decimal"
                        value={ratePercent}
                        onChange={(event) => setRatePercent(event.target.value)}
                      />
                    </label>
                    <div className="surface-dark flex items-center justify-between gap-3 px-4 text-paper">
                      <span className="mono-label text-paper-muted">NET PREVIEW</span>
                      <span className="font-mono tabular text-signal">{formatPaise(estimatedValue)}</span>
                    </div>
                  </div>
                  <Button onClick={() => void createInvoice()} disabled={busy}>
                    <FileText className="h-4 w-4" /> Post tax invoice
                  </Button>
                </div>
              ) : (
                <p className="mt-6 border border-dashed border-obsidian/20 p-8 text-center text-sm text-ink-muted">
                  Load an approved or fulfilled order with dispatched packets to build a tax invoice.
                </p>
              )}
            </section>
          </div>
        ) : null}

        <div className="mt-10">
          <p className="mono-label text-rust-ink">02 / Tax documents</p>
          <TableFrame
            className="mt-3"
            title="Invoice register"
            description="Posted documents and their reversing credit notes"
            actions={
              <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
                <span className="mono-caption text-ink-muted">{filtered.length} documents in view</span>
                <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search invoices"
                    aria-label="Search invoices"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
            }
          >
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Invoice</th>
                  <th scope="col" className="px-3 py-4 font-medium">FY</th>
                  <th scope="col" className="px-3 py-4 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-4 font-medium">Due</th>
                  <th scope="col" className="px-3 py-4 font-medium">Status</th>
                  <th scope="col" className="px-3 py-4 text-right font-medium">Outstanding</th>
                  <th scope="col" className="px-5 py-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr key={invoice.id} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{invoice.invoiceNumber}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular">{invoice.financialYear}</td>
                    <td className="px-3 py-4 text-sm">{invoice.customerName}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{invoice.dueDate}</td>
                    <td className="px-3 py-4">
                      <Badge variant={salesStatusVariant(invoice.status)}>{invoice.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-sm tabular">{formatPaise(invoice.outstandingPaise)}</td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => void loadDetail(invoice.invoiceNumber)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="mono-label text-ink-muted">No tax documents match this view.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableFrame>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-paper-muted">Tax document</p>
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
              <div className="grid gap-3 border border-paper/10 p-4 text-sm sm:grid-cols-2">
                <p className="text-paper-muted">GSTIN: <span className="font-mono text-paper">{detail.toGstin || "—"}</span></p>
                <p className="text-paper-muted">HSN: <span className="font-mono text-paper">{detail.hsnCode}</span></p>
                <p className="text-paper-muted">Due: <span className="font-mono text-paper">{detail.dueDate}</span></p>
                <p className="text-paper-muted">Paid: <span className="font-mono text-paper">{formatPaise(detail.amountPaidPaise)}</span></p>
              </div>
              <div className="space-y-3">
                {detail.lines.map((line) => (
                  <div key={line.id} className="border border-paper/10 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 font-semibold text-paper">{line.productName}</span>
                      <span className="shrink-0 font-mono tabular text-signal">{formatPaise(line.lineTotalPaise)}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper-muted">
                      {line.quantityPackets} packets · taxable {formatPaise(line.taxablePaise)} · CGST{" "}
                      {formatPaise(line.cgstPaise)} · SGST {formatPaise(line.sgstPaise)} · IGST{" "}
                      {formatPaise(line.igstPaise)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-paper/20 pt-4 text-sm text-paper-muted">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-mono tabular">{formatPaise(detail.subtotalPaise)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span className="font-mono tabular">{formatPaise(detail.taxPaise)}</span></div>
                <div className="flex justify-between text-base font-semibold text-paper"><span>Total</span><span className="font-mono tabular text-signal">{formatPaise(detail.totalPaise)}</span></div>
                <div className="flex justify-between"><span>Outstanding</span><span className="font-mono tabular">{formatPaise(detail.outstandingPaise)}</span></div>
              </div>
              {detail.creditNoteNumber ? (
                <div className="border-l-2 border-rust bg-rust/10 p-4 text-sm text-rust-ink">
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
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-paper-muted">Reversing entry</p>
            <SheetTitle>Cancel invoice</SheetTitle>
            <SheetDescription>
              A full reversal credit note will be posted. The original invoice remains in the audit trail.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 pb-8">
            <label className="block min-w-0">
              <span className={salesLabelClass()}>REASON</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24 min-w-0 w-full rounded-sm border border-obsidian/20 bg-paper p-3 text-sm"
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
