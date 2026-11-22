import { parseAmount } from "@/components/sales/sales-shared";
import { offlineOrderSyncSchema, salesOrderInputSchema } from "@/lib/workflows/validation";
import {
  listOfflineOrders,
  markOfflineOrderFailed,
  markOfflineOrderSynced,
  markOfflineOrderSyncing,
  resetStaleSyncingOrders,
  setLastSuccessfulSync,
  type OfflineOrderRecord,
} from "./queue";

export type OfflineSyncResult = {
  attempted: number;
  synced: number;
  replayed: number;
  failed: number;
  errors: string[];
};

type SyncResponse = {
  ok?: boolean;
  error?: string;
  result?: {
    replayed?: boolean;
    order?: { id?: number };
  };
};

function buildSyncBody(record: OfflineOrderRecord) {
  const order = salesOrderInputSchema.parse({
    orderNumber: record.payload.orderNumber,
    customerId: Number(record.payload.customerId),
    orderDate: record.payload.orderDate,
    requestedDate: record.payload.requestedDate || undefined,
    notes: record.payload.notes,
    lines: [
      {
        productId: Number(record.payload.productId),
        quantityPackets: Number(record.payload.quantityPackets),
        unitPricePaise: parseAmount(record.payload.unitPrice),
        discountPaise: parseAmount(record.payload.discount),
      },
    ],
  });
  return offlineOrderSyncSchema.parse({ idempotencyKey: record.idempotencyKey, order });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The order could not be synchronized.";
}

async function fetchWithTimeout(fetcher: typeof fetch, input: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function syncQueuedOrders(fetcher: typeof fetch = fetch): Promise<OfflineSyncResult> {
  await resetStaleSyncingOrders();
  const records = (await listOfflineOrders()).filter((record) => record.state === "queued");
  const result: OfflineSyncResult = { attempted: records.length, synced: 0, replayed: 0, failed: 0, errors: [] };

  for (const record of records) {
    try {
      await markOfflineOrderSyncing(record.id);
      const response = await fetchWithTimeout(fetcher, "/api/sales/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSyncBody(record)),
      });
      const data = (await response.json().catch(() => ({}))) as SyncResponse;
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "The server could not accept this order.");
      }
      const serverOrderId = typeof data.result?.order?.id === "number" ? data.result.order.id : null;
      await markOfflineOrderSynced(record.id, serverOrderId);
      if (data.result?.replayed) result.replayed += 1;
      result.synced += 1;
    } catch (error) {
      const message = errorMessage(error);
      await markOfflineOrderFailed(record.id, message);
      result.failed += 1;
      result.errors.push(`${record.orderNumber}: ${message}`);
    }
  }

  if (result.synced > 0) {
    await setLastSuccessfulSync(new Date().toISOString());
  }
  return result;
}
