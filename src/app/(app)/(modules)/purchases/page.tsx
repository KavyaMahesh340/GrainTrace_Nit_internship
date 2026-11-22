import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PurchasesWorkspace } from "@/components/purchases/purchases-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getDb } from "@/lib/db";
import { packagingMaterials, rawMaterials } from "@/lib/db/schema";
import { listGoodsReceipts, listPurchaseOrders, listSuppliers } from "@/lib/workflows/purchases";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }: { searchParams: { focus?: string } }) {
  const { user } = requirePermission("purchases:view");
  const db = getDb();

  const rawRows = db
    .select({ id: rawMaterials.id, code: rawMaterials.code, name: rawMaterials.name, unit: rawMaterials.unitOfMeasure })
    .from(rawMaterials)
    .where(eq(rawMaterials.factoryId, user.factoryId))
    .all();
  const packagingRows = db
    .select({ id: packagingMaterials.id, code: packagingMaterials.code, name: packagingMaterials.name, unit: packagingMaterials.unitOfMeasure })
    .from(packagingMaterials)
    .where(eq(packagingMaterials.factoryId, user.factoryId))
    .all();

  return (
    <PurchasesWorkspace
      initialOrders={listPurchaseOrders(user.factoryId)}
      initialReceipts={listGoodsReceipts(user.factoryId)}
      suppliers={listSuppliers(user.factoryId)}
      materials={[
        ...rawRows.map((row) => ({ ...row, kind: "raw" as const })),
        ...packagingRows.map((row) => ({ ...row, kind: "packaging" as const })),
      ]}
      canManage={user.permissions.includes("purchases:manage")}
      focus={searchParams.focus}
    />
  );
}
