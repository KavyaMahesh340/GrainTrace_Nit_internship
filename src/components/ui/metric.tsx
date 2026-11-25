import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricCellProps = {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "default" | "rust" | "forest" | "dark";
  className?: string;
};

const valueTone = {
  default: "text-obsidian",
  rust: "text-rust-ink",
  forest: "text-forest",
  dark: "text-paper",
};

export function MetricCell({ label, value, note, tone = "default", className }: MetricCellProps) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "metric-cell",
        dark && "border-paper/10 bg-obsidian",
        className,
      )}
    >
      <p className={cn("metric-label", dark && "text-paper-muted")}>{label}</p>
      <p className={cn("metric-value", valueTone[tone])}>{value}</p>
      {note ? <p className={cn("mono-caption mt-2", dark ? "text-paper-muted" : "text-ink-muted")}>{note}</p> : null}
    </div>
  );
}

export function MetricGrid({
  items,
  columns = 4,
  className,
}: {
  items: MetricCellProps[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px bg-obsidian/10",
        columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <MetricCell key={item.label} {...item} />
      ))}
    </div>
  );
}
