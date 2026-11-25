"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { MotionTabs } from "@/components/system/motion-tabs";
import { Notice } from "@/components/system/notice";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TableFrame } from "@/components/ui/table-frame";
import { formatPaise } from "@/domain";
import type { SalesOrderDetail, SalesOrderSummary } from "@/lib/workflows/sales";
import { SalesmanMobileOrders } from "./salesman-mobile-orders";
import { parseAmount, salesApiRequest, salesFieldClass, salesLabelClass, salesStatusVariant } from "./sales-shared";

type CustomerOption = {
  id: number;
  code: string;
  name: string;
  customerType: string;
  state: string | null;
  creditTermsDays: number;
  status: string;
};

type ProductOption = {
  id: number;
  code: string;
  name: string;
  packetGrams: number;
  hsnCode: string | null;
};

type Props = {
  initialOrders: SalesOrderSummary[];
  overview: {
    openOrders: number;
    awaitingApproval: number;
    inFulfilment: number;
    pipelinePaise: number;
  };
  options: { customers: CustomerOption[]; products: ProductOption[] };
  canManage: boolean;
  canApprove: boolean;
  isSalesman: boolean;
  focus?: string;
};

type OrderLineDraft = { productId: string; quantity: string; unitPrice: string; discount: string };

const statusFlow = ["draft", "submitted", "approved", "partially_fulfilled", "fulfilled"];

const viewItems = [
  { value: "track", label: "Order tracking" },
  { value: "new", label: "New order" },
  { value: "customers", label: "Customers" },
] as const;

export function OrdersWorkspace({
  initialOrders,
  overview,
  options,
  canManage,
  canApprove,
  isSalesman,
  focus,
}: Props) {
  if (isSalesman) {
    return <SalesmanMobileOrders initialOrders={initialOrders} options={options} canManage={canManage} focus={focus} />;
  }
  return (
    <DesktopOrders
      initialOrders={initialOrders}
      overview={overview}
      options={options}
      canManage={canManage}
      canApprove={canApprove}
      focus={focus}
    />
  );
}

function DesktopOrders({
  initialOrders,
  overview,
  options,
  canManage,
  canApprove,
  focus,
}: Omit<Props, "isSalesman">) {
  const [orders, setOrders] = useState(initialOrders);
  const [view, setView] = useState<"track" | "new" | "customers">("track");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<SalesOrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [create, setCreate] = useState({
    orderNumber: "",
    customerId: String(options.customers[0]?.id ?? ""),
    orderDate: new Date().toISOString().slice(0, 10),
    requestedDate: "",
    notes: "",
  });
  const [lines, setLines] = useState<OrderLineDraft[]>([
    { productId: String(options.products[0]?.id ?? ""), quantity: "1", unitPrice: "", discount: "0" },
  ]);
  const [customer, setCustomer] = useState({
    code: "",
    name: "",
    customerType: "retailer",
    state: "Maharashtra",
    gstin: "",
    city: "",
    addressLine1: "",
    deliveryState: "",
    creditTermsDays: "30",
    creditLimitPaise: "0",
  });

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!needle) return true;
      return `${order.orderNumber} ${order.customerName} ${order.status}`.toLowerCase().includes(needle);
    });
  }, [orders, query, status]);

  useEffect(() => {
    if (!focus || !orders.some((order) => order.orderNumber === focus)) return;
    void openDetail(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, orders]);

  async function refresh() {
    try {
      const data = await salesApiRequest<{ orders: SalesOrderSummary[] }>("/api/sales/orders");
      setOrders(data.orders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Orders could not be refreshed.");
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

  async function changeStatus(orderNumber: string, next: "submitted" | "approved" | "rejected" | "cancelled") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await salesApiRequest<{ detail: SalesOrderDetail }>(
        `/api/sales/orders/${encodeURIComponent(orderNumber)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      setDetail(data.detail);
      setNotice(`${orderNumber} moved to ${next}.`);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOrder() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await salesApiRequest<{ order: SalesOrderDetail }>("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...create,
          customerId: Number(create.customerId),
          requestedDate: create.requestedDate || undefined,
          lines: lines.map((line) => ({
            productId: Number(line.productId),
            quantityPackets: Number(line.quantity),
            unitPricePaise: parseAmount(line.unitPrice),
            discountPaise: parseAmount(line.discount),
          })),
        }),
      });
      setNotice(`${data.order.orderNumber} created with ${data.order.lines.length} line(s).`);
      setCreate((current) => ({ ...current, orderNumber: "" }));
      await refresh();
      await openDetail(data.order.orderNumber);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The order could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCustomer() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await salesApiRequest<{ customer: CustomerOption }>("/api/sales/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...customer,
          deliveryState: customer.deliveryState || customer.state,
          creditTermsDays: Number(customer.creditTermsDays),
          creditLimitPaise: parseAmount(customer.creditLimitPaise),
        }),
      });
      setNotice(`${data.customer.name} added to the customer master.`);
      setCustomer({ ...customer, code: "", name: "", gstin: "", city: "", addressLine1: "" });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The customer could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        code="MATERIAL JOURNEY / 01"
        title="Sales orders & approval control."
        description="Every order carries a customer, price, approval state, fulfilment position, and invoice trail. Salesmen create; approvers release; dispatch consumes only approved stock."
        footnote="Decision board · create, submit, approve, fulfil"
        tone="dark"
        aside={
          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-px border border-paper/10 bg-paper/10">
              <Metric label="OPEN" value={String(overview.openOrders)} />
              <Metric label="AWAITING" value={String(overview.awaitingApproval)} />
              <Metric label="FULFILLING" value={String(overview.inFulfilment)} />
              <Metric label="PIPELINE" value={formatPaise(overview.pipelinePaise)} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="machine">Decision board</Badge>
              <span className="mono-caption text-paper-muted">Creation and approval are separate acts</span>
            </div>
          </div>
        }
      />

      <div className="page-frame py-10 sm:py-14">
        {error ? <Notice tone="error" className="mb-6">{error}</Notice> : null}
        {notice ? <Notice tone="success" className="mb-6">{notice}</Notice> : null}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <MotionTabs label="Order views" value={view} onChange={setView} items={viewItems} />
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search orders"
                aria-label="Search orders"
                className="h-10 pl-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => void refresh()} aria-label="Refresh orders">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {view === "track" ? (
          <div className="mt-10">
            <p className="mono-label text-rust-ink">01 / Live register</p>
            <TableFrame
              className="mt-3"
              title="Order book"
              description="Approval state, value and fulfilment position"
              actions={
                <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
                  <span className="mono-caption text-ink-muted">{filteredOrders.length} orders in view</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={`${salesFieldClass()} h-9 w-full min-w-52 sm:w-auto`}
                    aria-label="Filter by status"
                  >
                    <option value="all">All statuses</option>
                    {[...statusFlow, "rejected", "cancelled"].map((item) => (
                      <option key={item} value={item}>
                        {item.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="mono-label text-ink-muted">
                    <th scope="col" className="px-5 py-4 font-medium">Order</th>
                    <th scope="col" className="px-5 py-4 font-medium">Customer</th>
                    <th scope="col" className="px-3 py-4 font-medium">Date</th>
                    <th scope="col" className="px-3 py-4 font-medium">Status</th>
                    <th scope="col" className="px-3 py-4 text-right font-medium">Value</th>
                    <th scope="col" className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="data-row">
                      <td className="px-5 py-4 font-mono text-xs">{order.orderNumber}</td>
                      <td className="px-5 py-4 text-sm">{order.customerName}</td>
                      <td className="px-3 py-4 font-mono text-xs tabular text-ink-muted">{order.orderDate}</td>
                      <td className="px-3 py-4">
                        <Badge variant={salesStatusVariant(order.status)}>{order.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="px-3 py-4 text-right font-mono text-sm tabular">{formatPaise(order.totalAmountPaise)}</td>
                      <td className="px-5 py-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(order.orderNumber)}>
                          Track <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <p className="mono-label text-ink-muted">No orders match this view.</p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableFrame>
          </div>
        ) : null}

        {view === "new" && canManage ? (
          <div className="mt-10">
            <p className="mono-label text-rust-ink">02 / New commitment</p>
            <section className="mt-3 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="min-w-0 border border-obsidian/15 bg-paper p-5 sm:p-6">
                <p className="mono-label text-ink-muted">Document</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Create sales order</h2>
                <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  <label className="min-w-0">
                    <span className={salesLabelClass()}>ORDER REFERENCE</span>
                    <Input
                      value={create.orderNumber}
                      onChange={(event) => setCreate({ ...create, orderNumber: event.target.value })}
                      placeholder="SO-2026-001"
                      className="font-mono"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className={salesLabelClass()}>CUSTOMER</span>
                    <select
                      value={create.customerId}
                      onChange={(event) => setCreate({ ...create, customerId: event.target.value })}
                      className={salesFieldClass()}
                    >
                      {options.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className={salesLabelClass()}>ORDER DATE</span>
                    <Input
                      type="date"
                      value={create.orderDate}
                      onChange={(event) => setCreate({ ...create, orderDate: event.target.value })}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className={salesLabelClass()}>REQUESTED DATE</span>
                    <Input
                      type="date"
                      value={create.requestedDate}
                      onChange={(event) => setCreate({ ...create, requestedDate: event.target.value })}
                    />
                  </label>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="mono-label text-ink-muted">Order lines</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLines((current) => [
                          ...current,
                          {
                            productId: String(options.products[0]?.id ?? ""),
                            quantity: "1",
                            unitPrice: "",
                            discount: "0",
                          },
                        ])
                      }
                    >
                      <Plus className="h-3 w-3" /> Add line
                    </Button>
                  </div>
                  {lines.map((line, index) => (
                    <div key={index} className="grid min-w-0 gap-3 border border-obsidian/10 bg-paper p-4 md:grid-cols-4">
                      <select
                        value={line.productId}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, productId: event.target.value } : item,
                            ),
                          )
                        }
                        className={salesFieldClass()}
                        aria-label={`Product for line ${index + 1}`}
                      >
                        {options.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, quantity: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Packets"
                        aria-label={`Quantity for line ${index + 1}`}
                      />
                      <Input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, unitPrice: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Price ₹"
                        aria-label={`Price for line ${index + 1}`}
                      />
                      <Input
                        inputMode="decimal"
                        value={line.discount}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, discount: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="Discount ₹"
                        aria-label={`Discount for line ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <label className="mt-6 block min-w-0">
                  <span className={salesLabelClass()}>NOTES</span>
                  <textarea
                    value={create.notes}
                    onChange={(event) => setCreate({ ...create, notes: event.target.value })}
                    className="min-h-20 min-w-0 w-full rounded-sm border border-obsidian/20 bg-paper p-3 text-sm"
                  />
                </label>
                <Button className="mt-6" onClick={() => void submitOrder()} disabled={busy}>
                  <Check className="h-4 w-4" /> Create order
                </Button>
              </div>
              <aside className="min-w-0 space-y-4">
                <div className="surface-dark p-6 text-paper">
                  <p className="mono-label text-signal">CONTROL RULE</p>
                  <h3 className="mt-2 text-xl font-semibold">Approval is separate.</h3>
                  <p className="mt-3 text-sm leading-6 text-paper-muted">
                    Order creation and approval are different permissions. Dispatch never reads a draft order.
                  </p>
                  <ShieldCheck className="mt-6 h-8 w-8 text-signal" />
                </div>
                <div className="border border-obsidian/15 p-6">
                  <p className="mono-label text-ink-muted">STATUS PATH</p>
                  <ol className="mt-4 divide-y divide-obsidian/10 border-y border-obsidian/10">
                    {statusFlow.map((item, index) => (
                      <li key={item} className="flex items-center gap-3 py-3 text-sm">
                        <span className="font-mono text-xs text-rust-ink">{String(index + 1).padStart(2, "0")}</span>
                        <span>{item.replaceAll("_", " ")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            </section>
          </div>
        ) : null}

        {view === "customers" && canManage ? (
          <div className="mt-10">
            <p className="mono-label text-rust-ink">03 / Master data</p>
            <section className="mt-3 max-w-3xl border border-obsidian/15 bg-paper p-5 sm:p-6">
              <p className="mono-label text-ink-muted">Customer master</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Add customer</h2>
              <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className={salesLabelClass()}>CODE</span>
                  <Input
                    value={customer.code}
                    onChange={(event) => setCustomer({ ...customer, code: event.target.value })}
                    placeholder="CUST-100"
                    className="font-mono"
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>NAME</span>
                  <Input
                    value={customer.name}
                    onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>TYPE</span>
                  <select
                    value={customer.customerType}
                    onChange={(event) => setCustomer({ ...customer, customerType: event.target.value })}
                    className={salesFieldClass()}
                  >
                    <option value="retailer">Retailer</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>STATE</span>
                  <Input
                    value={customer.state}
                    onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>DELIVERY STATE</span>
                  <Input
                    value={customer.deliveryState}
                    onChange={(event) => setCustomer({ ...customer, deliveryState: event.target.value })}
                    placeholder={customer.state}
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>GSTIN</span>
                  <Input
                    value={customer.gstin}
                    onChange={(event) => setCustomer({ ...customer, gstin: event.target.value })}
                    className="font-mono"
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>CREDIT DAYS</span>
                  <Input
                    inputMode="numeric"
                    value={customer.creditTermsDays}
                    onChange={(event) => setCustomer({ ...customer, creditTermsDays: event.target.value })}
                  />
                </label>
                <label className="min-w-0">
                  <span className={salesLabelClass()}>CREDIT LIMIT (₹)</span>
                  <Input
                    inputMode="decimal"
                    value={customer.creditLimitPaise}
                    onChange={(event) => setCustomer({ ...customer, creditLimitPaise: event.target.value })}
                  />
                </label>
              </div>
              <Button className="mt-6" onClick={() => void submitCustomer()} disabled={busy}>
                <Plus className="h-4 w-4" /> Add customer
              </Button>
            </section>
          </div>
        ) : null}
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="border-b border-paper/10">
            <p className="mono-label text-paper-muted">Order decision sheet</p>
            <SheetTitle className="font-mono">{detail?.orderNumber}</SheetTitle>
            <SheetDescription>
              {detail?.customerName} · {detail?.customerType}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="space-y-6 px-6 pb-10">
              <div className="flex flex-wrap gap-2">
                <Badge variant={salesStatusVariant(detail.status)}>{detail.status.replaceAll("_", " ")}</Badge>
                <Badge variant="outline">{detail.salesmanName}</Badge>
              </div>
              <ol className="space-y-3 border-l border-paper/15 pl-5">
                {statusFlow.map((item) => {
                  const reached = statusFlow.indexOf(detail.status) >= statusFlow.indexOf(item);
                  return (
                    <li key={item} className="relative text-sm">
                      <span
                        className={`absolute -left-[25px] top-1 h-2 w-2 rounded-full ${reached ? "bg-signal" : "bg-paper/25"}`}
                      />
                      <span className={reached ? "font-semibold text-paper" : "text-paper-muted"}>{item.replaceAll("_", " ")}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="space-y-3">
                {detail.lines.map((line) => (
                  <div key={line.id} className="border border-paper/10 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 font-semibold text-paper">{line.productName}</span>
                      <span className="shrink-0 font-mono tabular text-signal">{formatPaise(line.lineTotalPaise)}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper-muted">
                      {line.quantityPackets} packets · fulfilled {line.fulfilledPackets} · invoiced{" "}
                      {line.invoicedPackets} · HSN {line.hsnCode || "missing"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-paper/20 pt-4 text-paper">
                <span>Order total</span>
                <span className="font-mono text-xl tabular text-signal">{formatPaise(detail.totalAmountPaise)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.status === "draft" && canManage ? (
                  <Button onClick={() => void changeStatus(detail.orderNumber, "submitted")} disabled={busy}>
                    Submit
                  </Button>
                ) : null}
                {(detail.status === "submitted" || detail.status === "confirmed") && canApprove ? (
                  <>
                    <Button onClick={() => void changeStatus(detail.orderNumber, "approved")} disabled={busy}>
                      Approve
                    </Button>
                    <Button variant="outline" onClick={() => void changeStatus(detail.orderNumber, "rejected")} disabled={busy}>
                      Reject
                    </Button>
                  </>
                ) : null}
                {["draft", "submitted", "approved", "partially_fulfilled"].includes(detail.status) && canManage ? (
                  <Button variant="outline" onClick={() => void changeStatus(detail.orderNumber, "cancelled")} disabled={busy}>
                    Cancel order
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-obsidian p-4">
      <p className="mono-label text-paper-muted">{label}</p>
      <p className="mt-2 font-mono text-xl tabular text-signal">{value}</p>
    </div>
  );
}
