import { z } from "zod";

export const OFFLINE_CHANGE_EVENT = "graintrace:offline-change";

const DATABASE_NAME = "graintrace-offline";
const DATABASE_VERSION = 2;
const MUTATION_STORE = "mutation_queue";
const SETTINGS_STORE = "settings";
export const LAST_SYNC_SETTING = "lastSuccessfulSync";
export const SALES_REFERENCE_SETTING = "salesReferenceOptions";

export const offlineOrderStateSchema = z.enum(["draft", "queued", "syncing", "synced", "failed"]);

export const offlineOrderPayloadSchema = z.object({
  orderNumber: z.string().trim().min(2).max(64),
  customerId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  quantityPackets: z.string().trim().min(1),
  unitPrice: z.string().trim().min(1),
  discount: z.string().trim().default("0"),
  orderDate: z.string().trim().min(1),
  requestedDate: z.string().trim().default(""),
  notes: z.string().trim().max(500).default(""),
});

export const offlineOrderRecordSchema = z.object({
  id: z.string().min(1),
  type: z.literal("sales-order"),
  state: offlineOrderStateSchema,
  idempotencyKey: z.string().min(8),
  orderNumber: z.string().min(2),
  payload: offlineOrderPayloadSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  attempts: z.number().int().nonnegative(),
  lastAttemptAt: z.string().nullable(),
  lastError: z.string().nullable(),
  serverOrderId: z.number().int().positive().nullable(),
});

export type OfflineOrderState = z.infer<typeof offlineOrderStateSchema>;
export type OfflineOrderPayload = z.infer<typeof offlineOrderPayloadSchema>;
export type OfflineOrderPayloadInput = z.input<typeof offlineOrderPayloadSchema>;
export type OfflineOrderRecord = z.infer<typeof offlineOrderRecordSchema>;
export type OfflineQueueSummary = {
  total: number;
  drafts: number;
  pending: number;
  failed: number;
  synced: number;
  lastSuccessfulSync: string | null;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The offline database request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("The offline database transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("The offline database transaction failed."));
  });
}

export function notifyOfflineChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OFFLINE_CHANGE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(OFFLINE_CHANGE_EVENT);
    channel.postMessage("changed");
    channel.close();
  }
}

export function subscribeToOfflineChanges(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener();
  window.addEventListener(OFFLINE_CHANGE_EVENT, handler);
  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(OFFLINE_CHANGE_EVENT);
    channel.onmessage = handler;
  }
  return () => {
    window.removeEventListener(OFFLINE_CHANGE_EVENT, handler);
    if (channel) {
      channel.onmessage = null;
      channel.close();
    }
  };
}

function normalizeLegacyRecord(raw: unknown): OfflineOrderRecord {
  const source = asRecord(raw);
  let parsed: Record<string, unknown> = {};
  if (typeof source.payload === "string") {
    try {
      parsed = asRecord(JSON.parse(source.payload));
    } catch {
      parsed = {};
    }
  } else {
    parsed = asRecord(source.payload);
  }
  const draft = asRecord(parsed.draft);
  const values = { ...parsed, ...draft };
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = asText(values[key]);
      if (value) return value;
    }
    return "";
  };
  const id = asText(source.id) || `legacy-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const payloadResult = offlineOrderPayloadSchema.safeParse({
    orderNumber: pick("orderNumber", "salesOrderNumber") || `LEGACY-${id.slice(0, 8)}`,
    customerId: pick("customerId") || "0",
    productId: pick("productId") || "0",
    quantityPackets: pick("quantityPackets", "quantity") || "0",
    unitPrice: pick("unitPrice", "unitPricePaise") || "0",
    discount: pick("discount", "discountPaise") || "0",
    orderDate: pick("orderDate") || now.slice(0, 10),
    requestedDate: pick("requestedDate"),
    notes: pick("notes"),
  });
  const payload = payloadResult.success
    ? payloadResult.data
    : offlineOrderPayloadSchema.parse({
        orderNumber: `LEGACY-${id.slice(0, 8)}`,
        customerId: "0",
        productId: "0",
        quantityPackets: "0",
        unitPricePaise: "0",
        orderDate: now.slice(0, 10),
      });
  const legacyState = asText(source.state) ||
    (asText(source.status) === "failed" ? "failed" : asText(parsed.action) === "submit" ? "queued" : "draft");
  const stateResult = offlineOrderStateSchema.safeParse(legacyState);
  const serverOrderId = typeof source.serverOrderId === "number" ? source.serverOrderId : null;
  return offlineOrderRecordSchema.parse({
    id,
    type: "sales-order",
    state: stateResult.success ? stateResult.data : "failed",
    idempotencyKey: asText(source.idempotencyKey) || `legacy-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`,
    orderNumber: payload.orderNumber,
    payload,
    createdAt: asText(source.createdAt) || now,
    updatedAt: asText(source.updatedAt) || now,
    attempts: asCount(source.attempts),
    lastAttemptAt: typeof source.lastAttemptAt === "string" ? source.lastAttemptAt : null,
    lastError: typeof source.lastError === "string" ? source.lastError : "Imported from the legacy offline queue.",
    serverOrderId: serverOrderId && serverOrderId > 0 ? serverOrderId : null,
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      const versionChange = event as IDBVersionChangeEvent;
      const mutationStore = db.objectStoreNames.contains(MUTATION_STORE)
        ? transaction?.objectStore(MUTATION_STORE)
        : db.createObjectStore(MUTATION_STORE, { keyPath: "id" });
      if (mutationStore) {
        if (!mutationStore.indexNames.contains("idempotencyKey")) {
          mutationStore.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
        }
        if (!mutationStore.indexNames.contains("state")) {
          mutationStore.createIndex("state", "state");
        }
        if (!mutationStore.indexNames.contains("createdAt")) {
          mutationStore.createIndex("createdAt", "createdAt");
        }
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
      if (!transaction || versionChange.oldVersion >= DATABASE_VERSION) return;
      const store = transaction.objectStore(MUTATION_STORE);
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const migrated = normalizeLegacyRecord(cursor.value);
        cursor.update(migrated);
        cursor.continue();
      };
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open the offline database."));
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}

async function withMutationStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  const transaction = db.transaction(MUTATION_STORE, mode);
  const request = run(transaction.objectStore(MUTATION_STORE));
  const [result] = await Promise.all([requestResult(request), transactionDone(transaction)]);
  return result;
}

async function withSettingsStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  const transaction = db.transaction(SETTINGS_STORE, mode);
  const request = run(transaction.objectStore(SETTINGS_STORE));
  const [result] = await Promise.all([requestResult(request), transactionDone(transaction)]);
  return result;
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const value = await withSettingsStore("readonly", (store) => store.get(key));
  return value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await withSettingsStore("readwrite", (store) => store.put(value, key));
  notifyOfflineChange();
}

export async function listOfflineOrders(): Promise<OfflineOrderRecord[]> {
  const records = await withMutationStore<unknown[]>("readonly", (store) => store.getAll());
  return records
    .map((record) => offlineOrderRecordSchema.parse(record))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getOfflineOrder(id: string): Promise<OfflineOrderRecord | null> {
  const record = await withMutationStore<unknown | undefined>("readonly", (store) => store.get(id));
  return record ? offlineOrderRecordSchema.parse(record) : null;
}

async function putOfflineOrder(record: OfflineOrderRecord): Promise<OfflineOrderRecord> {
  const parsed = offlineOrderRecordSchema.parse(record);
  await withMutationStore("readwrite", (store) => store.put(parsed));
  notifyOfflineChange();
  return parsed;
}

export function createIdempotencyKey() {
  return `so-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export async function saveOfflineOrder(
  input: OfflineOrderPayloadInput,
  options: { idempotencyKey?: string; state?: "draft" | "queued" } = {},
): Promise<OfflineOrderRecord> {
  const payload = offlineOrderPayloadSchema.parse(input);
  const id = options.idempotencyKey ?? createIdempotencyKey();
  const state = options.state ?? "draft";
  const existing = await getOfflineOrder(id);
  if (existing?.state === "synced") {
    throw new Error("This order has already synchronized and cannot be edited locally.");
  }
  if (existing?.state === "syncing") {
    throw new Error("This order is syncing. Wait for the result before editing it.");
  }
  const now = new Date().toISOString();
  return putOfflineOrder({
    id,
    type: "sales-order",
    state,
    idempotencyKey: id,
    orderNumber: payload.orderNumber,
    payload,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    attempts: existing?.attempts ?? 0,
    lastAttemptAt: existing?.lastAttemptAt ?? null,
    lastError: state === "draft" || state === "queued" ? null : existing?.lastError ?? null,
    serverOrderId: existing?.serverOrderId ?? null,
  });
}

export async function queueOfflineOrder(id: string): Promise<OfflineOrderRecord> {
  const existing = await getOfflineOrder(id);
  if (!existing) throw new Error("Offline order not found.");
  if (existing.state === "synced") throw new Error("This order has already synchronized.");
  if (existing.state === "syncing") throw new Error("This order is already syncing.");
  return putOfflineOrder({
    ...existing,
    state: "queued",
    lastError: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function markOfflineOrderSyncing(id: string): Promise<OfflineOrderRecord> {
  const existing = await getOfflineOrder(id);
  if (!existing) throw new Error("Offline order not found.");
  if (existing.state !== "queued" && existing.state !== "failed") {
    throw new Error("Only queued or failed orders can be synchronized.");
  }
  const now = new Date().toISOString();
  return putOfflineOrder({
    ...existing,
    state: "syncing",
    attempts: existing.attempts + 1,
    lastAttemptAt: now,
    lastError: null,
    updatedAt: now,
  });
}

export async function markOfflineOrderFailed(id: string, error: string): Promise<OfflineOrderRecord> {
  const existing = await getOfflineOrder(id);
  if (!existing) throw new Error("Offline order not found.");
  return putOfflineOrder({
    ...existing,
    state: "failed",
    lastError: error.slice(0, 500),
    updatedAt: new Date().toISOString(),
  });
}

export async function markOfflineOrderSynced(id: string, serverOrderId: number | null): Promise<OfflineOrderRecord> {
  const existing = await getOfflineOrder(id);
  if (!existing) throw new Error("Offline order not found.");
  return putOfflineOrder({
    ...existing,
    state: "synced",
    serverOrderId,
    lastError: null,
    updatedAt: new Date().toISOString(),
  });
}

export async function resetStaleSyncingOrders(thresholdMs = 120_000): Promise<number> {
  const records = await listOfflineOrders();
  const cutoff = Date.now() - thresholdMs;
  let reset = 0;
  for (const record of records) {
    if (record.state !== "syncing") continue;
    const attemptedAt = record.lastAttemptAt ? Date.parse(record.lastAttemptAt) : Number.NaN;
    if (!Number.isNaN(attemptedAt) && attemptedAt > cutoff) continue;
    await putOfflineOrder({
      ...record,
      state: "failed",
      lastError: "Synchronization was interrupted. Retry this order when ready.",
      updatedAt: new Date().toISOString(),
    });
    reset += 1;
  }
  return reset;
}

export async function removeOfflineOrder(id: string): Promise<void> {
  await withMutationStore("readwrite", (store) => store.delete(id));
  notifyOfflineChange();
}

export async function getOfflineQueueSummary(): Promise<OfflineQueueSummary> {
  const records = await listOfflineOrders();
  const lastSuccessfulSync = await getSetting<string>(LAST_SYNC_SETTING);
  return {
    total: records.length,
    drafts: records.filter((record) => record.state === "draft").length,
    pending: records.filter((record) => record.state === "queued" || record.state === "syncing").length,
    failed: records.filter((record) => record.state === "failed").length,
    synced: records.filter((record) => record.state === "synced").length,
    lastSuccessfulSync: lastSuccessfulSync ?? null,
  };
}

export async function setLastSuccessfulSync(timestamp: string) {
  await setSetting(LAST_SYNC_SETTING, timestamp);
}

export async function closeOfflineDatabase() {
  if (!databasePromise) return;
  const db = await databasePromise.catch(() => null);
  db?.close();
  databasePromise = null;
}

export async function deleteOfflineDatabase() {
  await closeOfflineDatabase();
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to clear the offline database."));
    request.onblocked = () => reject(new Error("Close other GRAINTRACE tabs before clearing offline data."));
  });
}
