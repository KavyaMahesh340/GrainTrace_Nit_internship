import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderTone = "light" | "dark" | "ledger" | "instrument";

type PageHeaderProps = {
  code: string;
  title: ReactNode;
  description: ReactNode;
  aside?: ReactNode;
  footnote?: string;
  tone?: PageHeaderTone;
  className?: string;
};

const toneStyles: Record<PageHeaderTone, { shell: string; label: string; body: string; rule: string; aside: string }> = {
  light: {
    shell: "bg-paper text-obsidian",
    label: "text-rust-ink",
    body: "text-ink-muted",
    rule: "border-obsidian/15",
    aside: "lg:border-obsidian/15",
  },
  dark: {
    shell: "surface-dark bg-obsidian text-paper",
    label: "text-signal",
    body: "text-paper-muted",
    rule: "border-paper/15",
    aside: "lg:border-paper/15",
  },
  ledger: {
    shell: "bg-white/55 text-obsidian",
    label: "text-rust-ink",
    body: "text-ink-muted",
    rule: "border-obsidian/20",
    aside: "lg:border-obsidian/20",
  },
  instrument: {
    shell: "surface-dark bg-forest text-paper",
    label: "text-signal",
    body: "text-paper-muted",
    rule: "border-paper/15",
    aside: "lg:border-paper/15",
  },
};

export function PageHeader({
  code,
  title,
  description,
  aside,
  footnote,
  tone = "light",
  className,
}: PageHeaderProps) {
  const styles = toneStyles[tone];
  const dark = tone === "dark" || tone === "instrument";

  return (
    <header className={cn("relative border-b", styles.shell, styles.rule, className)} data-surface={dark ? "dark" : undefined}>
      <div className="preview-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="page-frame relative py-10 sm:py-14">
        <div className="editorial-grid">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("mono-label", styles.label)}>{code}</span>
              <span className={cn("h-px w-10", dark ? "bg-paper/30" : "bg-obsidian/25")} aria-hidden="true" />
              <span className={cn("mono-caption", styles.body)}>GRAINTRACE / MATERIAL JOURNEY</span>
            </div>
            <h1 className="mt-5 max-w-5xl text-[clamp(2.5rem,5.4vw,5.25rem)] font-semibold leading-[0.92] tracking-tightest text-balance">
              {title}
            </h1>
            <p className={cn("mt-5 max-w-2xl text-sm leading-7 sm:text-base", styles.body)}>{description}</p>
            {footnote ? <p className={cn("mono-caption mt-6", styles.body)}>{footnote}</p> : null}
          </div>
          {aside ? (
            <div className={cn("min-w-0 lg:col-span-4 lg:border-l lg:pl-8", styles.aside)}>{aside}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
