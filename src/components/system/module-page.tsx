import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/system/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

type ModulePageProps = {
  code: string;
  title: string;
  description: string;
  focusLabel?: string;
  focusValue?: string;
};

type RegisterVariant = "default" | "rust" | "machine" | "outline";

function StatusRegister({ focusLabel, focusValue }: { focusLabel: string; focusValue?: string }) {
  const rows: Array<{ label: string; value: string; variant: RegisterVariant }> = [
    { label: "Route", value: "Defined", variant: "default" },
    { label: "Workflow", value: "Not implemented", variant: "rust" },
    { label: "Controls", value: "None exposed", variant: "machine" },
  ];
  if (focusValue) rows.push({ label: focusLabel, value: focusValue, variant: "outline" });

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-obsidian/15 pb-3">
        <p className="mono-label text-rust-ink">Status register</p>
        <Badge variant="machine">Route scope</Badge>
      </div>
      <dl className="divide-y divide-obsidian/10">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 items-start justify-between gap-4 py-3">
            <dt className="mono-caption text-ink-muted">{row.label}</dt>
            <dd className="min-w-0 text-right">
              <Badge variant={row.variant} className="max-w-full break-all text-right">
                {row.value}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ModulePage({
  code,
  title,
  description,
  focusLabel = "Preview reference",
  focusValue,
}: ModulePageProps) {
  return (
    <div>
      <PageHeader
        code={`Module ${code} / Route scope`}
        title={
          <span className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-2">
            <span className="font-mono text-[0.5em] leading-none tabular text-rust-ink sm:text-[0.42em]">
              {code}
            </span>
            <span className="min-w-0">{title}</span>
          </span>
        }
        description={description}
        footnote="Reserved route · no simulated workflow controls"
        tone="ledger"
        aside={<StatusRegister focusLabel={focusLabel} focusValue={focusValue} />}
      />

      <div className="page-frame py-10 sm:py-14">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-muted underline-offset-4 hover:text-obsidian hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Factory overview
        </Link>

        <div className="editorial-grid mt-8">
          <div className="min-w-0 lg:col-span-8">
            <p className="mono-label text-rust-ink">Not yet implemented</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tightest text-balance sm:text-5xl">
              This workflow is scoped, not simulated.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
              This route is reserved for a planned workflow stage. The functional requirements are
              documented in docs/REQUIREMENTS.md; no placeholder controls are presented as working actions.
            </p>
            <Link href="/" className={`${buttonVariants({ variant: "dark" })} mt-8 min-h-11`}>
              Back to factory overview
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <aside className="min-w-0 lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
            <p className="mono-label text-ink-muted">Route identity</p>
            <div className="mt-4 border-t border-obsidian/15">
              <div className="flex min-w-0 items-baseline justify-between gap-4 border-b border-obsidian/10 py-4">
                <span className="mono-caption text-ink-muted">Module</span>
                <span className="font-mono text-2xl tabular">{code}</span>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-4 border-b border-obsidian/10 py-4">
                <span className="mono-caption text-ink-muted">Title</span>
                <span className="min-w-0 break-words text-right text-sm font-medium">{title}</span>
              </div>
              <div className="flex min-w-0 items-start justify-between gap-4 py-4">
                <span className="mono-caption text-ink-muted">Reference field</span>
                <span className="min-w-0 break-words text-right text-sm text-ink-muted">{focusLabel}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
