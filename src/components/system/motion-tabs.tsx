"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type MotionTabItem<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type MotionTabsProps<T extends string> = {
  items: readonly MotionTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

export function MotionTabs<T extends string>({ items, value, onChange, label, className }: MotionTabsProps<T>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1 border-b border-obsidian/15", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative min-h-11 px-4 pb-3 pt-2 text-left font-mono text-[11px] uppercase tracking-label transition-colors",
              active ? "text-obsidian" : "text-ink-muted hover:text-obsidian",
            )}
          >
            <span>{item.label}</span>
            {item.hint ? <span className="ml-2 text-[9px] text-machine">{item.hint}</span> : null}
            {active ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : `motion-tab-${label}`}
                className="absolute inset-x-0 -bottom-px h-0.5 bg-rust"
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
