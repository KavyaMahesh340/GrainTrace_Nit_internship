import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "@/components/system/service-worker-registration";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { SessionUser } from "@/lib/auth/types";
import { getNavigationGroups } from "@/lib/navigation";

export function AppShell({ children, user }: { children: ReactNode; user: SessionUser }) {
  const navigationGroups = getNavigationGroups(user.permissions);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-signal focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-obsidian"
      >
        Skip to content
      </a>
      <SiteHeader user={user} navigationGroups={navigationGroups} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <ServiceWorkerRegistration />
    </div>
  );
}
