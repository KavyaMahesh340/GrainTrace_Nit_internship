import type { Metadata } from "next";
import { ProductionWorkspace } from "@/components/production/production-workspace";
import { requirePermission } from "@/lib/auth/access";
import {
  getProductionOptions,
  getProductionOverview,
  listProductionRuns,
} from "@/lib/workflows/production";

export const metadata: Metadata = { title: "Production" };

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: { exception?: string; focus?: string };
}) {
  const { user } = requirePermission("production:view");

  return (
    <ProductionWorkspace
      initialRuns={listProductionRuns(user.factoryId)}
      initialOverview={getProductionOverview(user.factoryId)}
      options={getProductionOptions(user.factoryId)}
      canManage={user.permissions.includes("production:manage")}
      focus={searchParams.focus ?? searchParams.exception}
    />
  );
}
