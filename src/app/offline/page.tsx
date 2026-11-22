import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <WifiOff className="h-7 w-7 text-rust" aria-hidden="true" />
        <p className="mono-label mt-6 text-rust">Connection state / Offline</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
          You are offline. Your work is not lost.
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-obsidian/60">
          This fallback is cached by the installed app. Salesman orders saved before the connection
          dropped remain in this device’s encrypted browser storage and will synchronize from the
          Orders screen when the server is reachable again.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">01 / SAVED</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">Drafts and queued orders stay on this device.</p>
          </div>
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">02 / SYNCED</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">Each order keeps a unique key so retries never duplicate it.</p>
          </div>
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">03 / RETURN</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">Reconnect, open Orders, and use Retry sync if needed.</p>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className={cn(buttonVariants({ variant: "dark", size: "lg" }))}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Return to overview
          </Link>
          <div className={cn(buttonVariants({ variant: "outline", size: "lg" }), "pointer-events-none")}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reconnect and retry from Orders
          </div>
        </div>
        <p className="mt-10 max-w-xl text-xs leading-6 text-obsidian/45">
          Authenticated pages, reports, invoices, and API responses are never stored in the service
          worker cache. Install GRAINTRACE from your browser menu for the full offline fallback.
        </p>
      </div>
    </main>
  );
}
