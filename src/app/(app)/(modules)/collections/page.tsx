import type { Metadata } from "next";
import { CollectionsWorkspace } from "@/components/sales/collections-workspace";
import { requirePermission } from "@/lib/auth/access";
import { listCollections, listPayments } from "@/lib/workflows/payments";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("payments:view");
  const today = new Date().toISOString().slice(0, 10);
  const collections = listCollections(user.factoryId);
  const payments = listPayments(user.factoryId);

  return (
    <CollectionsWorkspace
      initialCollections={collections}
      initialPayments={payments}
      overview={{
        duePaise: collections.reduce((sum, row) => sum + row.outstandingPaise, 0),
        overduePaise: collections
          .filter((row) => row.status !== "cancelled" && row.dueDate < today)
          .reduce((sum, row) => sum + row.outstandingPaise, 0),
        collectedPaise: payments.reduce((sum, payment) => sum + payment.amountPaise, 0),
      }}
      canManage={user.permissions.includes("payments:manage")}
      focus={searchParams.focus}
    />
  );
}
