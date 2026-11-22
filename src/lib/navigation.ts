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
      { label: "Orders", href: "/orders", index: "01", phase: "Planned", permission: "orders:view" },
      { label: "Production", href: "/production", index: "06", phase: "Live", permission: "production:view" },
      { label: "Dispatch", href: "/dispatch", index: "09", phase: "Planned", permission: "dispatch:view" },
    ],
  },
  {
    title: "Materials",
    items: [
      { label: "Purchases", href: "/purchases", index: "03", phase: "Phase 4", permission: "purchases:view" },
      { label: "Inventory", href: "/inventory", index: "04", phase: "Phase 4", permission: "inventory:view" },
      { label: "Recipes", href: "/recipes", index: "05", phase: "Planned", permission: "recipes:view" },
      { label: "Finished goods", href: "/finished-goods", index: "07", phase: "Planned", permission: "finishedGoods:view" },
    ],
  },
  {
    title: "Accountability",
    items: [
      { label: "Invoices", href: "/invoices", index: "08", phase: "Planned", permission: "invoices:view" },
      { label: "Collections", href: "/collections", index: "10", phase: "Planned", permission: "payments:view" },
      { label: "Batch DNA", href: "/batch-dna", index: "12", phase: "Live", permission: "batchDna:view" },
      { label: "Audit", href: "/audit", index: "11", phase: "Planned", permission: "audit:view" },
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
