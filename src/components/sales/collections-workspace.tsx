"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Banknote, Receipt, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
import { formatPaise } from "@/domain";
import type { CollectionsDashboard, CollectionRow, PaymentSummary } from "@/lib/workflows/payments";
import { salesApiRequest, salesFieldClass, salesLabelClass, salesStatusVariant } from "./sales-shared";

type Props = {
  initialCollections: CollectionRow[];
  initialPayments: PaymentSummary[];
  initialDashboard: CollectionsDashboard;
  canManage: boolean;
  canCorrect: boolean;
  focus?: string;
};

type PaymentDraft = {
  invoiceNumber: string;
  paidAt: string;
  amount: string;
  method: "cash" | "upi" | "bank_transfer" | "cheque" | "other";
  referenceNo: string;
  notes: string;
};

type CorrectionDraft = {
  paymentNumber: string;
  correctedAt: string;
  amount: string;
  reason: string;
};

export function CollectionsWorkspace({
  initialCollections,
  initialPayments,
  initialDashboard,
  canManage,
  canCorrect,
  focus,
}: Props) {
  const [collections, setCollections] = useState(initialCollections);
  const [payments, setPayments] = useState(initialPayments);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(Boolean(focus));
  const [draft, setDraft] = useState<PaymentDraft>({
    invoiceNumber: focus ?? initialCollections.find((row) => row.outstandingPaise > 0)?.invoiceNumber ?? "",
    paidAt: new Date().toISOString().slice(0, 10),
    amount: "",
    method: "upi",
    referenceNo: "",
    notes: "",
  });
  const [correction, setCorrection] = useState<CorrectionDraft>({
    paymentNumber: "",
    correctedAt: new Date().toISOString().slice(0, 10),
    amount: "",
    reason: "",
  });
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collections;
    return collections.filter((row) => `${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(needle));
  }, [collections, query]);

  const activeRow = collections.find((row) => row.invoiceNumber === draft.invoiceNumber);
  const activePayment = payments.find((payment) => payment.paymentNumber === correction.paymentNumber);

  async function refresh() {
    try {
      const [collectionData, paymentData] = await Promise.all([
        salesApiRequest<{ collections: CollectionRow[]; dashboard: CollectionsDashboard }>(
          "/api/payments/collections",
        ),
        salesApiRequest<{ payments: PaymentSummary[] }>("/api/payments"),
      ]);
      setCollections(collectionData.collections);
      setDashboard(collectionData.dashboard);
      setPayments(paymentData.payments);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Collections could not be refreshed.");
    }
  }

  async function recordPayment() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await salesApiRequest<{ payment: PaymentSummary }>("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: draft.invoiceNumber,
          paidAt: draft.paidAt,
          amountPaise: Math.round(Number(draft.amount) * 100),
          method: draft.method,
          referenceNo: draft.referenceNo,
          notes: draft.notes,
        }),
      });
      setNotice(`${data.payment.paymentNumber} recorded against ${data.payment.invoiceNumber}.`);
      setSheetOpen(false);
      setDraft({ ...draft, amount: "", referenceNo: "", notes: "" });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  async function recordCorrection() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await salesApiRequest<{ correction: PaymentSummary }>("/api/payments/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentNumber: correction.paymentNumber,
          correctedAt: correction.correctedAt,
          amountPaise: Math.round(Number(correction.amount) * 100),
          reason: correction.reason,
        }),
      });
      setNotice(`${data.correction.paymentNumber} reverses ${correction.paymentNumber}.`);
      setCorrectionOpen(false);
      setCorrection({ ...correction, amount: "", reason: "" });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The correction could not be posted.");
    } finally {
      setBusy(false);
    }
  }

  function openPayment(invoiceNumber?: string) {
    const row = invoiceNumber
      ? collections.find((item) => item.invoiceNumber === invoiceNumber)
      : collections.find((item) => item.outstandingPaise > 0);
    if (!row) return;
    setDraft({
      invoiceNumber: row.invoiceNumber,
      paidAt: new Date().toISOString().slice(0, 10),
      amount: (row.outstandingPaise / 100).toFixed(2),
      method: "upi",
      referenceNo: "",
      notes: "",
    });
    setSheetOpen(true);
  }

  function openCorrection(payment: PaymentSummary) {
    setCorrection({
      paymentNumber: payment.paymentNumber,
      correctedAt: new Date().toISOString().slice(0, 10),
      amount: (payment.amountPaise / 100).toFixed(2),
      reason: "",
    });
    setCorrectionOpen(true);
  }

  return (
    <div>
      <PageHeader
        code="MATERIAL JOURNEY / 10"
        title="Collections & reconciliation."
        description="Receipts close tax documents. Corrections stay auditable as reversing entries, never deletions."
        footnote="Cash register · every receipt has a source document"
        tone="instrument"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-paper/10 bg-paper/10">
              <Metric label="DUE" value={formatPaise(dashboard.duePaise)} />
              <Metric label="OVERDUE" value={formatPaise(dashboard.overduePaise)} />
              <Metric label="COLLECTED" value={formatPaise(dashboard.collectedPaise)} />
              <Metric label="CORRECTED" value={formatPaise(dashboard.correctionPaise)} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="dark">Receipt book</Badge>
              <span className="mono-caption text-paper-muted">Reversals, never deletions</span>
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
        {error ? <Notice tone="error" className="mb-6">{error}</Notice> : null}
        {notice ? <Notice tone="success" className="mb-6">{notice}</Notice> : null}

        <div className="mt-2">
          <p className="mono-label text-rust-ink">01 / Aging & exposure</p>
          <section className="mt-3 grid min-w-0 gap-4 lg:grid-cols-2">
            <div className="min-w-0 border border-obsidian/15 bg-paper p-5">
              <p className="mono-label text-ink-muted">AGING BUCKETS</p>
              <div className="mt-4 divide-y divide-obsidian/10 border-y border-obsidian/10">
                {dashboard.aging.map((bucket) => (
                  <div key={bucket.bucket} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{bucket.label}</p>
                      <p className="mono-caption mt-1 text-ink-muted">{bucket.invoiceCount} invoices</p>
                    </div>
                    <p className="shrink-0 font-mono text-sm tabular">{formatPaise(bucket.outstandingPaise)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="min-w-0 border border-obsidian/15 bg-paper p-5">
              <p className="mono-label text-ink-muted">CUSTOMER EXPOSURE</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Retailers</span>
                  <span className="font-mono tabular">{formatPaise(dashboard.retailerOutstandingPaise)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Distributors</span>
                  <span className="font-mono tabular">{formatPaise(dashboard.distributorOutstandingPaise)}</span>
                </div>
                <div className="border-t border-obsidian/10 pt-3">
                  {dashboard.customers.slice(0, 5).map((customer) => (
                    <div key={customer.customerId} className="flex items-center justify-between gap-4 py-1 text-xs">
                      <span className="min-w-0 truncate">{customer.customerName}</span>
                      <span className="shrink-0 font-mono tabular">{formatPaise(customer.outstandingPaise)}</span>
                    </div>
                  ))}
                  {dashboard.customers.length === 0 ? (
                    <p className="text-sm text-ink-muted">No customer balances are open.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-10">
          <p className="mono-label text-rust-ink">02 / Receivables</p>
          <TableFrame
            className="mt-3"
            title="Outstanding invoices"
            description="Open tax documents with aging and collectable balance"
            actions={
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
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
                <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void refresh()} aria-label="Refresh collections">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {canManage ? (
                  <Button onClick={() => openPayment()}>
                    <Banknote className="h-4 w-4" /> Record payment
                  </Button>
                ) : null}
              </div>
            }
          >
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Invoice</th>
                  <th scope="col" className="px-3 py-4 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-4 font-medium">Due date</th>
                  <th scope="col" className="px-3 py-4 font-medium">Aging</th>
                  <th scope="col" className="px-3 py-4 font-medium">Status</th>
                  <th scope="col" className="px-3 py-4 text-right font-medium">Invoice total</th>
                  <th scope="col" className="px-3 py-4 text-right font-medium">Outstanding</th>
                  <th scope="col" className="px-5 py-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.invoiceId} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{row.invoiceNumber}</td>
                    <td className="px-3 py-4 text-sm">{row.customerName}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{row.dueDate}</td>
                    <td className="px-3 py-4 text-xs text-ink-muted">{row.agingBucket.replaceAll("_", " ")}</td>
                    <td className="px-3 py-4">
                      <Badge variant={salesStatusVariant(row.status)}>{row.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-sm tabular">{formatPaise(row.totalPaise)}</td>
                    <td className="px-3 py-4 text-right font-mono text-sm tabular">{formatPaise(row.outstandingPaise)}</td>
                    <td className="px-5 py-4 text-right">
                      {canManage && row.outstandingPaise > 0 ? (
                        <Button variant="outline" size="sm" onClick={() => openPayment(row.invoiceNumber)}>
                          Collect
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/invoices?focus=${encodeURIComponent(row.invoiceNumber)}`}>
                            Invoice <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <p className="mono-label text-ink-muted">No invoices match this view.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableFrame>
        </div>

        <div className="mt-10">
          <p className="mono-label text-rust-ink">03 / Receipt book</p>
          <TableFrame
            className="mt-3"
            title="Payment history"
            description="Posted receipts and their reversing corrections"
            actions={<span className="mono-caption text-ink-muted">{payments.length} entries</span>}
          >
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead>
                <tr className="mono-label text-ink-muted">
                  <th scope="col" className="px-5 py-4 font-medium">Receipt</th>
                  <th scope="col" className="px-3 py-4 font-medium">Invoice</th>
                  <th scope="col" className="px-3 py-4 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-4 font-medium">Paid at</th>
                  <th scope="col" className="px-3 py-4 font-medium">Method</th>
                  <th scope="col" className="px-3 py-4 font-medium">Type</th>
                  <th scope="col" className="px-3 py-4 text-right font-medium">Amount</th>
                  <th scope="col" className="px-5 py-4" />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="data-row">
                    <td className="px-5 py-4 font-mono text-xs">{payment.paymentNumber}</td>
                    <td className="px-3 py-4 font-mono text-xs">{payment.invoiceNumber}</td>
                    <td className="px-3 py-4 text-sm">{payment.customerName}</td>
                    <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{payment.paidAt}</td>
                    <td className="px-3 py-4 text-xs text-ink-muted">{payment.method.replaceAll("_", " ")}</td>
                    <td className="px-3 py-4">
                      <Badge variant={payment.direction === "debit" ? "rust" : "default"}>
                        {payment.direction === "debit" ? "correction" : payment.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-sm tabular">
                      {payment.signedAmountPaise < 0 ? "-" : ""}
                      {formatPaise(payment.amountPaise)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canCorrect && payment.direction === "credit" && payment.status !== "corrected" ? (
                        <Button variant="outline" size="sm" onClick={() => openCorrection(payment)}>
                          <RotateCcw className="h-3 w-3" /> Correct
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <p className="mono-label text-ink-muted">No receipts recorded yet.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableFrame>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-w-xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-paper-muted">Cash receipt</p>
            <SheetTitle>Record collection</SheetTitle>
            <SheetDescription>
              {activeRow ? `${activeRow.customerName} · ${formatPaise(activeRow.outstandingPaise)} due` : "Choose an invoice with an outstanding balance."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-6 pb-8">
            <label className="block min-w-0">
              <span className={salesLabelClass()}>INVOICE</span>
              <select
                value={draft.invoiceNumber}
                onChange={(event) => setDraft({ ...draft, invoiceNumber: event.target.value })}
                className={salesFieldClass()}
              >
                {collections
                  .filter((row) => row.outstandingPaise > 0)
                  .map((row) => (
                    <option key={row.invoiceId} value={row.invoiceNumber}>
                      {row.invoiceNumber} · {row.customerName}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={salesLabelClass()}>PAID AT</span>
                <Input type="date" value={draft.paidAt} onChange={(event) => setDraft({ ...draft, paidAt: event.target.value })} />
              </label>
              <label className="min-w-0">
                <span className={salesLabelClass()}>AMOUNT (₹)</span>
                <Input
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                />
              </label>
              <label className="min-w-0">
                <span className={salesLabelClass()}>METHOD</span>
                <select
                  value={draft.method}
                  onChange={(event) => setDraft({ ...draft, method: event.target.value as PaymentDraft["method"] })}
                  className={salesFieldClass()}
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className={salesLabelClass()}>REFERENCE</span>
                <Input
                  value={draft.referenceNo}
                  onChange={(event) => setDraft({ ...draft, referenceNo: event.target.value })}
                  placeholder="UTR / cheque no."
                />
              </label>
            </div>
            <label className="block min-w-0">
              <span className={salesLabelClass()}>NOTES</span>
              <Input
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="Optional context for this receipt"
              />
            </label>
            <Button onClick={() => void recordPayment()} disabled={busy || !draft.invoiceNumber || Number(draft.amount) <= 0}>
              <Receipt className="h-4 w-4" /> Post receipt
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <SheetContent side="bottom" className="max-w-xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-paper-muted">Reversing entry</p>
            <SheetTitle>Correct posted receipt</SheetTitle>
            <SheetDescription>
              {activePayment
                ? `${activePayment.paymentNumber} · ${formatPaise(activePayment.amountPaise)} · ${activePayment.invoiceNumber}`
                : "Choose a receipt to correct."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-6 pb-8">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="min-w-0">
                <span className={salesLabelClass()}>CORRECTION DATE</span>
                <Input
                  type="date"
                  value={correction.correctedAt}
                  onChange={(event) => setCorrection({ ...correction, correctedAt: event.target.value })}
                />
              </label>
              <label className="min-w-0">
                <span className={salesLabelClass()}>AMOUNT (₹)</span>
                <Input
                  inputMode="decimal"
                  value={correction.amount}
                  onChange={(event) => setCorrection({ ...correction, amount: event.target.value })}
                />
              </label>
            </div>
            <label className="block min-w-0">
              <span className={salesLabelClass()}>REASON</span>
              <Input
                value={correction.reason}
                onChange={(event) => setCorrection({ ...correction, reason: event.target.value })}
                placeholder="Why is this receipt being reversed?"
              />
            </label>
            <Button
              variant="dark"
              onClick={() => void recordCorrection()}
              disabled={busy || Number(correction.amount) <= 0 || correction.reason.trim().length < 3}
            >
              <RotateCcw className="h-4 w-4" /> Post correction
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-forest/70 p-4">
      <p className="mono-label text-paper-muted">{label}</p>
      <p className="mt-2 font-mono text-xl tabular text-signal">{value}</p>
    </div>
  );
}
