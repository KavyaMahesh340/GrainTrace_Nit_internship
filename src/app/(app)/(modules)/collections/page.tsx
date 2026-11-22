import type { Metadata } from "next";
import { CollectionsWorkspace } from "@/components/sales/collections-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getCollectionsDashboard, listCollections, listPayments } from "@/lib/workflows/payments";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("payments:view");
  const collections = listCollections(user.factoryId);
  const payments = listPayments(user.factoryId);
  const dashboard = getCollectionsDashboard(user.factoryId);

  return (
    <CollectionsWorkspace
      initialCollections={collections}
      initialPayments={payments}
      initialDashboard={dashboard}
      canManage={user.permissions.includes("payments:manage")}
      canCorrect={user.permissions.includes("payments:correct")}
      focus={searchParams.focus}
    />
  );
}
