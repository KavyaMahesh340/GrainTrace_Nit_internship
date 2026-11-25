"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricCell } from "@/components/ui/metric";
import type { PreviewSnapshot } from "@/lib/domain/preview";

export function ProductionPulse({ pulse }: { pulse: PreviewSnapshot["pulse"] }) {
  return (
    <section className="border-b border-obsidian/15 bg-paper" aria-labelledby="production-pulse-heading">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-12">
        <div className="px-5 py-10 sm:px-8 lg:col-span-3 lg:border-r lg:border-obsidian/15 lg:py-12 lg:pl-8 lg:pr-10">
          <p className="mono-label text-rust-ink">01 / Production pulse</p>
          <h2 id="production-pulse-heading" className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Output against plan, interval by interval.
          </h2>
          <p className="mono-label mt-5 text-ink-muted">{pulse.unit}</p>
          <div className="mt-8 grid grid-cols-2 gap-px bg-obsidian/10">
            <MetricCell label="Plan / interval" value={pulse.target} />
            <MetricCell label="Intervals" value={pulse.points.length} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-label text-ink-muted">
            <span className="flex items-center gap-2">
              <span className="h-2 w-3 border border-forest/30 bg-sage" aria-hidden="true" />
              Planned
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-3 bg-signal" aria-hidden="true" />
              Actual
            </span>
            <span className="flex items-center gap-2">
              <span className="h-px w-3 bg-rust" aria-hidden="true" />
              Target
            </span>
          </div>
        </div>
        <div className="min-w-0 px-1 pb-4 pt-8 sm:px-6 lg:col-span-9 lg:py-12">
          <div className="h-[300px] lg:h-[360px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pulse.points}
                barGap={2}
                margin={{ top: 12, right: 16, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#888E87" strokeOpacity={0.22} />
                <XAxis
                  dataKey="interval"
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                  tick={{ fill: "#4B534C", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#4B534C", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(23, 26, 24, 0.05)" }}
                  wrapperStyle={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}
                  contentStyle={{ border: "1px solid #171A18", borderRadius: 2, background: "#F2F1EB" }}
                />
                <ReferenceLine y={pulse.target} stroke="#C65D40" strokeDasharray="4 4" />
                <Bar dataKey="planned" fill="#DADFD4" />
                <Bar dataKey="actual" fill="#C8F169" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="group mx-4 border-t border-obsidian/15 sm:mx-6">
            <summary className="mono-label cursor-pointer list-none py-3 text-ink-muted outline-none hover:text-obsidian focus-visible:text-obsidian">
              View interval data as text
              <span aria-hidden="true" className="ml-2 inline-block transition-transform group-open:rotate-90">→</span>
            </summary>
            <div className="table-scroll pb-4" role="region" aria-label="Production pulse interval data" tabIndex={0}>
              <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                <caption className="sr-only">Planned and actual output by interval</caption>
                <thead>
                  <tr className="mono-label text-ink-muted">
                    <th scope="col" className="border-b border-obsidian/15 py-2 pr-4 font-medium">Interval</th>
                    <th scope="col" className="border-b border-obsidian/15 py-2 pr-4 font-medium">Planned</th>
                    <th scope="col" className="border-b border-obsidian/15 py-2 font-medium">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {pulse.points.map((point) => (
                    <tr key={point.interval} className="data-row">
                      <td className="py-2 pr-4 font-mono">{point.interval}</td>
                      <td className="py-2 pr-4 font-mono tabular">{point.planned}</td>
                      <td className="py-2 font-mono tabular">{point.actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
