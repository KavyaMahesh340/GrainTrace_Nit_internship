import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-forest/30 bg-sage/70 text-forest",
        outline: "border-obsidian/30 text-obsidian",
        dark: "border-paper/35 text-paper",
        rust: "border-rust/40 bg-rust/10 text-rust-ink",
        machine: "border-ink-muted/35 bg-paper text-ink-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
