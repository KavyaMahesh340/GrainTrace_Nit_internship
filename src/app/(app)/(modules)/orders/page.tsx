import type { Metadata } from "next";
import { OrdersWorkspace } from "@/components/sales/orders-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getSalesOptions, getSalesOverview, listSalesOrders } from "@/lib/workflows/sales";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("orders:view");

  return (
    <OrdersWorkspace
      initialOrders={listSalesOrders(user.factoryId)}
      overview={getSalesOverview(user.factoryId)}
      options={getSalesOptions(user.factoryId)}
      canManage={user.permissions.includes("orders:manage")}
      canApprove={user.permissions.includes("orders:approve")}
      isSalesman={user.role === "salesman"}
      focus={searchParams.focus}
    />
  );
}
