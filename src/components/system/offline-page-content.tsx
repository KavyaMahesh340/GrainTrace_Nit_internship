"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";
import { MetricCell } from "@/components/ui/metric";
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
      <div className="page-frame flex flex-1 flex-col justify-center py-12 sm:py-16">
        <div className="editorial-grid">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center border border-rust/40 bg-rust/10">
                <WifiOff className="h-4 w-4 text-rust-ink" aria-hidden="true" />
              </span>
              <p className="mono-label text-rust-ink">Connection state / Offline</p>
            </div>
            <h1 className="mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[0.9] tracking-tightest text-balance">
              You are offline. Your work is not lost.
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-ink-muted">
              This fallback is cached by the installed app. Salesman orders saved before the connection dropped
              remain stored locally in this browser (IndexedDB) and will synchronize from the Orders screen when
              the server is reachable again.
            </p>
          </div>
          <aside className="lg:col-span-4 lg:border-l lg:border-obsidian/15 lg:pl-8">
            <p className="mono-label text-ink-muted">Device register</p>
            <div className="mt-5 grid grid-cols-2 gap-px bg-obsidian/10">
              <MetricCell label="Saved" value={records.length} note={`${queued} queued`} />
              <MetricCell label="Failed" value={failed} tone={failed ? "rust" : "default"} />
              <MetricCell label="Customers" value={cachedCounts.customers} />
              <MetricCell label="Products" value={cachedCounts.products} />
            </div>
            <p className="mono-caption mt-5 text-ink-muted">Offline reference cache / IndexedDB</p>
          </aside>
        </div>

        <section aria-label="Local queue" className="mt-10 border border-obsidian/15 bg-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian/15 px-5 py-4">
            <div>
              <p className="mono-label text-ink-muted">Local queue</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Orders held on this device</h2>
            </div>
            <p className="mono-caption text-ink-muted">Showing recent 5</p>
          </div>
          <div className="divide-y divide-obsidian/10 px-5">
            {records.length > 0 ? (
              records.slice(0, 5).map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="break-all font-mono text-sm">{record.orderNumber}</span>
                  <span className="border border-obsidian/20 px-2 py-1 font-mono text-[10px] uppercase tracking-label text-ink-muted">
                    {record.state}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm leading-6 text-ink-muted">No orders are saved on this device.</p>
            )}
          </div>
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
            <p role="status" aria-live="polite" className="border-l-2 border-rust bg-rust/10 px-4 py-3 text-sm text-rust-ink">
              Reconnect to open Orders. Your local queue remains on this device.
            </p>
          )}
        </div>
        <p className="mt-10 max-w-xl text-xs leading-6 text-ink-muted">
          Authenticated pages, reports, invoices, and API responses are never stored in the service worker
          cache. Install GRAINTRACE from your browser menu for the full offline fallback.
        </p>
      </div>
    </main>
  );
}
