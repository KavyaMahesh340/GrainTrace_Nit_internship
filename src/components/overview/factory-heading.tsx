import { PageHeader } from "@/components/system/page-header";
import { PreviewBadge } from "@/components/system/preview-badge";
import type { PreviewSnapshot } from "@/lib/domain/preview";

type FactoryHeadingProps = {
  factory: PreviewSnapshot["factory"];
  generatedAt: string;
};

export function FactoryHeading({ factory, generatedAt }: FactoryHeadingProps) {
  return (
    <PageHeader
      code="00 / Factory overview"
      title={
        <>
          Every packet
          <br />
          has a <span className="bg-signal px-2 text-obsidian">history.</span>
        </>
      }
      description="A working view of the material journey — from salesman order to audit — with every quantity and transaction kept accountable."
      footnote="Every packet produced. Every gram accounted for."
      aside={
        <div className="border-l-2 border-signal pl-5">
          <div className="flex flex-wrap items-center gap-3">
            <PreviewBadge />
            <span className="mono-caption text-ink-muted">
              {factory.code} / {factory.location}
            </span>
          </div>
          <dl className="mt-6 space-y-5">
            <div className="flex items-baseline justify-between gap-4 border-b border-obsidian/10 pb-3">
              <dt className="mono-label text-ink-muted">Operational date</dt>
              <dd className="text-lg font-medium tracking-tight tabular">{factory.operationalDate}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-obsidian/10 pb-3">
              <dt className="mono-label text-ink-muted">Shift</dt>
              <dd className="text-right text-lg font-medium tracking-tight">{factory.shift}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-obsidian/10 pb-3">
              <dt className="mono-label text-ink-muted">Window</dt>
              <dd className="font-mono text-xs text-ink-muted tabular">{factory.shiftWindow}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="mono-label text-ink-muted">Snapshot</dt>
              <dd className="font-mono text-xs text-ink-muted tabular">{generatedAt}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs leading-6 text-ink-muted">
            Illustrative values only. No production or financial calculations are live in this preview.
          </p>
        </div>
      }
    />
  );
}
