import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-label",
  {
    variants: {
      variant: {
        default: "border-signal bg-signal/25 text-forest",
        outline: "border-obsidian/25 text-obsidian",
        dark: "border-paper/25 text-paper",
        rust: "border-rust/40 bg-rust/10 text-rust",
        machine: "border-machine/40 text-machine",
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
