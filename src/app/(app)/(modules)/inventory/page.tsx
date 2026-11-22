import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { requirePermission } from "@/lib/auth/access";
import { getDb } from "@/lib/db";
import {
  finishedGoods,
  materialBatches,
  packagingBatches,
  packagingMaterials,
  products,
  rawMaterials,
} from "@/lib/db/schema";
import {
  getInventoryOverview,
  listInventory,
  listInventoryAdjustments,
} from "@/lib/workflows/inventory";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { user } = requirePermission("inventory:view");
  const db = getDb();

  const rawBatches = db
    .select({
      id: materialBatches.id,
      batchCode: materialBatches.batchCode,
      name: rawMaterials.name,
    })
    .from(materialBatches)
    .innerJoin(rawMaterials, eq(materialBatches.rawMaterialId, rawMaterials.id))
    .where(eq(materialBatches.factoryId, user.factoryId))
    .all();
  const packagingBatchRows = db
    .select({
      id: packagingBatches.id,
      batchCode: packagingBatches.batchCode,
      name: packagingMaterials.name,
    })
    .from(packagingBatches)
    .innerJoin(packagingMaterials, eq(packagingBatches.packagingMaterialId, packagingMaterials.id))
    .where(eq(packagingBatches.factoryId, user.factoryId))
    .all();
  const finishedRows = db
    .select({
      id: finishedGoods.id,
      batchCode: finishedGoods.batchCode,
      name: products.name,
    })
    .from(finishedGoods)
    .innerJoin(products, eq(finishedGoods.productId, products.id))
    .where(eq(finishedGoods.factoryId, user.factoryId))
    .all();

  return (
    <InventoryWorkspace
      initialItems={listInventory(user.factoryId, { category: "raw" })}
      initialOverview={getInventoryOverview(user.factoryId)}
      initialAdjustments={listInventoryAdjustments(user.factoryId)}
      options={[
        ...rawBatches.map((row) => ({
          key: `raw:${row.id}`,
          targetType: "raw" as const,
          targetId: row.id,
          label: `${row.batchCode} · ${row.name}`,
          baseUnit: "grams" as const,
        })),
        ...packagingBatchRows.map((row) => ({
          key: `packaging:${row.id}`,
          targetType: "packaging" as const,
          targetId: row.id,
          label: `${row.batchCode} · ${row.name}`,
          baseUnit: "pieces" as const,
        })),
        ...finishedRows.map((row) => ({
          key: `finished_good:${row.id}`,
          targetType: "finished_good" as const,
          targetId: row.id,
          label: `${row.batchCode} · ${row.name}`,
          baseUnit: "pieces" as const,
        })),
      ]}
      canManage={user.permissions.includes("inventory:manage")}
    />
  );
}
