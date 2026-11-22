import type { Permission } from "@/lib/auth/permissions";

export type NavigationItem = {
  label: string;
  href: string;
  index: string;
  phase: string;
  permission: Permission;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    title: "Command",
    items: [
      { label: "Factory overview", href: "/", index: "00", phase: "Live", permission: "overview:view" },
      { label: "Orders", href: "/orders", index: "01", phase: "Phase 2", permission: "orders:view" },
      { label: "Production", href: "/production", index: "06", phase: "Phase 2", permission: "production:view" },
      { label: "Dispatch", href: "/dispatch", index: "09", phase: "Phase 2", permission: "dispatch:view" },
    ],
  },
  {
    title: "Materials",
    items: [
      { label: "Purchases", href: "/purchases", index: "03", phase: "Phase 2", permission: "purchases:view" },
      { label: "Inventory", href: "/inventory", index: "04", phase: "Phase 2", permission: "inventory:view" },
      { label: "Recipes", href: "/recipes", index: "05", phase: "Phase 2", permission: "recipes:view" },
      { label: "Finished goods", href: "/finished-goods", index: "07", phase: "Phase 2", permission: "finishedGoods:view" },
    ],
  },
  {
    title: "Accountability",
    items: [
      { label: "Invoices", href: "/invoices", index: "08", phase: "Phase 2", permission: "invoices:view" },
      { label: "Collections", href: "/collections", index: "10", phase: "Phase 2", permission: "payments:view" },
      { label: "Batch DNA", href: "/batch-dna", index: "12", phase: "Concept", permission: "batchDna:view" },
      { label: "Audit", href: "/audit", index: "11", phase: "Phase 2", permission: "audit:view" },
    ],
  },
];

export function getNavigationGroups(permissions: readonly Permission[]): NavigationGroup[] {
  const granted = new Set<Permission>(permissions);

  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => granted.has(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function flattenNavigation(groups: readonly NavigationGroup[]) {
  return groups.flatMap((group) => group.items);
}
