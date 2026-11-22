"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectionStatus } from "@/components/system/connection-status";
import { PreviewBadge } from "@/components/system/preview-badge";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { NavigationGroup } from "@/lib/navigation";
import { flattenNavigation } from "@/lib/navigation";
import type { SessionUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  user: SessionUser;
  navigationGroups: NavigationGroup[];
};

export function SiteHeader({ user, navigationGroups }: SiteHeaderProps) {
  const pathname = usePathname();
  const navigationItems = flattenNavigation(navigationGroups);

  return (
    <header className="surface-dark sticky top-0 z-40 bg-obsidian text-paper">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href={user.landingPath} className="group flex min-w-0 items-baseline gap-3" aria-label="GRAINTRACE home">
          <span className="text-lg font-semibold tracking-tightest sm:text-xl">GRAINTRACE</span>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-label text-paper/45 lg:inline">
            Every packet produced. Every gram accounted for.
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <ConnectionStatus />
          <PreviewBadge dark className="hidden sm:inline-flex" />
          <UserMenu user={user} />
          <MobileNav navigationGroups={navigationGroups} />
        </div>
      </div>
      {navigationItems.length > 0 ? (
        <nav aria-label="Primary navigation" className="hidden border-t border-paper/10 md:block">
          <div className="scrollbar-none mx-auto flex max-w-[1600px] overflow-x-auto px-5 sm:px-8">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-baseline gap-2 border-b-2 px-3 py-3 font-mono text-[10px] uppercase tracking-label transition-colors first:pl-0",
                    isActive
                      ? "border-signal text-signal"
                      : "border-transparent text-paper/55 hover:border-paper/30 hover:text-paper",
                  )}
                >
                  <span className="text-paper/30">{item.index}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
