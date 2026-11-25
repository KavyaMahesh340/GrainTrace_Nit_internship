import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="surface-dark mt-auto border-t border-paper/15 bg-obsidian text-paper">
      <div className="page-frame grid gap-8 py-10 md:grid-cols-12 md:py-12">
        <div className="md:col-span-8">
          <div className="flex items-center gap-3">
            <span className="h-0.5 w-10 bg-signal" aria-hidden="true" />
            <p className="mono-label text-paper-muted">GRAINTRACE / FIELD OPERATIONS</p>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-paper-muted">
            Ledger-backed grain operations: inventory, production, traceability, sales, finance, and audit
            on one continuous material record.
          </p>
        </div>
        <div className="md:col-span-4 md:border-l md:border-paper/15 md:pl-8">
          <p className="mono-label text-paper-muted">Traceability index</p>
          <Link
            href="/batch-dna"
            className="group mt-4 flex items-center justify-between gap-4 border-b border-paper/20 pb-3 font-mono text-xs uppercase tracking-[0.12em] text-signal"
          >
            Open live Batch DNA
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </Link>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Every packet produced. Every gram accounted for.
          </p>
        </div>
      </div>
    </footer>
  );
}
