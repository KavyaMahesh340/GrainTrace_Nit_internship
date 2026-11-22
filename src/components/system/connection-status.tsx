"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { getQueueCount, subscribeToQueueChanges } from "@/lib/offline/queue";

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    const updateQueue = () => {
      getQueueCount().then(setQueueCount).catch(() => undefined);
    };

    updateConnection();
    updateQueue();

    const unsubscribe = subscribeToQueueChanges(updateQueue);
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
      title="Connection state and queued offline mutations"
    >
      {isOnline ? (
        <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
      )}
      <span>{isOnline ? "Online" : "Offline"}</span>
      <span className="text-paper/25">/</span>
      <span>Queue {queueCount === null ? "—" : queueCount}</span>
    </div>
  );
}
