import type { FlowState, PreviewSnapshot } from "@/lib/domain/preview";
import { cn } from "@/lib/utils";

const stateAccent: Record<FlowState, string> = {
  cleared: "border-forest bg-forest",
  active: "border-signal bg-signal",
  queued: "border-ink-muted/40 bg-paper",
  exception: "border-rust bg-rust",
};

const stateText: Record<FlowState, string> = {
  cleared: "text-forest",
  active: "text-obsidian",
  queued: "text-ink-muted",
  exception: "text-rust-ink",
};

export function MaterialFlow({ flow }: { flow: PreviewSnapshot["flow"] }) {
  return (
    <section className="border-b border-obsidian/15 bg-paper" aria-labelledby="material-flow-heading">
      <div className="page-frame py-10 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-label text-rust-ink">02 / Material flow</p>
            <h2 id="material-flow-heading" className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              One order. Eleven accountable states.
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-6 text-ink-muted">
            Illustrative state distribution across the journey. Counts are preview values, not live
            inventory or order totals.
          </p>
        </div>
        <div className="scrollbar-none mt-9 overflow-x-auto pb-3">
          <ol className="flex min-w-max items-stretch" aria-label="Material journey stages">
            {flow.map((stage, index) => (
              <li key={stage.code} className="flex items-stretch">
                <div className="w-[168px] border border-obsidian/15 bg-white/40 p-4">
                  <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-label">
                    <span className="text-ink-muted">{stage.code}</span>
                    <span className="tabular text-obsidian">{stage.count}</span>
                  </div>
                  <span className={cn("mt-4 block h-1 w-10 border", stateAccent[stage.state])} aria-hidden="true" />
                  <p className="mt-4 text-sm font-medium leading-5">{stage.label}</p>
                  <p className={cn("mono-label mt-3", stateText[stage.state])}>{stage.state}</p>
                </div>
                {index < flow.length - 1 ? (
                  <div className="flex w-6 items-center justify-center" aria-hidden="true">
                    <span className="h-px w-full bg-obsidian/20" />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
