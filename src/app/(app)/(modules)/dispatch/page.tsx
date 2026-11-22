import type { Metadata } from "next";
import { DispatchWorkspace } from "@/components/sales/dispatch-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getDispatchOverview, getDispatchPlan, listDispatches } from "@/lib/workflows/dispatch";
import { listSalesOrders } from "@/lib/workflows/sales";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("dispatch:view");
  const orders = listSalesOrders(user.factoryId).filter((order) =>
    ["approved", "partially_fulfilled"].includes(order.status),
  );
  const packetShortfall = orders.reduce((total, order) => {
    const plan = getDispatchPlan(user.factoryId, order.orderNumber);
    return total + (plan?.lines.reduce((sum, line) => sum + line.backorderPackets, 0) ?? 0);
  }, 0);
  const overview = getDispatchOverview(user.factoryId);

  return (
    <DispatchWorkspace
      initialDispatches={listDispatches(user.factoryId)}
      overview={{
        awaitingDispatch: orders.length,
        inTransit: overview.inTransit,
        delivered: overview.delivered,
        packetShortfall,
      }}
      orders={orders.map((order) => ({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
      }))}
      canManage={user.permissions.includes("dispatch:manage")}
      focus={searchParams.focus}
    />
  );
}
