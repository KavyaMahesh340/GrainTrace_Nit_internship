export type NavigationItem = {
  label: string;
  href: string;
  index: string;
  phase: string;
};

export type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    title: "Command",
    items: [
      { label: "Factory overview", href: "/", index: "00", phase: "Live" },
      { label: "Orders", href: "/orders", index: "01", phase: "Phase 2" },
      { label: "Production", href: "/production", index: "06", phase: "Phase 2" },
      { label: "Dispatch", href: "/dispatch", index: "09", phase: "Phase 2" },
    ],
  },
  {
    title: "Materials",
    items: [
      { label: "Purchases", href: "/purchases", index: "03", phase: "Phase 2" },
      { label: "Inventory", href: "/inventory", index: "04", phase: "Phase 2" },
      { label: "Recipes", href: "/recipes", index: "05", phase: "Phase 2" },
      { label: "Finished goods", href: "/finished-goods", index: "07", phase: "Phase 2" },
    ],
  },
  {
    title: "Accountability",
    items: [
      { label: "Invoices", href: "/invoices", index: "08", phase: "Phase 2" },
      { label: "Collections", href: "/collections", index: "10", phase: "Phase 2" },
      { label: "Batch DNA", href: "/batch-dna", index: "12", phase: "Concept" },
      { label: "Audit", href: "/audit", index: "11", phase: "Phase 2" },
    ],
  },
];

export const navigationItems = navigationGroups.flatMap((group) => group.items);
