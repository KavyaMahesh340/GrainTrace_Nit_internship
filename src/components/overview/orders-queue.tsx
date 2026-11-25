import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/format";
import type { PreviewSnapshot } from "@/lib/domain/preview";

export function OrdersQueue({ orders }: { orders: PreviewSnapshot["orders"] }) {
  return (
    <section className="border-b border-obsidian/15 lg:grid lg:grid-cols-12">
      <div className="px-5 py-10 sm:px-8 lg:col-span-4 lg:border-r lg:border-obsidian/15 lg:py-12 lg:pl-8 lg:pr-10">
        <p className="mono-label text-rust-ink">03 / Orders awaiting action</p>
        <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Decisions, not a backlog count.
        </h2>
        <p className="mt-5 max-w-sm text-xs leading-6 text-ink-muted">
          Each reference opens its module route with the preview reference preserved in the URL.
        </p>
      </div>
      <div className="table-scroll lg:col-span-8" role="region" aria-label="Orders awaiting action, horizontally scrollable" tabIndex={0}>
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="mono-label text-ink-muted">
              <th scope="col" className="px-5 py-4 font-medium sm:px-8 lg:px-6">Order</th>
              <th scope="col" className="px-3 py-4 font-medium">Customer</th>
              <th scope="col" className="px-3 py-4 font-medium">Qty</th>
              <th scope="col" className="px-3 py-4 font-medium">Due</th>
              <th scope="col" className="px-3 py-4 font-medium">Value</th>
              <th scope="col" className="px-5 py-4 text-right font-medium sm:px-8 lg:px-6"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="data-row">
                <td className="px-5 py-5 sm:px-8 lg:px-6">
                  <Link
                    href={`/orders?focus=${order.id}`}
                    className="flex items-center gap-2 font-mono text-xs font-medium text-obsidian underline-offset-4 hover:underline"
                  >
                    {order.priority === "high" ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-rust" aria-label="High priority" />
                    ) : null}
                    {order.id}
                  </Link>
                  <span className="mono-label mt-2 block text-ink-muted">{order.state}</span>
                </td>
                <td className="px-3 py-5 text-sm">{order.customer}</td>
                <td className="px-3 py-5 font-mono text-xs tabular">{formatQuantity(order.quantity)}</td>
                <td className="px-3 py-5 font-mono text-xs text-ink-muted tabular">{order.due}</td>
                <td className="px-3 py-5 font-mono text-xs tabular">{formatCurrency(order.value)}</td>
                <td className="px-5 py-5 text-right sm:px-8 lg:px-6">
                  <Link
                    href={`/orders?focus=${order.id}`}
                    aria-label={`Open ${order.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-obsidian/20 transition-colors hover:border-obsidian hover:bg-obsidian hover:text-paper"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
