import type { FlowState, PreviewSnapshot } from "@/lib/domain/preview";
import { cn } from "@/lib/utils";

const stateBorder: Record<FlowState, string> = {
  cleared: "border-forest",
  active: "border-signal",
  queued: "border-machine/40",
  exception: "border-rust",
};

const stateText: Record<FlowState, string> = {
  cleared: "text-forest",
  active: "text-obsidian",
  queued: "text-machine",
  exception: "text-rust",
};

export function MaterialFlow({ flow }: { flow: PreviewSnapshot["flow"] }) {
  return (
    <section className="border-b border-obsidian/15 px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mono-label text-rust">02 / Material flow</p>
            <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              One order. Eleven accountable states.
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-6 text-obsidian/55">
            Illustrative state distribution across the journey. Counts are preview values, not live
            inventory or order totals.
          </p>
        </div>
        <div className="scrollbar-none mt-9 overflow-x-auto pb-2">
          <ol className="flex min-w-max items-start" aria-label="Material journey stages">
            {flow.map((stage, index) => (
              <li key={stage.code} className="flex items-start">
                <div className={cn("w-[150px] border-t-2 pr-4 pt-4", stateBorder[stage.state])}>
                  <div className="flex items-baseline justify-between font-mono text-[10px]">
                    <span className="text-machine">{stage.code}</span>
                    <span className="tabular text-obsidian/70">{stage.count}</span>
                  </div>
                  <p className="mt-5 text-sm font-medium leading-5">{stage.label}</p>
                  <p className={cn("mono-label mt-3", stateText[stage.state])}>{stage.state}</p>
                </div>
                {index < flow.length - 1 ? (
                  <div className={cn("mt-[-1px] h-0 w-7 border-t-2", stateBorder[stage.state])} aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
