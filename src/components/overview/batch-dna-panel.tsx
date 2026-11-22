"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { FlowState, PreviewSnapshot } from "@/lib/domain/preview";
import { cn } from "@/lib/utils";

const stateDot: Record<FlowState, string> = {
  cleared: "bg-forest border-forest",
  active: "bg-signal border-signal",
  queued: "bg-transparent border-paper/40",
  exception: "bg-rust border-rust",
};

type BatchDnaPanelProps = {
  dna: PreviewSnapshot["dna"];
  expanded?: boolean;
};

export function BatchDnaPanel({ dna, expanded = false }: BatchDnaPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="surface-dark border-y border-paper/10 bg-forest text-paper">
      <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-9 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="mono-label text-signal">07 / Batch DNA</p>
            <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {expanded ? "The trace map begins with a batch." : "Trace the material, not the story."}
            </h2>
            <p className="mt-5 max-w-sm text-xs leading-6 text-paper/55 sm:text-sm">
              A future signature view will connect raw material sources, production steps, finished
              goods, and delivery. This is the visual concept only.
            </p>
          </div>
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-paper/15 pb-4">
              <span className="font-mono text-sm font-medium text-signal">{dna.batchCode}</span>
              <span className="mono-label text-paper/45">{dna.evidence}</span>
            </div>
            <p className="mono-label mt-4 text-paper/40">{dna.product}</p>
            <div className="relative mt-9">
              <div className="absolute inset-x-0 top-[13px] h-px bg-paper/20" aria-hidden="true" />
              <motion.div
                className="absolute left-0 top-[13px] h-px bg-signal"
                style={{ width: "78%" }}
                initial={prefersReducedMotion ? false : { width: 0 }}
                whileInView={prefersReducedMotion ? undefined : { width: "78%" }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              />
              <ol className="relative grid grid-cols-5 gap-2" aria-label="Batch DNA stage preview">
                {dna.stages.map((stage) => (
                  <li key={stage.label} className="min-w-0">
                    <span
                      className={cn(
                        "block h-[27px] w-[27px] rounded-full border-2 bg-forest",
                        stateDot[stage.state],
                      )}
                      aria-hidden="true"
                    />
                    <p className="mono-label mt-4 truncate text-paper/45">{stage.label}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-paper tabular">{stage.value}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-paper/15 pt-5">
              <p className="mono-label text-paper/45">
                Linked lots <span className="ml-2 text-sm text-paper tabular">{dna.linkedLots}</span>
              </p>
              {expanded ? (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-signal underline-offset-4 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Return to overview
                </Link>
              ) : (
                <Link
                  href="/batch-dna"
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-signal underline-offset-4 hover:underline"
                >
                  Open trace concept
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
