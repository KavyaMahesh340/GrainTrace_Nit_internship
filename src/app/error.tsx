"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1600px] flex-col justify-center px-5 py-16 sm:px-8">
      <p className="mono-label text-rust">System state / Error</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
        This view could not be assembled.
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-7 text-obsidian/60">
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
  );
}
