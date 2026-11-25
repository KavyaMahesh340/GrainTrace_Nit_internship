import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Notice({
  tone = "success",
  children,
  className,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  const isError = tone === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(
        "border-l-2 px-4 py-3 text-sm leading-6",
        isError && "border-rust bg-rust/10 text-rust-ink",
        tone === "success" && "border-forest bg-sage/50 text-forest",
        tone === "info" && "border-obsidian bg-paper text-ink-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}
