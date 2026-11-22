import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActionArea({ focusId }: { focusId: string }) {
  return (
    <section className="bg-signal px-5 py-10 text-obsidian sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-label text-forest">Immediate action</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.02] tracking-tightest sm:text-5xl">
            Clear the approval before the 13:00 cut-off.
          </h2>
          <p className="mono-label mt-5 text-obsidian/60">
            {focusId} / {focusId === "SO-2481" ? "Sundaram Provisions" : "Preview order"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/orders?focus=${focusId}`} className={cn(buttonVariants({ variant: "dark", size: "lg" }))}>
            Open order board
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/production" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-obsidian/35 hover:bg-obsidian/10")}>
            Review production
          </Link>
        </div>
      </div>
    </section>
  );
}
