import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCover, formatQuantity } from "@/lib/format";
import type { PreviewSnapshot, StockState } from "@/lib/domain/preview";
import { cn } from "@/lib/utils";

const stateStyles: Record<StockState, { label: string; bar: string; text: string }> = {
  critical: { label: "Critical", bar: "bg-rust", text: "text-rust" },
  watch: { label: "Watch", bar: "bg-[#D8A53B]", text: "text-[#9A7020]" },
  stable: { label: "Stable", bar: "bg-forest", text: "text-forest" },
};

export function StockRisk({ stock }: { stock: PreviewSnapshot["stock"] }) {
  return (
    <section className="border-b border-obsidian/15 px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-[1600px] gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="mono-label text-rust">04 / Stock risk</p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Cover, not just quantity.
          </h2>
          <p className="mt-5 max-w-sm text-xs leading-6 text-obsidian/55">
            Preview days-cover values are illustrative and use no live consumption calculation.
          </p>
          <Link
            href="/inventory"
            className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-forest underline-offset-4 hover:underline"
          >
            Open inventory module
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="divide-y divide-obsidian/10 border-y border-obsidian/15 lg:col-span-8">
          {stock.map((item) => {
            const styles = stateStyles[item.state];
            const coverPercent = Math.min(100, Math.round((item.daysCover / 7) * 100));
            return (
              <div
                key={item.code}
                className="grid gap-4 py-5 sm:grid-cols-[1.5fr_1fr_0.7fr] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">{item.material}</p>
                  <p className="mono-label mt-1 text-machine">{item.code}</p>
                </div>
                <div>
                  <p className="font-mono text-xs tabular">
                    {formatQuantity(item.onHand)} {item.unit} on hand
                  </p>
                  <div
                    role="meter"
                    aria-label={`${item.material} days of cover`}
                    aria-valuemin={0}
                    aria-valuemax={7}
                    aria-valuenow={item.daysCover}
                    className="mt-2 h-1.5 w-full bg-machine/20"
                  >
                    <div className={cn("h-full", styles.bar)} style={{ width: `${coverPercent}%` }} />
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className={cn("font-mono text-sm font-medium tabular", styles.text)}>
                    {formatCover(item.daysCover)}
                  </p>
                  <p className={cn("mono-label mt-1", styles.text)}>{styles.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
