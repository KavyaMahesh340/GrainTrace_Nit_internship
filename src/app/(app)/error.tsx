"use client";

import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-frame flex min-h-[70vh] flex-col justify-center py-16">
      <div className="editorial-grid">
        <div className="lg:col-span-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center border border-rust/40 bg-rust/10">
              <TriangleAlert className="h-4 w-4 text-rust-ink" aria-hidden="true" />
            </span>
            <p className="mono-label text-rust-ink">System state / Error</p>
          </div>
          <h1 className="mt-6 max-w-3xl text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[0.9] tracking-tightest text-balance">
            This view could not be assembled.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-ink-muted">
            The factory overview did not render. Retry the view, or return to the overview shell. No
            transaction has been submitted by this error.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button onClick={reset} variant="dark" size="lg">
              Retry view
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Factory overview
              </Link>
            </Button>
          </div>
        </div>
        <aside className="mt-10 border-t border-obsidian/15 pt-5 lg:col-span-4 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="mono-label text-ink-muted">Failure boundary</p>
          <p className="mt-4 text-sm leading-7 text-ink-muted">
            This boundary prevents a broken view from reaching the ledger. No state has been mutated.
          </p>
        </aside>
      </div>
    </div>
  );
}
