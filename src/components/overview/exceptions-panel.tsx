import Link from "next/link";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import type { PreviewSnapshot } from "@/lib/domain/preview";

export function ExceptionsPanel({ exceptions }: { exceptions: PreviewSnapshot["exceptions"] }) {
  return (
    <section className="surface-dark bg-obsidian text-paper">
      <div className="mx-auto max-w-[1600px] px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <p className="mono-label text-rust">05 / Production exceptions</p>
            <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Interruptions worth naming.
            </h2>
            <p className="mt-5 text-xs leading-6 text-paper/50">
              Preview exceptions only. No alerting or tolerance engine is active.
            </p>
          </div>
          <div className="divide-y divide-paper/12 border-y border-paper/12 lg:col-span-9">
            {exceptions.length === 0 ? (
              <p className="py-8 text-sm text-paper/60">No preview exceptions recorded.</p>
            ) : (
              exceptions.map((exception) => (
                <article key={exception.id} className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="flex gap-4">
                    <TriangleAlert
                      className={exception.severity === "blocked" ? "mt-0.5 h-4 w-4 shrink-0 text-rust" : "mt-0.5 h-4 w-4 shrink-0 text-signal"}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex flex-wrap items-baseline gap-3">
                        <h3 className="text-base font-medium">{exception.title}</h3>
                        <span className="font-mono text-[10px] uppercase tracking-label text-paper/40">
                          {exception.id}
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-xs leading-6 text-paper/60 sm:text-sm">
                        {exception.detail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end">
                    <span className="font-mono text-[10px] text-paper/40 tabular">
                      {exception.detectedAt}
                    </span>
                    <Link
                      href={`/production?exception=${exception.id}`}
                      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-signal underline-offset-4 hover:underline"
                    >
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
