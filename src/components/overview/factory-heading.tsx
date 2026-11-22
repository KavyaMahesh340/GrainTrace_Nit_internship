import { PreviewBadge } from "@/components/system/preview-badge";
import type { PreviewSnapshot } from "@/lib/domain/preview";

type FactoryHeadingProps = {
  factory: PreviewSnapshot["factory"];
  generatedAt: string;
};

export function FactoryHeading({ factory, generatedAt }: FactoryHeadingProps) {
  return (
    <section className="relative overflow-hidden border-b border-obsidian/15">
      <div className="preview-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1600px] px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <PreviewBadge />
              <span className="mono-label text-machine">
                {factory.code} / {factory.location}
              </span>
            </div>
            <h1 className="mt-7 max-w-5xl text-[clamp(2.75rem,7.4vw,7rem)] font-semibold leading-[0.88] tracking-tightest">
              Every packet
              <br />
              has a <span className="bg-signal px-2">history.</span>
            </h1>
            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-sm leading-7 text-obsidian/65 sm:text-base">
                A working view of the material journey — from salesman order to audit — with every
                quantity and transaction kept accountable.
              </p>
              <p className="font-mono text-[10px] uppercase leading-5 tracking-label text-machine">
                Every packet produced.
                <br />
                Every gram accounted for.
              </p>
            </div>
          </div>
          <aside className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
            <p className="mono-label text-machine">Operational context</p>
            <dl className="mt-6 space-y-5">
              <div>
                <dt className="mono-label text-machine/70">Date</dt>
                <dd className="mt-1 text-xl font-medium tracking-tight tabular">{factory.operationalDate}</dd>
              </div>
              <div>
                <dt className="mono-label text-machine/70">Shift</dt>
                <dd className="mt-1 text-xl font-medium tracking-tight">{factory.shift}</dd>
                <dd className="mt-1 font-mono text-xs text-machine tabular">{factory.shiftWindow}</dd>
              </div>
              <div>
                <dt className="mono-label text-machine/70">Snapshot</dt>
                <dd className="mt-1 font-mono text-xs text-obsidian tabular">{generatedAt}</dd>
              </div>
            </dl>
            <div className="mt-8 border-t border-obsidian/15 pt-5">
              <p className="text-xs leading-6 text-obsidian/55">
                Illustrative values only. No production or financial calculations are live in Phase 1.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
