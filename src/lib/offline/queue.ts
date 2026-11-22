import { z } from "zod";

const DATABASE_NAME = "graintrace-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "mutation_queue";
const QUEUE_EVENT = "graintrace:queue-changed";

export const offlineMutationSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.string().min(1),
  createdAt: z.string().min(1),
  status: z.enum(["queued", "syncing", "failed"]).default("queued"),
});

export type OfflineMutation = z.infer<typeof offlineMutationSchema>;
export type OfflineMutationInput = z.input<typeof offlineMutationSchema>;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("status", "status");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline queue"));
    request.onblocked = () => reject(new Error("Offline queue upgrade is blocked"));
  });

  return databasePromise;
}

function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  }
}

export function subscribeToQueueChanges(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(QUEUE_EVENT, listener);
  return () => window.removeEventListener(QUEUE_EVENT, listener);
}

export async function enqueueMutation(input: OfflineMutationInput) {
  const mutation = offlineMutationSchema.parse(input);
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(mutation);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to enqueue mutation"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Queue write aborted"));
  });

  notifyQueueChanged();
  return mutation;
}

export async function listMutations() {
  const database = await openDatabase();

  return new Promise<OfflineMutation[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.map((item) => offlineMutationSchema.parse(item)));
    request.onerror = () => reject(request.error ?? new Error("Unable to read offline queue"));
  });
}

export async function getQueueCount() {
  const database = await openDatabase();

  return new Promise<number>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to count offline queue"));
  });
}

export async function removeMutation(id: string) {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to remove mutation"));
  });

  notifyQueueChanged();
}
