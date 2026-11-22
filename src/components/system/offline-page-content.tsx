"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getSalesReferenceCache } from "@/lib/offline/reference-cache";
import { listOfflineOrders, type OfflineOrderRecord } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";

export function OfflinePageContent() {
  const [online, setOnline] = useState(true);
  const [records, setRecords] = useState<OfflineOrderRecord[]>([]);
  const [cachedCounts, setCachedCounts] = useState({ customers: 0, products: 0 });

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void Promise.all([listOfflineOrders().catch(() => []), getSalesReferenceCache().catch(() => null)]).then(
      ([stored, cached]) => {
        setRecords(stored);
        setCachedCounts({
          customers: cached?.customers.length ?? 0,
          products: cached?.products.length ?? 0,
        });
      },
    );
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const failed = records.filter((record) => record.state === "failed").length;
  const queued = records.filter((record) => record.state === "queued" || record.state === "syncing").length;

  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <WifiOff className="h-7 w-7 text-rust" aria-hidden="true" />
        <p className="mono-label mt-6 text-rust">Connection state / Offline</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-none tracking-tightest sm:text-6xl">
          You are offline. Your work is not lost.
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-obsidian/60">
          This fallback is cached by the installed app. Salesman orders saved before the connection dropped
          remain stored locally in this browser (IndexedDB) and will synchronize from the Orders screen when
          the server is reachable again.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">01 / SAVED</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">
              {records.length} order{records.length === 1 ? "" : "s"} on this device · {queued} queued · {failed} failed.
            </p>
          </div>
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">02 / REFERENCES</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">
              {cachedCounts.customers} customers and {cachedCounts.products} products cached for offline entry.
            </p>
          </div>
          <div className="border border-obsidian/15 bg-white/60 p-5">
            <p className="mono-label text-machine">03 / RETURN</p>
            <p className="mt-2 text-sm leading-6 text-obsidian/70">
              Reconnect, open Orders, and use Retry sync if needed.
            </p>
          </div>
        </div>
        <section aria-label="Local queue" className="mt-8 border border-obsidian/15 bg-white/60 p-5">
          <p className="mono-label text-machine">LOCAL QUEUE</p>
          {records.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {records.slice(0, 5).map((record) => (
                <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian/10 pb-2 text-sm">
                  <span className="break-all font-mono">{record.orderNumber}</span>
                  <span className="font-mono text-xs uppercase text-machine">{record.state}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-obsidian/60">No orders are saved on this device.</p>
          )}
        </section>
        <div className="mt-10 flex flex-wrap gap-3">
          {online ? (
            <>
              <Link href="/orders" className={cn(buttonVariants({ variant: "dark", size: "lg" }))}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Open Orders
              </Link>
              <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Return to overview
              </Link>
            </>
          ) : (
            <p role="status" aria-live="polite" className="border border-obsidian/15 bg-white/60 px-4 py-3 text-sm text-machine">
              Reconnect to open Orders. Your local queue remains on this device.
            </p>
          )}
        </div>
        <p className="mt-10 max-w-xl text-xs leading-6 text-obsidian/45">
          Authenticated pages, reports, invoices, and API responses are never stored in the service worker
          cache. Install GRAINTRACE from your browser menu for the full offline fallback.
        </p>
      </div>
    </main>
  );
}
