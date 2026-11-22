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
import type { PreviewSnapshot } from "@/lib/domain/preview";

export function ProductionPulse({ pulse }: { pulse: PreviewSnapshot["pulse"] }) {
  return (
    <section className="border-b border-obsidian/15">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-12">
        <div className="px-5 py-10 sm:px-8 lg:col-span-3 lg:border-r lg:border-obsidian/15 lg:py-12 lg:pl-8 lg:pr-10">
          <p className="mono-label text-rust">01 / Production pulse</p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Output against plan, interval by interval.
          </h2>
          <p className="mono-label mt-5 text-machine">{pulse.unit}</p>
          <div className="mt-8 flex gap-8 border-t border-obsidian/15 pt-5">
            <div>
              <p className="mono-label text-machine/70">Plan / interval</p>
              <p className="mt-1 text-2xl font-medium tabular">{pulse.target}</p>
            </div>
            <div>
              <p className="mono-label text-machine/70">Intervals</p>
              <p className="mt-1 text-2xl font-medium tabular">{pulse.points.length}</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4 font-mono text-[10px] uppercase tracking-label text-machine">
            <span className="flex items-center gap-2">
              <span className="h-2 w-3 bg-sage" aria-hidden="true" />
              Planned
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-3 bg-signal" aria-hidden="true" />
              Actual
            </span>
          </div>
        </div>
        <div className="h-[300px] px-1 py-8 sm:px-6 lg:col-span-9 lg:h-[360px] lg:py-12">
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
                tick={{ fill: "#888E87", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#888E87", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
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
      </div>
    </section>
  );
}
