"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <header className="surface-dark px-6 py-10 text-paper lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mono-label text-signal">MATERIAL JOURNEY / 01</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Sales orders & approval control.</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper/65">
              Every order carries a customer, price, approval state, fulfilment position, and invoice trail. Salesmen
              create; approvers release; dispatch consumes only approved stock.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="OPEN" value={String(overview.openOrders)} />
            <Metric label="AWAITING" value={String(overview.awaitingApproval)} />
            <Metric label="FULFILLING" value={String(overview.inFulfilment)} />
            <Metric label="PIPELINE" value={formatPaise(overview.pipelinePaise)} />
          </div>
        </div>
      </header>

      <div className="border-b border-obsidian/15 bg-paper px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["track", "Order tracking"],
              ["new", "New order"],
              ["customers", "Customers"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={view === key ? "dark" : "outline"}
              onClick={() => setView(key)}
              className="min-h-10"
            >
              {label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-machine" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search orders"
                className="h-10 pl-9"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Refresh orders">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      <main className="space-y-8 px-6 py-8 lg:px-10">
        {error ? <p className="border-l-2 border-rust bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p> : null}
        {notice ? <p className="border-l-2 border-signal bg-signal/15 px-3 py-2 text-sm text-forest">{notice}</p> : null}

        {view === "track" ? (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mono-label text-machine">LIVE REGISTER</p>
                <h2 className="mt-1 text-2xl font-semibold">Order book</h2>
              </div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={`${salesFieldClass()} w-auto min-w-52`}
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
            <div className="overflow-x-auto border border-obsidian/15">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="surface-dark text-paper">
                  <tr>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Order</th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Customer</th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Date</th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-label">Status</th>
                    <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-label">Value</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-t border-obsidian/10 hover:bg-pale-sage/40">
                      <td className="px-4 py-3 font-mono">{order.orderNumber}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-machine">{order.orderDate}</td>
                      <td className="px-4 py-3">
                        <Badge variant={salesStatusVariant(order.status)}>{order.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatPaise(order.totalAmountPaise)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => void openDetail(order.orderNumber)}>
                          Track <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-machine">
                        No orders match this view.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {view === "new" && canManage ? (
          <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="border border-obsidian/15 bg-paper p-6">
              <p className="mono-label text-machine">DOCUMENT</p>
              <h2 className="mt-1 text-2xl font-semibold">Create sales order</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={salesLabelClass()}>ORDER REFERENCE</span>
                  <Input
                    value={create.orderNumber}
                    onChange={(event) => setCreate({ ...create, orderNumber: event.target.value })}
                    placeholder="SO-2026-001"
                    className="font-mono"
                  />
                </label>
                <label>
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
                <label>
                  <span className={salesLabelClass()}>ORDER DATE</span>
                  <Input
                    type="date"
                    value={create.orderDate}
                    onChange={(event) => setCreate({ ...create, orderDate: event.target.value })}
                  />
                </label>
                <label>
                  <span className={salesLabelClass()}>REQUESTED DATE</span>
                  <Input
                    type="date"
                    value={create.requestedDate}
                    onChange={(event) => setCreate({ ...create, requestedDate: event.target.value })}
                  />
                </label>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Order lines</h3>
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
                  <div key={index} className="grid gap-3 border border-obsidian/15 p-4 md:grid-cols-4">
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
              <label className="mt-6 block">
                <span className={salesLabelClass()}>NOTES</span>
                <textarea
                  value={create.notes}
                  onChange={(event) => setCreate({ ...create, notes: event.target.value })}
                  className="min-h-20 w-full rounded-sm border border-obsidian/25 bg-paper p-3 text-sm"
                />
              </label>
              <Button className="mt-6" onClick={() => void submitOrder()} disabled={busy}>
                <Check className="h-4 w-4" /> Create order
              </Button>
            </div>
            <aside className="space-y-4">
              <div className="surface-dark p-6 text-paper">
                <p className="mono-label text-signal">CONTROL RULE</p>
                <h3 className="mt-2 text-xl font-semibold">Approval is separate.</h3>
                <p className="mt-3 text-sm text-paper/65">
                  Order creation and approval are different permissions. Dispatch never reads a draft order.
                </p>
                <ShieldCheck className="mt-6 h-8 w-8 text-signal" />
              </div>
              <div className="border border-obsidian/15 p-6">
                <p className="mono-label text-machine">STATUS PATH</p>
                <ol className="mt-4 space-y-3">
                  {statusFlow.map((item, index) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-machine">{String(index + 1).padStart(2, "0")}</span>
                      <span>{item.replaceAll("_", " ")}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </section>
        ) : null}

        {view === "customers" && canManage ? (
          <section className="max-w-3xl border border-obsidian/15 bg-paper p-6">
            <p className="mono-label text-machine">MASTER DATA</p>
            <h2 className="mt-1 text-2xl font-semibold">Add customer</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={salesLabelClass()}>CODE</span>
                <Input
                  value={customer.code}
                  onChange={(event) => setCustomer({ ...customer, code: event.target.value })}
                  placeholder="CUST-100"
                  className="font-mono"
                />
              </label>
              <label>
                <span className={salesLabelClass()}>NAME</span>
                <Input
                  value={customer.name}
                  onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                />
              </label>
              <label>
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
              <label>
                <span className={salesLabelClass()}>STATE</span>
                <Input
                  value={customer.state}
                  onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
                />
              </label>
              <label>
                <span className={salesLabelClass()}>DELIVERY STATE</span>
                <Input
                  value={customer.deliveryState}
                  onChange={(event) => setCustomer({ ...customer, deliveryState: event.target.value })}
                  placeholder={customer.state}
                />
              </label>
              <label>
                <span className={salesLabelClass()}>GSTIN</span>
                <Input
                  value={customer.gstin}
                  onChange={(event) => setCustomer({ ...customer, gstin: event.target.value })}
                  className="font-mono"
                />
              </label>
              <label>
                <span className={salesLabelClass()}>CREDIT DAYS</span>
                <Input
                  inputMode="numeric"
                  value={customer.creditTermsDays}
                  onChange={(event) => setCustomer({ ...customer, creditTermsDays: event.target.value })}
                />
              </label>
              <label>
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
        ) : null}
      </main>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
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
              <ol className="space-y-3 border-l border-obsidian/20 pl-5">
                {statusFlow.map((item) => {
                  const reached = statusFlow.indexOf(detail.status) >= statusFlow.indexOf(item);
                  return (
                    <li key={item} className="relative text-sm">
                      <span
                        className={`absolute -left-[25px] top-1 h-2 w-2 rounded-full ${reached ? "bg-forest" : "bg-obsidian/25"}`}
                      />
                      <span className={reached ? "font-semibold" : "text-machine"}>{item.replaceAll("_", " ")}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="space-y-3">
                {detail.lines.map((line) => (
                  <div key={line.id} className="border border-paper/15 p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-paper">{line.productName}</span>
                      <span className="font-mono text-signal">{formatPaise(line.lineTotalPaise)}</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-paper/60">
                      {line.quantityPackets} packets · fulfilled {line.fulfilledPackets} · invoiced{" "}
                      {line.invoicedPackets} · HSN {line.hsnCode || "missing"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-paper/20 pt-4 text-paper">
                <span>Order total</span>
                <span className="font-mono text-xl text-signal">{formatPaise(detail.totalAmountPaise)}</span>
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
    <div className="min-w-28 border-l-2 border-signal pl-3">
      <p className="mono-label text-paper/50">{label}</p>
      <p className="mt-1 font-mono text-lg text-signal">{value}</p>
    </div>
  );
}
