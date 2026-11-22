"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ServiceWorkerRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      };
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
      }
    }

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const clearInstallPrompt = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setInstallPrompt(null);
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
  };

  if (!installPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex max-w-md flex-col gap-3 border border-forest/30 bg-obsidian p-4 text-paper shadow-xl sm:left-auto sm:right-6">
      <div>
        <p className="mono-label text-signal">OFFLINE ACCESS</p>
        <p className="mt-1 text-sm leading-6 text-paper/80">
          Install GRAINTRACE to open the offline fallback and cached reference data without a connection.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void install()}
          className="inline-flex h-10 items-center gap-2 bg-signal px-4 text-xs font-semibold uppercase tracking-label text-obsidian transition hover:bg-paper"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Install app
        </button>
        <button
          type="button"
          onClick={() => setInstallPrompt(null)}
          className="h-10 border border-paper/25 px-4 text-xs font-semibold uppercase tracking-label text-paper/70 transition hover:border-paper/60"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
