import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[1600px] flex-col justify-center px-5 py-16 sm:px-8">
      <WifiOff className="h-6 w-6 text-rust" aria-hidden="true" />
      <p className="mono-label mt-6 text-rust">Connection state / Offline</p>
      <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
        The factory record is still here.
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-7 text-obsidian/60">
        This shell can load from the service worker cache. The IndexedDB queue is reserved for
        future mutations; no offline writes are accepted in Phase 1.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "dark", size: "lg" }), "mt-9 w-fit")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Return to overview
      </Link>
    </div>
  );
}
