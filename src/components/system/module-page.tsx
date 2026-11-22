import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type ModulePageProps = {
  code: string;
  title: string;
  description: string;
  focusLabel?: string;
  focusValue?: string;
};

export function ModulePage({
  code,
  title,
  description,
  focusLabel = "Preview reference",
  focusValue,
}: ModulePageProps) {
  return (
    <div className="mx-auto max-w-[1600px] px-5 py-12 sm:px-8 sm:py-16">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-machine underline-offset-4 hover:text-obsidian hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Factory overview
      </Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="mono-label text-rust">Module {code} / Route scope</p>
          <h1 className="mt-4 text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
            {title}
          </h1>
        </div>
        <div className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
          <p className="text-sm leading-7 text-obsidian/60">{description}</p>
          {focusValue ? (
            <div className="mt-6 border border-obsidian/15 px-4 py-3">
              <p className="mono-label text-machine">{focusLabel}</p>
              <p className="mt-2 font-mono text-sm text-obsidian tabular">{focusValue}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-12">
        <EmptyState
          code="Not yet implemented"
          title="This workflow is scoped, not simulated."
          description="This route is reserved for a planned workflow stage. The functional requirements are documented in docs/REQUIREMENTS.md; no placeholder controls are presented as working actions."
          actionLabel="Back to factory overview"
          actionHref="/"
        />
      </div>
    </div>
  );
}
