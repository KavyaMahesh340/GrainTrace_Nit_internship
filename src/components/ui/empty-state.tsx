import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  code: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export function EmptyState({
  code,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border border-obsidian/20 bg-paper px-6 py-12 sm:px-10 sm:py-16",
        className,
      )}
    >
      <div className="preview-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative max-w-2xl">
        <p className="mono-label text-rust">{code}</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tightest sm:text-5xl">
          {title}
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-obsidian/65 sm:text-base">{description}</p>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className={cn(buttonVariants({ variant: "dark", size: "default" }), "mt-8")}
          >
            {actionLabel}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
