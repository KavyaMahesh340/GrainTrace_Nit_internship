import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="surface-dark mt-auto border-t border-paper/10 bg-obsidian text-paper">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="mono-label text-paper/40">GRAINTRACE / PHASE 4 PURCHASES + INVENTORY</p>
          <p className="mt-2 max-w-lg text-xs leading-6 text-paper/50">
            Purchases and inventory are live ledger-backed workflows. Other journey stages remain
            scoped route previews until their workflow phases are implemented.
          </p>
        </div>
        <Link
          href="/batch-dna"
          className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-signal"
        >
          View Batch DNA concept
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </Link>
      </div>
    </footer>
  );
}
