import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActionArea({ focusId }: { focusId: string }) {
  return (
    <section className="relative overflow-hidden bg-signal px-5 py-10 text-obsidian sm:px-8 sm:py-12" aria-labelledby="immediate-action-heading">
      <div className="preview-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="page-frame relative grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-obsidian" aria-hidden="true" />
            <p className="mono-label text-forest">Immediate action</p>
          </div>
          <h2 id="immediate-action-heading" className="mt-5 max-w-3xl text-3xl font-semibold leading-[1.02] tracking-tightest sm:text-5xl">
            Clear the approval before the 13:00 cut-off.
          </h2>
          <p className="mono-label mt-5 text-ink-muted">
            {focusId} / {focusId === "SO-2481" ? "Sundaram Provisions" : "Preview order"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end">
          <Link href={`/orders?focus=${focusId}`} className={cn(buttonVariants({ variant: "dark", size: "lg" }))}>
            Open order board
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/production" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-obsidian/40 hover:bg-obsidian/10")}>
            Review production
          </Link>
        </div>
      </div>
    </section>
  );
}
