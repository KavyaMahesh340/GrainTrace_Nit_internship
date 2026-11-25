import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Session expired",
};

export default function SessionExpiredPage() {
  return (
    <main className="surface-dark flex min-h-screen flex-col bg-obsidian text-paper" data-surface="dark">
      <div className="preview-grid pointer-events-none fixed inset-0 opacity-20" aria-hidden="true" />
      <div className="page-frame relative flex flex-1 flex-col justify-center py-12 sm:py-16">
        <div className="editorial-grid">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center border border-paper/25">
                <Clock3 className="h-4 w-4 text-signal" aria-hidden="true" />
              </span>
              <p className="mono-label text-signal">Session state / Expired</p>
            </div>
            <h1 className="mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[0.9] tracking-tightest text-balance">
              Your operating session has closed.
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-paper-muted">
              Sessions expire after twelve hours, and revoked sessions are no longer accepted.
              Sign in again to continue from your role-specific landing view.
            </p>
          </div>
          <aside className="lg:col-span-4 lg:border-l lg:border-paper/15 lg:pl-8">
            <p className="mono-label text-paper-muted">Next action</p>
            <p className="mt-4 text-lg leading-8 text-paper">
              Return to the sign-in console. Your saved work is unaffected.
            </p>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-8")}
            >
              Go to sign in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
