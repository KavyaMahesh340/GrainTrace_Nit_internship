"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Banknote, Receipt, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">MATERIAL JOURNEY / 10</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Collections & reconciliation.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Receipts close tax documents. Corrections stay auditable as reversing entries, never deletions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="DUE" value={formatPaise(dashboard.duePaise)} />
            <Metric label="OVERDUE" value={formatPaise(dashboard.overduePaise)} />
            <Metric label="COLLECTED" value={formatPaise(dashboard.collectedPaise)} />
            <Metric label="CORRECTED" value={formatPaise(dashboard.correctionPaise)} />
          </div>
        </div>
      </header>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}
        {notice ? <p className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">{notice}</p> : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-obsidian/15 bg-paper p-5">
            <p className="mono-label text-machine">AGING BUCKETS</p>
            <div className="mt-4 space-y-3">
              {dashboard.aging.map((bucket) => (
                <div key={bucket.bucket} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{bucket.label}</p>
                    <p className="font-mono text-[10px] text-machine">{bucket.invoiceCount} invoices</p>
                  </div>
                  <p className="font-mono text-sm">{formatPaise(bucket.outstandingPaise)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-obsidian/15 bg-paper p-5">
            <p className="mono-label text-machine">CUSTOMER EXPOSURE</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Retailers</span>
                <span className="font-mono">{formatPaise(dashboard.retailerOutstandingPaise)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Distributors</span>
                <span className="font-mono">{formatPaise(dashboard.distributorOutstandingPaise)}</span>
              </div>
              <div className="border-t border-obsidian/10 pt-3">
                {dashboard.customers.slice(0, 5).map((customer) => (
                  <div key={customer.customerId} className="flex items-center justify-between gap-4 py-1 text-xs">
                    <span className="truncate">{customer.customerName}</span>
                    <span className="shrink-0 font-mono">{formatPaise(customer.outstandingPaise)}</span>
                  </div>
                ))}
                {dashboard.customers.length === 0 ? (
                  <p className="text-sm text-machine">No customer balances are open.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono-label text-machine">RECEIVABLES</p>
              <h2 className="mt-1 text-2xl font-semibold">Outstanding invoices</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-machine" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search invoices"
                  className="h-10 pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Refresh collections">
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canManage ? (
                <Button onClick={() => openPayment()}>
                  <Banknote className="h-4 w-4" /> Record payment
                </Button>
              ) : null}
            </div>
          </div>
          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Invoice</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Customer</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Due date</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Aging</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Status</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-label">Invoice total</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-label">Outstanding</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.invoiceId} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                    <td className="px-4 py-3 font-mono">{row.invoiceNumber}</td>
                    <td className="px-4 py-3">{row.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-machine">{row.dueDate}</td>
                    <td className="px-4 py-3 text-xs">{row.agingBucket.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={salesStatusVariant(row.status)}>{row.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatPaise(row.totalPaise)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPaise(row.outstandingPaise)}</td>
                    <td className="px-4 py-3 text-right">
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
                    <td colSpan={8} className="px-4 py-12 text-center text-machine">
                      No invoices match this view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="mono-label text-machine">RECEIPT BOOK</p>
            <h2 className="mt-1 text-2xl font-semibold">Payment history</h2>
          </div>
          <div className="overflow-x-auto border border-obsidian/15">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="surface-dark text-paper">
                <tr>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Receipt</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Invoice</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Customer</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Paid at</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Method</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Type</th>
                  <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-label">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-obsidian/10">
                    <td className="px-4 py-3 font-mono">{payment.paymentNumber}</td>
                    <td className="px-4 py-3 font-mono">{payment.invoiceNumber}</td>
                    <td className="px-4 py-3">{payment.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-machine">{payment.paidAt}</td>
                    <td className="px-4 py-3">{payment.method.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={payment.direction === "debit" ? "rust" : "default"}>
                        {payment.direction === "debit" ? "correction" : payment.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {payment.signedAmountPaise < 0 ? "-" : ""}
                      {formatPaise(payment.amountPaise)}
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    <td colSpan={8} className="px-4 py-12 text-center text-machine">
                      No receipts recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-w-xl">
          <SheetHeader>
            <SheetTitle>Record collection</SheetTitle>
            <SheetDescription>
              {activeRow ? `${activeRow.customerName} · ${formatPaise(activeRow.outstandingPaise)} due` : "Choose an invoice with an outstanding balance."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-6 pb-8">
            <label className="block">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={salesLabelClass()}>PAID AT</span>
                <Input type="date" value={draft.paidAt} onChange={(event) => setDraft({ ...draft, paidAt: event.target.value })} />
              </label>
              <label>
                <span className={salesLabelClass()}>AMOUNT (₹)</span>
                <Input
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                />
              </label>
              <label>
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
              <label>
                <span className={salesLabelClass()}>REFERENCE</span>
                <Input
                  value={draft.referenceNo}
                  onChange={(event) => setDraft({ ...draft, referenceNo: event.target.value })}
                  placeholder="UTR / cheque no."
                />
              </label>
            </div>
            <label className="block">
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
          <SheetHeader>
            <SheetTitle>Correct posted receipt</SheetTitle>
            <SheetDescription>
              {activePayment
                ? `${activePayment.paymentNumber} · ${formatPaise(activePayment.amountPaise)} · ${activePayment.invoiceNumber}`
                : "Choose a receipt to correct."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-6 pb-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={salesLabelClass()}>CORRECTION DATE</span>
                <Input
                  type="date"
                  value={correction.correctedAt}
                  onChange={(event) => setCorrection({ ...correction, correctedAt: event.target.value })}
                />
              </label>
              <label>
                <span className={salesLabelClass()}>AMOUNT (₹)</span>
                <Input
                  inputMode="decimal"
                  value={correction.amount}
                  onChange={(event) => setCorrection({ ...correction, amount: event.target.value })}
                />
              </label>
            </div>
            <label className="block">
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
    <div className="min-w-28 border-l-2 border-signal pl-3">
      <p className="mono-label text-paper/50">{label}</p>
      <p className="mt-1 font-mono text-lg text-signal">{value}</p>
    </div>
  );
}
