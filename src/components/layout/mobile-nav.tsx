"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavigationGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav({ navigationGroups }: { navigationGroups: NavigationGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="light" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-paper/10 pr-14">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>GRAINTRACE / MATERIAL JOURNEY</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {navigationGroups.map((group, groupIndex) => (
            <section key={group.title} className="pt-7">
              <div className="flex items-center gap-3">
                <p className="mono-label text-signal">{String(groupIndex + 1).padStart(2, "0")}</p>
                <p className="mono-label text-paper-muted">{group.title}</p>
              </div>
              <ul className="mt-3">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href} className="border-b border-paper/10">
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-between gap-4 py-4 text-sm transition-colors",
                          isActive ? "text-signal" : "text-paper-muted hover:text-paper",
                        )}
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="font-mono text-[10px] text-paper-muted">{item.index}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="flex items-center gap-2 border border-paper/20 px-2 py-1 font-mono text-[9px] uppercase tracking-label text-paper-muted">
                          {item.phase}
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
