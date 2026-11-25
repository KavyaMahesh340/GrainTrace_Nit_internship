import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TableFrameProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function TableFrame({ title, description, actions, children, className }: TableFrameProps) {
  return (
    <section className={cn("border border-obsidian/15 bg-paper", className)} aria-labelledby={`table-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/15 px-5 py-4">
        <div>
          <h2 id={`table-${title.replace(/\s+/g, "-").toLowerCase()}`} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="mt-1 mono-caption text-ink-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="table-scroll" role="region" aria-label={`${title}, horizontally scrollable`} tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
