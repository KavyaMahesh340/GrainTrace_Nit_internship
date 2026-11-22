import { z } from "zod";
import { SALES_REFERENCE_SETTING, getSetting, setSetting } from "./queue";

export const salesReferenceOptionSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  name: z.string(),
  customerType: z.string().optional(),
  state: z.string().optional(),
  creditTermsDays: z.number().int().nonnegative().optional(),
  packetGrams: z.number().int().positive().optional(),
  hsnCode: z.string().optional(),
  status: z.string().optional(),
});

export const salesReferenceCacheSchema = z.object({
  savedAt: z.string().min(1),
  customers: z.array(salesReferenceOptionSchema),
  products: z.array(salesReferenceOptionSchema),
});

export type SalesReferenceOption = z.infer<typeof salesReferenceOptionSchema>;
export type SalesReferenceCache = z.infer<typeof salesReferenceCacheSchema>;

export async function getSalesReferenceCache(): Promise<SalesReferenceCache | null> {
  const value = await getSetting<unknown>(SALES_REFERENCE_SETTING);
  const result = salesReferenceCacheSchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function saveSalesReferenceCache(cache: SalesReferenceCache): Promise<void> {
  await setSetting(SALES_REFERENCE_SETTING, salesReferenceCacheSchema.parse(cache));
}

export function toSalesReferenceCache(options: {
  customers: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
}): SalesReferenceCache {
  return salesReferenceCacheSchema.parse({
    savedAt: new Date().toISOString(),
    customers: options.customers.map((customer) => ({
      id: Number(customer.id),
      code: String(customer.code ?? ""),
      name: String(customer.name ?? ""),
      customerType: String(customer.customerType ?? ""),
      state: String(customer.state ?? ""),
      creditTermsDays: Number(customer.creditTermsDays ?? 0),
      status: String(customer.status ?? ""),
    })),
    products: options.products.map((product) => ({
      id: Number(product.id),
      code: String(product.code ?? ""),
      name: String(product.name ?? ""),
      packetGrams: Number(product.packetGrams ?? 0),
      hsnCode: String(product.hsnCode ?? ""),
    })),
  });
}
