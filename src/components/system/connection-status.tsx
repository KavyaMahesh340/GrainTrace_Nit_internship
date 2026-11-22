"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { getOfflineQueueSummary, subscribeToOfflineChanges, type OfflineQueueSummary } from "@/lib/offline/queue";

const emptySummary: OfflineQueueSummary = {
  total: 0,
  drafts: 0,
  pending: 0,
  failed: 0,
  synced: 0,
  lastSuccessfulSync: null,
};

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [summary, setSummary] = useState<OfflineQueueSummary>(emptySummary);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    const updateQueue = () => {
      void getOfflineQueueSummary().then(setSummary).catch(() => undefined);
    };

    updateConnection();
    updateQueue();

    const unsubscribe = subscribeToOfflineChanges(updateQueue);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      unsubscribe();
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  return (
    <div
      className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-paper/60"
      title="Connection state and persistent offline order queue"
    >
      {isOnline ? (
        <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
      )}
      <span>{isOnline ? "Online" : "Offline"}</span>
      <span className="text-paper/25">/</span>
      <span>Queue {summary.pending}</span>
      {summary.failed > 0 ? (
        <span className="flex items-center gap-1 text-signal">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {summary.failed} failed
        </span>
      ) : null}
    </div>
  );
}
