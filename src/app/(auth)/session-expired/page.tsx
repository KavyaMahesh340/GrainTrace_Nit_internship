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
    <main className="surface-dark flex min-h-screen flex-col bg-obsidian text-paper">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-6 py-16 sm:px-10">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Clock3 className="h-6 w-6 text-signal" aria-hidden="true" />
            <p className="mono-label mt-8 text-signal">Session state / Expired</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.95] tracking-tightest sm:text-6xl">
              Your operating session has closed.
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-paper/60">
              Sessions expire after twelve hours, and revoked sessions are no longer accepted.
              Sign in again to continue from your role-specific landing view.
            </p>
          </div>
          <div className="lg:col-span-5 lg:border-l lg:border-paper/15 lg:pl-10">
            <p className="mono-label text-paper/40">Next action</p>
            <p className="mt-4 text-lg leading-8 text-paper/85">
              Return to the sign-in console. Your saved work is unaffected.
            </p>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-8")}
            >
              Go to sign in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
