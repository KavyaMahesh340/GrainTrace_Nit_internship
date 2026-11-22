import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeOfflineDatabase,
  deleteOfflineDatabase,
  getOfflineQueueSummary,
  listOfflineOrders,
  markOfflineOrderFailed,
  markOfflineOrderSynced,
  markOfflineOrderSyncing,
  queueOfflineOrder,
  resetStaleSyncingOrders,
  saveOfflineOrder,
  setLastSuccessfulSync,
} from "@/lib/offline/queue";

const payload = {
  orderNumber: "SO-OFFLINE-001",
  customerId: "1",
  productId: "1",
  quantityPackets: "2",
  unitPrice: "150.00",
  discount: "5.00",
  orderDate: "2026-11-22",
  requestedDate: "",
  notes: "Offline queue test",
};

describe("offline order queue", () => {
  beforeEach(async () => {
    await deleteOfflineDatabase();
  });

  afterEach(async () => {
    await deleteOfflineDatabase();
  });

  it("saves drafts, queues them, and reports a durable summary", async () => {
    const draft = await saveOfflineOrder(payload, { state: "draft" });
    expect(draft.state).toBe("draft");
    expect(draft.idempotencyKey).toBe(draft.id);
    expect(draft.payload.notes).toBe("Offline queue test");

    await queueOfflineOrder(draft.id);
    await setLastSuccessfulSync("2026-11-22T10:00:00.000Z");

    const records = await listOfflineOrders();
    const summary = await getOfflineQueueSummary();
    expect(records).toHaveLength(1);
    expect(records[0]?.state).toBe("queued");
    expect(summary.pending).toBe(1);
    expect(summary.drafts).toBe(0);
    expect(summary.lastSuccessfulSync).toBe("2026-11-22T10:00:00.000Z");
  });

  it("persists across database reconnects", async () => {
    const record = await saveOfflineOrder(payload, { state: "queued" });
    await closeOfflineDatabase();

    const records = await listOfflineOrders();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe(record.id);
    expect(records[0]?.state).toBe("queued");
  });

  it("tracks retry attempts, failures, and successful sync", async () => {
    const record = await saveOfflineOrder(payload, { state: "queued" });
    const syncing = await markOfflineOrderSyncing(record.id);
    const failed = await markOfflineOrderFailed(record.id, "Server unavailable");
    const requeued = await queueOfflineOrder(record.id);
    const synced = await markOfflineOrderSynced(record.id, 4821);

    expect(syncing.state).toBe("syncing");
    expect(syncing.attempts).toBe(1);
    expect(failed.state).toBe("failed");
    expect(failed.lastError).toBe("Server unavailable");
    expect(requeued.state).toBe("queued");
    expect(requeued.lastError).toBeNull();
    expect(synced.state).toBe("synced");
    expect(synced.serverOrderId).toBe(4821);
    expect((await getOfflineQueueSummary()).synced).toBe(1);
  });

  it("recovers stale syncing records", async () => {
    const record = await saveOfflineOrder(payload, { state: "queued" });
    await markOfflineOrderSyncing(record.id);

    expect(await resetStaleSyncingOrders(-1)).toBe(1);
    const records = await listOfflineOrders();
    expect(records[0]?.state).toBe("failed");
    expect(records[0]?.lastError).toMatch(/interrupted/i);
  });

  it("rejects invalid payloads", async () => {
    await expect(saveOfflineOrder({ ...payload, orderNumber: "" })).rejects.toThrow();
  });

  it("migrates legacy v1 queue records without dropping them", async () => {
    await closeOfflineDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("graintrace-offline", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("mutation_queue")) {
          db.createObjectStore("mutation_queue", { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("mutation_queue", "readwrite");
        transaction.objectStore("mutation_queue").put({
          id: "legacy-1",
          type: "sales-order-draft",
          payload: JSON.stringify({ action: "submit", draft: payload }),
          createdAt: "2026-11-20T10:00:00.000Z",
          status: "queued",
        });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

    const records = await listOfflineOrders();
    expect(records).toHaveLength(1);
    expect(records[0]?.state).toBe("queued");
    expect(records[0]?.orderNumber).toBe(payload.orderNumber);
    expect(records[0]?.idempotencyKey).toBe("legacy-legacy-1");
    expect(records[0]?.payload.unitPrice).toBe("150.00");

    const indexAvailable = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open("graintrace-offline", 2);
      request.onsuccess = () => {
        const db = request.result;
        resolve(db.transaction("mutation_queue").objectStore("mutation_queue").indexNames.contains("idempotencyKey"));
        db.close();
      };
      request.onerror = () => reject(request.error);
    });
    expect(indexAvailable).toBe(true);
  });
});
