import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import type { WorkflowActor } from "./context";
import { requireActorPermission } from "./context";
import { recordAudit } from "./audit";
import { WorkflowError } from "./errors";
import type { CustomerInput, CustomerStatusInput } from "./validation";

export type CustomerSummary = {
  id: number;
  code: string;
  name: string;
  customerType: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  creditTermsDays: number;
  creditLimitPaise: number;
  status: string;
};

export function listCustomers(factoryId: number): CustomerSummary[] {
  const rows = getDb()
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      customerType: customers.customerType,
      contactName: customers.contactName,
      email: customers.email,
      phone: customers.phone,
      city: customers.city,
      state: customers.state,
      gstin: customers.gstin,
      creditTermsDays: customers.creditTermsDays,
      creditLimitPaise: customers.creditLimitPaise,
      status: customers.status,
    })
    .from(customers)
    .where(eq(customers.factoryId, factoryId))
    .orderBy(asc(customers.name))
    .all();
  return rows;
}

export function createCustomer(actor: WorkflowActor, input: CustomerInput): CustomerSummary {
  requireActorPermission(actor, "orders:manage");
  return getDb().transaction((tx) => {
    const duplicate = tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.factoryId, actor.factoryId), eq(customers.code, input.code)))
      .get();
    if (duplicate) {
      throw new WorkflowError(`Customer ${input.code} already exists.`, "duplicate_customer", 409);
    }

    const deliveryState = input.deliveryState || input.state;
    const result = tx
      .insert(customers)
      .values({
        factoryId: actor.factoryId,
        code: input.code,
        name: input.name,
        customerType: input.customerType,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        gstin: input.gstin,
        deliveryAddressLine1: input.deliveryAddressLine1,
        deliveryAddressLine2: input.deliveryAddressLine2,
        deliveryCity: input.deliveryCity,
        deliveryState,
        deliveryPostalCode: input.deliveryPostalCode,
        creditTermsDays: input.creditTermsDays,
        creditLimitPaise: input.creditLimitPaise,
        status: "active",
        updatedAt: new Date().toISOString(),
      })
      .run();
    const customerId = Number(result.lastInsertRowid);
    recordAudit(tx, actor, "CUSTOMER_CREATED", "customer", customerId, {
      code: input.code,
      customerType: input.customerType,
    });

    return {
      id: customerId,
      code: input.code,
      name: input.name,
      customerType: input.customerType,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      city: input.city,
      state: input.state,
      gstin: input.gstin,
      creditTermsDays: input.creditTermsDays,
      creditLimitPaise: input.creditLimitPaise,
      status: "active",
    };
  });
}

export function updateCustomerStatus(actor: WorkflowActor, customerId: number, status: CustomerStatusInput) {
  requireActorPermission(actor, "orders:manage");
  return getDb().transaction((tx) => {
    const customer = tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.factoryId, actor.factoryId)))
      .get();
    if (!customer) {
      throw new WorkflowError("Customer not found.", "not_found", 404);
    }
    tx.update(customers)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(customers.id, customerId))
      .run();
    recordAudit(tx, actor, "CUSTOMER_STATUS_CHANGED", "customer", customerId, {
      code: customer.code,
      status,
    });
    return { id: customerId, status };
  });
}
