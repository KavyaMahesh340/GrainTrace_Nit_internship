import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { permissionsFor, type RoleName } from "@/lib/auth/permissions";
import { customers, products, salesOrders, users } from "@/lib/db/schema";
import { deleteOfflineDatabase, getOfflineOrder, saveOfflineOrder } from "@/lib/offline/queue";
import { syncQueuedOrders } from "@/lib/offline/sync";
import type { WorkflowActor } from "@/lib/workflows/context";
import { syncSalesOrder } from "@/lib/workflows/sales";
import type { OfflineOrderSyncInput } from "@/lib/workflows/validation";
import { prepareDatabase } from "./database";

const db = prepareDatabase();

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function actorFor(email: string, role: RoleName): WorkflowActor {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) throw new Error(`Missing seeded user ${email}.`);
  return {
    userId: user.id,
    factoryId: user.factoryId,
    email: user.email,
    role,
    permissions: permissionsFor(role),
  };
}

function seededIds(actor: WorkflowActor) {
  const customer = db
    .select()
    .from(customers)
    .where(and(eq(customers.factoryId, actor.factoryId), eq(customers.code, "CUST-DEMO-01")))
    .get();
  const product = db
    .select()
    .from(products)
    .where(and(eq(products.factoryId, actor.factoryId), eq(products.code, "PROD-500")))
    .get();
  if (!customer || !product) throw new Error("Seeded sales references are missing.");
  return { customerId: customer.id, productId: product.id };
}

function fakeFetch(body: unknown, ok = true) {
  return (async () => ({ ok, status: ok ? 201 : 409, json: async () => body }) as Response) as typeof fetch;
}

describe("offline order synchronization", () => {
  beforeEach(async () => {
    await deleteOfflineDatabase();
  });

  afterEach(async () => {
    await deleteOfflineDatabase();
  });

  it("submits an idempotent order exactly once", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const { customerId, productId } = seededIds(owner);
    const id = suffix();
    const input: OfflineOrderSyncInput = {
      idempotencyKey: `offline-${id.toLowerCase()}`,
      order: {
        orderNumber: `SO-OFF-${id}`,
        customerId,
        orderDate: "2026-11-22",
        notes: "Idempotent offline test",
        lines: [{ productId, quantityPackets: 2, unitPricePaise: 15_000, discountPaise: 500 }],
      },
    };

    const first = syncSalesOrder(owner, input);
    const second = syncSalesOrder(owner, input);
    const rows = db
      .select()
      .from(salesOrders)
      .where(and(eq(salesOrders.factoryId, owner.factoryId), eq(salesOrders.orderNumber, input.order.orderNumber)))
      .all();

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("submitted");
    expect(rows[0]?.idempotencyKey).toBe(input.idempotencyKey);
  });

  it("rejects reuse of an idempotency key for another order", () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const { customerId, productId } = seededIds(owner);
    const id = suffix();
    const base: OfflineOrderSyncInput = {
      idempotencyKey: `offline-conflict-${id.toLowerCase()}`,
      order: {
        orderNumber: `SO-CONFLICT-${id}`,
        customerId,
        orderDate: "2026-11-22",
        notes: "Idempotency conflict test",
        lines: [{ productId, quantityPackets: 1, unitPricePaise: 15_000, discountPaise: 0 }],
      },
    };
    syncSalesOrder(owner, base);

    try {
      syncSalesOrder(owner, {
        ...base,
        order: { ...base.order, orderNumber: `SO-CONFLICT-OTHER-${id}` },
      });
      throw new Error("Expected an idempotency conflict.");
    } catch (error) {
      expect(error).toMatchObject({ code: "idempotency_conflict" });
    }
  });

  it("converts local queue payloads to validated server input", async () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const { customerId, productId } = seededIds(owner);
    const id = suffix();
    const record = await saveOfflineOrder(
      {
        orderNumber: `SO-SYNC-${id}`,
        customerId: String(customerId),
        productId: String(productId),
        quantityPackets: "2",
        unitPrice: "150.00",
        discount: "5.00",
        orderDate: "2026-11-22",
        requestedDate: "",
        notes: "Sync conversion test",
      },
      { state: "queued" },
    );
    let sentBody: unknown = null;
    const fetcher = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return { ok: true, status: 201, json: async () => ({ ok: true, result: { replayed: false, order: { id: 9001 } } }) } as Response;
    }) as typeof fetch;

    const result = await syncQueuedOrders(fetcher);
    const synced = await getOfflineOrder(record.id);
    const body = sentBody as { idempotencyKey: string; order: { lines: Array<{ unitPricePaise: number; discountPaise: number }> } };

    expect(result.synced).toBe(1);
    expect(body.idempotencyKey).toBe(record.idempotencyKey);
    expect(body.order.lines[0]?.unitPricePaise).toBe(15_000);
    expect(body.order.lines[0]?.discountPaise).toBe(500);
    expect(synced?.state).toBe("synced");
    expect(synced?.serverOrderId).toBe(9001);
  });

  it("keeps failed records available for retry", async () => {
    const owner = actorFor("owner@graintrace.local", "owner");
    const { customerId, productId } = seededIds(owner);
    const id = suffix();
    const record = await saveOfflineOrder(
      {
        orderNumber: `SO-FAIL-${id}`,
        customerId: String(customerId),
        productId: String(productId),
        quantityPackets: "1",
        unitPrice: "150.00",
        orderDate: "2026-11-22",
      },
      { state: "queued" },
    );

    const result = await syncQueuedOrders(fakeFetch({ ok: false, error: "Permission denied" }, false));
    const failed = await getOfflineOrder(record.id);

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("Permission denied");
    expect(failed?.state).toBe("failed");
    expect(failed?.lastError).toBe("Permission denied");
  });
});
