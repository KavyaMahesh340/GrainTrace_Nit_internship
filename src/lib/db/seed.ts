import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo-accounts";
import { DEMO_PASSWORD_HASHES } from "@/lib/auth/demo-hashes";
import { ROLE_LABELS, type RoleName } from "@/lib/auth/permissions";
import { getDb } from "./index";
import {
  auditLog,
  customers,
  factories,
  packagingMaterials,
  products,
  rawMaterials,
  recipeIngredients,
  recipePackaging,
  recipes,
  roles,
  suppliers,
  users,
} from "./schema";

const FACTORY_CODE = "GT-MAIN";
const SEED_TIME = "2026-01-01T00:00:00.000Z";

const roleSeeds: { name: RoleName; description: string }[] = [
  { name: "owner", description: "Full operational and administrative authority." },
  { name: "admin", description: "Manages users and day-to-day operations." },
  { name: "salesman", description: "Creates and tracks customer orders." },
  { name: "production", description: "Manages recipes, inventory, and production runs." },
  { name: "accountant", description: "Manages invoices, collections, and audit review." },
];

const fullNames: Record<RoleName, string> = {
  owner: "Aarav Mehta",
  admin: "Ira Sharma",
  salesman: "Vikram Rao",
  production: "Meera Nair",
  accountant: "Kabir Shah",
};

export function seedDatabase() {
  const db = getDb();
  migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });

  db.transaction((tx) => {
    let factory = tx.select().from(factories).where(eq(factories.code, FACTORY_CODE)).get();
    if (!factory) {
      tx.insert(factories)
        .values({
          code: FACTORY_CODE,
          name: "GrainTrace Demo Factory",
          timezone: "Asia/Kolkata",
          createdAt: SEED_TIME,
          updatedAt: SEED_TIME,
        })
        .run();
      factory = tx.select().from(factories).where(eq(factories.code, FACTORY_CODE)).get();
    }

    if (!factory) {
      throw new Error("Unable to create the demo factory.");
    }

    const factoryId = factory.id;
    const roleIds = {} as Record<RoleName, number>;

    for (const roleSeed of roleSeeds) {
      let role = tx.select().from(roles).where(eq(roles.name, roleSeed.name)).get();
      if (!role) {
        tx.insert(roles)
          .values({
            name: roleSeed.name,
            label: ROLE_LABELS[roleSeed.name],
            description: roleSeed.description,
            createdAt: SEED_TIME,
            updatedAt: SEED_TIME,
          })
          .run();
        role = tx.select().from(roles).where(eq(roles.name, roleSeed.name)).get();
      }
      if (!role) {
        throw new Error(`Unable to create the ${roleSeed.name} role.`);
      }
      roleIds[roleSeed.name] = role.id;
    }

    for (const account of DEMO_ACCOUNTS) {
      const existing = tx.select().from(users).where(eq(users.email, account.email)).get();
      const values = {
        factoryId,
        roleId: roleIds[account.role],
        email: account.email,
        fullName: fullNames[account.role],
        passwordHash: DEMO_PASSWORD_HASHES[account.role],
        status: "active",
        updatedAt: SEED_TIME,
      };

      if (existing) {
        tx.update(users).set(values).where(eq(users.id, existing.id)).run();
      } else {
        tx.insert(users).values({ ...values, createdAt: SEED_TIME }).run();
      }
    }

    const customerCode = "CUST-DEMO-01";
    const existingCustomer = tx
      .select()
      .from(customers)
      .where(and(eq(customers.factoryId, factoryId), eq(customers.code, customerCode)))
      .get();
    if (!existingCustomer) {
      tx.insert(customers)
        .values({
          factoryId,
          code: customerCode,
          name: "Demonstration Foods",
          contactName: "Rohan Verma",
          email: "orders@demonstration.local",
          phone: "+91 90000 00001",
          city: "Pune",
          state: "Maharashtra",
          postalCode: "411001",
          createdAt: SEED_TIME,
          updatedAt: SEED_TIME,
        })
        .run();
    }

    const supplierCode = "SUPP-DEMO-01";
    const existingSupplier = tx
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.factoryId, factoryId), eq(suppliers.code, supplierCode)))
      .get();
    if (!existingSupplier) {
      tx.insert(suppliers)
        .values({
          factoryId,
          code: supplierCode,
          name: "Demonstration Grains",
          contactName: "Anita Desai",
          email: "supply@demonstration.local",
          phone: "+91 90000 00002",
          city: "Indore",
          state: "Madhya Pradesh",
          postalCode: "452001",
          createdAt: SEED_TIME,
          updatedAt: SEED_TIME,
        })
        .run();
    }

    const productCode = "PROD-500";
    let product = tx
      .select()
      .from(products)
      .where(and(eq(products.factoryId, factoryId), eq(products.code, productCode)))
      .get();
    if (!product) {
      tx.insert(products)
        .values({
          factoryId,
          code: productCode,
          name: "Signature Atta 500 g",
          description: "Demonstration whole wheat atta packet.",
          packetGrams: 500,
          hsnCode: "110100",
          createdAt: SEED_TIME,
          updatedAt: SEED_TIME,
        })
        .run();
      product = tx
        .select()
        .from(products)
        .where(and(eq(products.factoryId, factoryId), eq(products.code, productCode)))
        .get();
    }

    const rawMaterialSeeds = [
      { code: "RM-WHEAT", name: "Whole wheat grain", reorderLevelGrams: 50000 },
      { code: "RM-SALT", name: "Iodised salt", reorderLevelGrams: 5000 },
    ];

    const rawMaterialIds = {} as Record<string, number>;
    for (const seed of rawMaterialSeeds) {
      let material = tx
        .select()
        .from(rawMaterials)
        .where(and(eq(rawMaterials.factoryId, factoryId), eq(rawMaterials.code, seed.code)))
        .get();
      if (!material) {
        tx.insert(rawMaterials)
          .values({
            factoryId,
            code: seed.code,
            name: seed.name,
            unitOfMeasure: "g",
            reorderLevelGrams: seed.reorderLevelGrams,
            createdAt: SEED_TIME,
            updatedAt: SEED_TIME,
          })
          .run();
        material = tx
          .select()
          .from(rawMaterials)
          .where(and(eq(rawMaterials.factoryId, factoryId), eq(rawMaterials.code, seed.code)))
          .get();
      }
      if (!material) {
        throw new Error(`Unable to create ${seed.code}.`);
      }
      rawMaterialIds[seed.code] = material.id;
    }

    const packagingCode = "PKG-POUCH-500";
    let packaging = tx
      .select()
      .from(packagingMaterials)
      .where(and(eq(packagingMaterials.factoryId, factoryId), eq(packagingMaterials.code, packagingCode)))
      .get();
    if (!packaging) {
      tx.insert(packagingMaterials)
        .values({
          factoryId,
          code: packagingCode,
          name: "500 g laminated pouch",
          unitOfMeasure: "pcs",
          reorderLevelUnits: 2000,
          createdAt: SEED_TIME,
          updatedAt: SEED_TIME,
        })
        .run();
      packaging = tx
        .select()
        .from(packagingMaterials)
        .where(and(eq(packagingMaterials.factoryId, factoryId), eq(packagingMaterials.code, packagingCode)))
        .get();
    }

    if (product && packaging) {
      const recipeCode = "RECIPE-ATTA-500";
      let recipe = tx
        .select()
        .from(recipes)
        .where(
          and(
            eq(recipes.factoryId, factoryId),
            eq(recipes.code, recipeCode),
            eq(recipes.version, 1),
          ),
        )
        .get();
      if (!recipe) {
        tx.insert(recipes)
          .values({
            factoryId,
            productId: product.id,
            code: recipeCode,
            name: "Signature Atta 500 g — baseline",
            version: 1,
            expectedYieldGrams: 100000,
            status: "active",
            createdAt: SEED_TIME,
            updatedAt: SEED_TIME,
          })
          .run();
        recipe = tx
          .select()
          .from(recipes)
          .where(
            and(
              eq(recipes.factoryId, factoryId),
              eq(recipes.code, recipeCode),
              eq(recipes.version, 1),
            ),
          )
          .get();
      }

      if (recipe) {
        for (const seed of [
          { code: "RM-WHEAT", quantityGrams: 99000, tolerancePercent: 1 },
          { code: "RM-SALT", quantityGrams: 1000, tolerancePercent: 1 },
        ]) {
          const rawMaterialId = rawMaterialIds[seed.code];
          const existing = tx
            .select()
            .from(recipeIngredients)
            .where(
              and(
                eq(recipeIngredients.recipeId, recipe.id),
                eq(recipeIngredients.rawMaterialId, rawMaterialId),
              ),
            )
            .get();
          if (!existing) {
            tx.insert(recipeIngredients)
              .values({
                recipeId: recipe.id,
                rawMaterialId,
                quantityGrams: seed.quantityGrams,
                tolerancePercent: seed.tolerancePercent,
                createdAt: SEED_TIME,
                updatedAt: SEED_TIME,
              })
              .run();
          }
        }

        const existingPackaging = tx
          .select()
          .from(recipePackaging)
          .where(
            and(
              eq(recipePackaging.recipeId, recipe.id),
              eq(recipePackaging.packagingMaterialId, packaging.id),
            ),
          )
          .get();
        if (!existingPackaging) {
          tx.insert(recipePackaging)
            .values({
              recipeId: recipe.id,
              packagingMaterialId: packaging.id,
              quantityUnits: 200,
              createdAt: SEED_TIME,
              updatedAt: SEED_TIME,
            })
            .run();
        }
      }
    }

    const existingAudit = tx
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "system.seed"), eq(auditLog.entityType, "system")))
      .get();
    if (!existingAudit) {
      tx.insert(auditLog)
        .values({
          factoryId,
          actorEmail: "system@graintrace.local",
          action: "system.seed",
          entityType: "system",
          entityId: 1,
          severity: "info",
          metadataJson: '{"source":"seed"}',
          createdAt: SEED_TIME,
        })
        .run();
    }
  });
}
