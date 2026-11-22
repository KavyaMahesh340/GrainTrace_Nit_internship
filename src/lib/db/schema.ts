import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
};

export const factories = sqliteTable("factories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  ...timestamps,
});

export const roles = sqliteTable(
  "roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    ...timestamps,
  },
  (table) => [
    check("roles_name_check", sql`${table.name} in ('owner', 'admin', 'salesman', 'production', 'accountant')`),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status").notNull().default("active"),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_factory_idx").on(table.factoryId),
    index("users_role_idx").on(table.roleId),
    check("users_status_check", sql`${table.status} in ('active', 'suspended')`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    gstin: text("gstin"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customers_factory_code_unique").on(table.factoryId, table.code),
    index("customers_factory_idx").on(table.factoryId),
  ],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    addressLine1: text("address_line1"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    gstin: text("gstin"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("suppliers_factory_code_unique").on(table.factoryId, table.code),
    index("suppliers_factory_idx").on(table.factoryId),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    packetGrams: integer("packet_grams").notNull(),
    hsnCode: text("hsn_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_factory_code_unique").on(table.factoryId, table.code),
    index("products_factory_idx").on(table.factoryId),
    check("products_packet_grams_check", sql`${table.packetGrams} > 0`),
  ],
);

export const rawMaterials = sqliteTable(
  "raw_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    unitOfMeasure: text("unit_of_measure").notNull().default("g"),
    reorderLevelGrams: integer("reorder_level_grams").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("raw_materials_factory_code_unique").on(table.factoryId, table.code),
    index("raw_materials_factory_idx").on(table.factoryId),
    check("raw_materials_reorder_check", sql`${table.reorderLevelGrams} >= 0`),
  ],
);

export const packagingMaterials = sqliteTable(
  "packaging_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    unitOfMeasure: text("unit_of_measure").notNull().default("pcs"),
    reorderLevelUnits: integer("reorder_level_units").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("packaging_materials_factory_code_unique").on(table.factoryId, table.code),
    index("packaging_materials_factory_idx").on(table.factoryId),
    check("packaging_materials_reorder_check", sql`${table.reorderLevelUnits} >= 0`),
  ],
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    expectedYieldGrams: integer("expected_yield_grams").notNull(),
    status: text("status").notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recipes_factory_code_version_unique").on(table.factoryId, table.code, table.version),
    index("recipes_factory_idx").on(table.factoryId),
    index("recipes_product_idx").on(table.productId),
    check("recipes_version_check", sql`${table.version} > 0`),
    check("recipes_yield_check", sql`${table.expectedYieldGrams} > 0`),
    check("recipes_status_check", sql`${table.status} in ('draft', 'active', 'archived')`),
  ],
);

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    rawMaterialId: integer("raw_material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    quantityGrams: integer("quantity_grams").notNull(),
    tolerancePercent: integer("tolerance_percent").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recipe_ingredients_unique").on(table.recipeId, table.rawMaterialId),
    index("recipe_ingredients_recipe_idx").on(table.recipeId),
    check("recipe_ingredients_quantity_check", sql`${table.quantityGrams} > 0`),
    check("recipe_ingredients_tolerance_check", sql`${table.tolerancePercent} >= 0`),
  ],
);

export const recipePackaging = sqliteTable(
  "recipe_packaging",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    packagingMaterialId: integer("packaging_material_id")
      .notNull()
      .references(() => packagingMaterials.id, { onDelete: "restrict" }),
    quantityUnits: integer("quantity_units").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("recipe_packaging_unique").on(table.recipeId, table.packagingMaterialId),
    index("recipe_packaging_recipe_idx").on(table.recipeId),
    check("recipe_packaging_quantity_check", sql`${table.quantityUnits} > 0`),
  ],
);

export const salesOrders = sqliteTable(
  "sales_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull(),
    orderDate: text("order_date").notNull(),
    status: text("status").notNull().default("draft"),
    totalAmountPaise: integer("total_amount_paise").notNull().default(0),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: integer("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: text("approved_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sales_orders_factory_number_unique").on(table.factoryId, table.orderNumber),
    index("sales_orders_factory_idx").on(table.factoryId),
    index("sales_orders_customer_idx").on(table.customerId),
    index("sales_orders_status_idx").on(table.status),
    check("sales_orders_status_check", sql`${table.status} in ('draft', 'confirmed', 'approved', 'rejected', 'fulfilled', 'cancelled')`),
    check("sales_orders_total_check", sql`${table.totalAmountPaise} >= 0`),
  ],
);

export const salesOrderItems = sqliteTable(
  "sales_order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    salesOrderId: integer("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantityPackets: integer("quantity_packets").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    index("sales_order_items_order_idx").on(table.salesOrderId),
    check("sales_order_items_quantity_check", sql`${table.quantityPackets} > 0`),
    check("sales_order_items_price_check", sql`${table.unitPricePaise} >= 0`),
    check("sales_order_items_total_check", sql`${table.lineTotalPaise} >= 0`),
  ],
);

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull(),
    orderDate: text("order_date").notNull(),
    expectedDate: text("expected_date"),
    status: text("status").notNull().default("draft"),
    totalAmountPaise: integer("total_amount_paise").notNull().default(0),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: integer("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: text("approved_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("purchase_orders_factory_number_unique").on(table.factoryId, table.orderNumber),
    index("purchase_orders_factory_idx").on(table.factoryId),
    index("purchase_orders_supplier_idx").on(table.supplierId),
    index("purchase_orders_status_idx").on(table.status),
    check(
      "purchase_orders_status_check",
      sql`${table.status} in ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled')`,
    ),
    check("purchase_orders_total_check", sql`${table.totalAmountPaise} >= 0`),
  ],
);

export const purchaseOrderRawMaterials = sqliteTable(
  "purchase_order_raw_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    rawMaterialId: integer("raw_material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    quantityGrams: integer("quantity_grams").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    index("purchase_order_raw_materials_order_idx").on(table.purchaseOrderId),
    check("purchase_order_raw_materials_quantity_check", sql`${table.quantityGrams} > 0`),
    check("purchase_order_raw_materials_price_check", sql`${table.unitPricePaise} >= 0`),
    check("purchase_order_raw_materials_total_check", sql`${table.lineTotalPaise} >= 0`),
  ],
);

export const purchaseOrderPackagingMaterials = sqliteTable(
  "purchase_order_packaging_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    packagingMaterialId: integer("packaging_material_id")
      .notNull()
      .references(() => packagingMaterials.id, { onDelete: "restrict" }),
    quantityUnits: integer("quantity_units").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    index("purchase_order_packaging_order_idx").on(table.purchaseOrderId),
    check("purchase_order_packaging_quantity_check", sql`${table.quantityUnits} > 0`),
    check("purchase_order_packaging_price_check", sql`${table.unitPricePaise} >= 0`),
    check("purchase_order_packaging_total_check", sql`${table.lineTotalPaise} >= 0`),
  ],
);

export const goodsReceipts = sqliteTable(
  "goods_receipts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    receiptNumber: text("receipt_number").notNull(),
    receivedAt: text("received_at").notNull(),
    receivedByUserId: integer("received_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("goods_receipts_factory_number_unique").on(table.factoryId, table.receiptNumber),
    index("goods_receipts_factory_idx").on(table.factoryId),
    index("goods_receipts_order_idx").on(table.purchaseOrderId),
  ],
);

export const goodsReceiptItems = sqliteTable(
  "goods_receipt_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    goodsReceiptId: integer("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id, { onDelete: "cascade" }),
    rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id, {
      onDelete: "restrict",
    }),
    packagingMaterialId: integer("packaging_material_id").references(() => packagingMaterials.id, {
      onDelete: "restrict",
    }),
    quantityGrams: integer("quantity_grams"),
    quantityUnits: integer("quantity_units"),
    purchaseOrderRawMaterialId: integer("purchase_order_raw_material_id").references(
      () => purchaseOrderRawMaterials.id,
      { onDelete: "restrict" },
    ),
    purchaseOrderPackagingMaterialId: integer("purchase_order_packaging_material_id").references(
      () => purchaseOrderPackagingMaterials.id,
      { onDelete: "restrict" },
    ),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    rejectedQuantity: integer("rejected_quantity").notNull().default(0),
    lotCode: text("lot_code").notNull().default(""),
    expiresAt: text("expires_at"),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    ...timestamps,
  },
  (table) => [
    index("goods_receipt_items_receipt_idx").on(table.goodsReceiptId),
    check("goods_receipt_items_material_check", sql`(${table.rawMaterialId} is not null) <> (${table.packagingMaterialId} is not null)`),
    check("goods_receipt_items_order_line_check", sql`(${table.purchaseOrderRawMaterialId} is not null) <> (${table.purchaseOrderPackagingMaterialId} is not null)`),
    check("goods_receipt_items_quantity_check", sql`coalesce(${table.quantityGrams}, 0) > 0 or coalesce(${table.quantityUnits}, 0) > 0`),
    check("goods_receipt_items_exception_check", sql`${table.damagedQuantity} >= 0 and ${table.rejectedQuantity} >= 0`),
    check("goods_receipt_items_lot_check", sql`length(${table.lotCode}) > 0`),
    check("goods_receipt_items_price_check", sql`${table.unitPricePaise} >= 0`),
    check("goods_receipt_items_total_check", sql`${table.lineTotalPaise} >= 0`),
  ],
);

export const materialBatches = sqliteTable(
  "material_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    rawMaterialId: integer("raw_material_id")
      .notNull()
      .references(() => rawMaterials.id, { onDelete: "restrict" }),
    goodsReceiptItemId: integer("goods_receipt_item_id").references(() => goodsReceiptItems.id, {
      onDelete: "set null",
    }),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    batchCode: text("batch_code").notNull(),
    receivedAt: text("received_at").notNull(),
    quantityGrams: integer("quantity_grams").notNull(),
    availableGrams: integer("available_grams").notNull(),
    expiresAt: text("expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("material_batches_factory_code_unique").on(table.factoryId, table.batchCode),
    index("material_batches_factory_idx").on(table.factoryId),
    index("material_batches_material_idx").on(table.rawMaterialId),
    check("material_batches_quantity_check", sql`${table.quantityGrams} > 0`),
    check("material_batches_available_check", sql`${table.availableGrams} >= 0`),
    check("material_batches_available_limit_check", sql`${table.availableGrams} <= ${table.quantityGrams}`),
  ],
);

export const packagingBatches = sqliteTable(
  "packaging_batches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    packagingMaterialId: integer("packaging_material_id")
      .notNull()
      .references(() => packagingMaterials.id, { onDelete: "restrict" }),
    goodsReceiptItemId: integer("goods_receipt_item_id").references(() => goodsReceiptItems.id, {
      onDelete: "set null",
    }),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    batchCode: text("batch_code").notNull(),
    receivedAt: text("received_at").notNull(),
    quantityUnits: integer("quantity_units").notNull(),
    availableUnits: integer("available_units").notNull(),
    expiresAt: text("expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("packaging_batches_factory_code_unique").on(table.factoryId, table.batchCode),
    index("packaging_batches_factory_idx").on(table.factoryId),
    index("packaging_batches_material_idx").on(table.packagingMaterialId),
    check("packaging_batches_quantity_check", sql`${table.quantityUnits} > 0`),
    check("packaging_batches_available_check", sql`${table.availableUnits} >= 0`),
    check("packaging_batches_available_limit_check", sql`${table.availableUnits} <= ${table.quantityUnits}`),
  ],
);

export const productionRuns = sqliteTable(
  "production_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "restrict" }),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id, {
      onDelete: "set null",
    }),
    runNumber: text("run_number").notNull(),
    plannedOutputGrams: integer("planned_output_grams").notNull(),
    actualOutputGrams: integer("actual_output_grams").notNull().default(0),
    actualOutputPackets: integer("actual_output_packets").notNull().default(0),
    damagedOutputPackets: integer("damaged_output_packets").notNull().default(0),
    labourPaise: integer("labour_paise").notNull().default(0),
    gasPaise: integer("gas_paise").notNull().default(0),
    sellingPricePaise: integer("selling_price_paise"),
    status: text("status").notNull().default("draft"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    postedAt: text("posted_at"),
    notes: text("notes").notNull().default(""),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("production_runs_factory_number_unique").on(table.factoryId, table.runNumber),
    index("production_runs_factory_idx").on(table.factoryId),
    index("production_runs_recipe_idx").on(table.recipeId),
    index("production_runs_status_idx").on(table.status),
    check("production_runs_planned_check", sql`${table.plannedOutputGrams} > 0`),
    check("production_runs_actual_check", sql`${table.actualOutputGrams} >= 0`),
    check("production_runs_packets_check", sql`${table.actualOutputPackets} >= 0 and ${table.damagedOutputPackets} >= 0`),
    check("production_runs_cost_check", sql`${table.labourPaise} >= 0 and ${table.gasPaise} >= 0`),
    check(
      "production_runs_status_check",
      sql`${table.status} in ('draft', 'planned', 'in_progress', 'completed', 'posted')`,
    ),
  ],
);

export const productionRunInputs = sqliteTable(
  "production_run_inputs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productionRunId: integer("production_run_id")
      .notNull()
      .references(() => productionRuns.id, { onDelete: "cascade" }),
    materialBatchId: integer("material_batch_id")
      .notNull()
      .references(() => materialBatches.id, { onDelete: "restrict" }),
    quantityGrams: integer("quantity_grams").notNull(),
    recordedAt: text("recorded_at").notNull(),
    recordedByUserId: integer("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    index("production_run_inputs_run_idx").on(table.productionRunId),
    index("production_run_inputs_batch_idx").on(table.materialBatchId),
    check("production_run_inputs_quantity_check", sql`${table.quantityGrams} > 0`),
  ],
);

export const productionRunMaterials = sqliteTable(
  "production_run_materials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    productionRunId: integer("production_run_id")
      .notNull()
      .references(() => productionRuns.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    itemId: text("item_id").notNull(),
    baseUnit: text("base_unit").notNull(),
    rawMaterialId: integer("raw_material_id").references(() => rawMaterials.id, {
      onDelete: "restrict",
    }),
    packagingMaterialId: integer("packaging_material_id").references(() => packagingMaterials.id, {
      onDelete: "restrict",
    }),
    materialBatchId: integer("material_batch_id").references(() => materialBatches.id, {
      onDelete: "restrict",
    }),
    packagingBatchId: integer("packaging_batch_id").references(() => packagingBatches.id, {
      onDelete: "restrict",
    }),
    plannedQuantity: integer("planned_quantity").notNull(),
    actualQuantity: integer("actual_quantity").notNull().default(0),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    unitCostNumerator: integer("unit_cost_numerator"),
    unitCostDenominator: integer("unit_cost_denominator"),
    recordedAt: text("recorded_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("production_run_materials_run_item_unique").on(table.productionRunId, table.itemId),
    index("production_run_materials_run_idx").on(table.productionRunId),
    index("production_run_materials_batch_idx").on(table.materialBatchId),
    index("production_run_materials_packaging_batch_idx").on(table.packagingBatchId),
    check("production_run_materials_target_check", sql`${table.targetType} in ('raw', 'packaging')`),
    check("production_run_materials_unit_check", sql`${table.baseUnit} in ('grams', 'pieces')`),
    check(
      "production_run_materials_material_check",
      sql`(${table.rawMaterialId} is not null) <> (${table.packagingMaterialId} is not null)`,
    ),
    check(
      "production_run_materials_batch_check",
      sql`not (${table.materialBatchId} is not null and ${table.packagingBatchId} is not null)`,
    ),
    check("production_run_materials_planned_check", sql`${table.plannedQuantity} > 0`),
    check(
      "production_run_materials_actual_check",
      sql`${table.actualQuantity} >= 0 and ${table.damagedQuantity} >= 0`,
    ),
    check(
      "production_run_materials_cost_check",
      sql`(${table.unitCostNumerator} is null and ${table.unitCostDenominator} is null) or (${table.unitCostNumerator} >= 0 and ${table.unitCostDenominator} > 0)`,
    ),
  ],
);

export const productionCostSnapshots = sqliteTable(
  "production_cost_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    productionRunId: integer("production_run_id")
      .notNull()
      .references(() => productionRuns.id, { onDelete: "restrict" }),
    snapshotId: text("snapshot_id").notNull(),
    runNumber: text("run_number").notNull(),
    postedAt: text("posted_at").notNull(),
    goodOutputPackets: integer("good_output_packets").notNull(),
    materialCostPaise: integer("material_cost_paise").notNull(),
    labourPaise: integer("labour_paise").notNull(),
    gasPaise: integer("gas_paise").notNull(),
    overheadPaise: integer("overhead_paise").notNull(),
    totalRunCostPaise: integer("total_run_cost_paise").notNull(),
    costPerGoodPacketPaise: integer("cost_per_good_packet_paise").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("production_cost_snapshots_factory_snapshot_unique").on(
      table.factoryId,
      table.snapshotId,
    ),
    uniqueIndex("production_cost_snapshots_run_unique").on(table.productionRunId),
    index("production_cost_snapshots_factory_idx").on(table.factoryId),
    check("production_cost_snapshots_output_check", sql`${table.goodOutputPackets} > 0`),
    check(
      "production_cost_snapshots_amount_check",
      sql`${table.materialCostPaise} >= 0 and ${table.labourPaise} >= 0 and ${table.gasPaise} >= 0 and ${table.overheadPaise} >= 0 and ${table.totalRunCostPaise} >= 0 and ${table.costPerGoodPacketPaise} >= 0`,
    ),
  ],
);

export const finishedGoods = sqliteTable(
  "finished_goods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productionRunId: integer("production_run_id")
      .notNull()
      .references(() => productionRuns.id, { onDelete: "restrict" }),
    batchCode: text("batch_code").notNull(),
    quantityGrams: integer("quantity_grams").notNull(),
    availableGrams: integer("available_grams").notNull(),
    packedOn: text("packed_on").notNull(),
    expiresOn: text("expires_on"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("finished_goods_factory_code_unique").on(table.factoryId, table.batchCode),
    index("finished_goods_factory_idx").on(table.factoryId),
    index("finished_goods_product_idx").on(table.productId),
    check("finished_goods_quantity_check", sql`${table.quantityGrams} > 0`),
    check("finished_goods_available_check", sql`${table.availableGrams} >= 0`),
  ],
);

export const finishedGoodPackets = sqliteTable(
  "finished_good_packets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    finishedGoodId: integer("finished_good_id")
      .notNull()
      .references(() => finishedGoods.id, { onDelete: "cascade" }),
    packetCode: text("packet_code").notNull(),
    quantityGrams: integer("quantity_grams").notNull(),
    status: text("status").notNull().default("available"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("finished_good_packets_factory_code_unique").on(table.factoryId, table.packetCode),
    index("finished_good_packets_finished_good_idx").on(table.finishedGoodId),
    check("finished_good_packets_quantity_check", sql`${table.quantityGrams} > 0`),
    check("finished_good_packets_status_check", sql`${table.status} in ('available', 'reserved', 'dispatched', 'sold')`),
  ],
);

export const inventoryAdjustments = sqliteTable(
  "inventory_adjustments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    adjustmentNumber: text("adjustment_number").notNull(),
    rawMaterialBatchId: integer("raw_material_batch_id").references(() => materialBatches.id, {
      onDelete: "restrict",
    }),
    packagingBatchId: integer("packaging_batch_id").references(() => packagingBatches.id, {
      onDelete: "restrict",
    }),
    finishedGoodId: integer("finished_good_id").references(() => finishedGoods.id, {
      onDelete: "restrict",
    }),
    direction: text("direction").notNull(),
    baseUnit: text("base_unit").notNull(),
    quantityBase: integer("quantity_base").notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    unitCostNumerator: integer("unit_cost_numerator"),
    unitCostDenominator: integer("unit_cost_denominator"),
    occurredAt: text("occurred_at").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_adjustments_factory_number_unique").on(table.factoryId, table.adjustmentNumber),
    index("inventory_adjustments_factory_idx").on(table.factoryId),
    index("inventory_adjustments_raw_batch_idx").on(table.rawMaterialBatchId),
    index("inventory_adjustments_packaging_batch_idx").on(table.packagingBatchId),
    index("inventory_adjustments_finished_good_idx").on(table.finishedGoodId),
    check(
      "inventory_adjustments_target_check",
      sql`(${table.rawMaterialBatchId} is not null) + (${table.packagingBatchId} is not null) + (${table.finishedGoodId} is not null) = 1`,
    ),
    check("inventory_adjustments_direction_check", sql`${table.direction} in ('increment', 'decrement')`),
    check("inventory_adjustments_base_unit_check", sql`${table.baseUnit} in ('grams', 'millilitres', 'pieces')`),
    check("inventory_adjustments_quantity_check", sql`${table.quantityBase} > 0`),
    check("inventory_adjustments_reason_check", sql`length(${table.reason}) > 0`),
    check(
      "inventory_adjustments_cost_check",
      sql`(${table.unitCostNumerator} is null and ${table.unitCostDenominator} is null) or (${table.unitCostNumerator} >= 0 and ${table.unitCostDenominator} > 0)`,
    ),
  ],
);

export const stockLedger = sqliteTable(
  "stock_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    materialBatchId: integer("material_batch_id").references(() => materialBatches.id, {
      onDelete: "restrict",
    }),
    packagingBatchId: integer("packaging_batch_id").references(() => packagingBatches.id, {
      onDelete: "restrict",
    }),
    finishedGoodId: integer("finished_good_id").references(() => finishedGoods.id, {
      onDelete: "restrict",
    }),
    transactionType: text("transaction_type").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: integer("reference_id").notNull(),
    referenceNumber: text("reference_number").notNull(),
    baseUnit: text("base_unit").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    balance: integer("balance").notNull(),
    quantityDeltaGrams: integer("quantity_delta_grams").notNull().default(0),
    balanceGrams: integer("balance_grams").notNull().default(0),
    unitCostNumerator: integer("unit_cost_numerator"),
    unitCostDenominator: integer("unit_cost_denominator"),
    occurredAt: text("occurred_at").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("stock_ledger_factory_idx").on(table.factoryId),
    index("stock_ledger_material_batch_idx").on(table.materialBatchId),
    index("stock_ledger_packaging_batch_idx").on(table.packagingBatchId),
    index("stock_ledger_finished_good_idx").on(table.finishedGoodId),
    index("stock_ledger_reference_idx").on(table.referenceType, table.referenceId),
    check(
      "stock_ledger_source_check",
      sql`(${table.materialBatchId} is not null) + (${table.packagingBatchId} is not null) + (${table.finishedGoodId} is not null) = 1`,
    ),
    check("stock_ledger_base_unit_check", sql`${table.baseUnit} in ('grams', 'millilitres', 'pieces')`),
    check("stock_ledger_delta_check", sql`${table.quantityDelta} <> 0`),
    check("stock_ledger_balance_check", sql`${table.balance} >= 0`),
    check(
      "stock_ledger_cost_check",
      sql`(${table.unitCostNumerator} is null and ${table.unitCostDenominator} is null) or (${table.unitCostNumerator} >= 0 and ${table.unitCostDenominator} > 0)`,
    ),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    salesOrderId: integer("sales_order_id")
      .notNull()
      .references(() => salesOrders.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: text("invoice_date").notNull(),
    dueDate: text("due_date").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    taxPaise: integer("tax_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    amountPaidPaise: integer("amount_paid_paise").notNull().default(0),
    status: text("status").notNull().default("draft"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_factory_number_unique").on(table.factoryId, table.invoiceNumber),
    index("invoices_factory_idx").on(table.factoryId),
    index("invoices_order_idx").on(table.salesOrderId),
    index("invoices_customer_idx").on(table.customerId),
    index("invoices_status_idx").on(table.status),
    check("invoices_amounts_check", sql`${table.subtotalPaise} >= 0 and ${table.taxPaise} >= 0 and ${table.totalPaise} >= 0 and ${table.amountPaidPaise} >= 0`),
    check("invoices_status_check", sql`${table.status} in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')`),
  ],
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantityPackets: integer("quantity_packets").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    taxPaise: integer("tax_paise").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("invoice_items_invoice_idx").on(table.invoiceId),
    check("invoice_items_quantity_check", sql`${table.quantityPackets} > 0`),
    check("invoice_items_amounts_check", sql`${table.unitPricePaise} >= 0 and ${table.lineTotalPaise} >= 0 and ${table.taxPaise} >= 0`),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    paymentNumber: text("payment_number").notNull(),
    paidAt: text("paid_at").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    method: text("method").notNull(),
    referenceNo: text("reference_no"),
    recordedByUserId: integer("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_factory_number_unique").on(table.factoryId, table.paymentNumber),
    index("payments_factory_idx").on(table.factoryId),
    index("payments_invoice_idx").on(table.invoiceId),
    index("payments_customer_idx").on(table.customerId),
    check("payments_amount_check", sql`${table.amountPaise} > 0`),
    check("payments_method_check", sql`${table.method} in ('cash', 'upi', 'bank_transfer', 'cheque', 'other')`),
  ],
);

export const dispatches = sqliteTable(
  "dispatches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id")
      .notNull()
      .references(() => factories.id, { onDelete: "restrict" }),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id, {
      onDelete: "set null",
    }),
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    dispatchNumber: text("dispatch_number").notNull(),
    dispatchedAt: text("dispatched_at").notNull(),
    status: text("status").notNull().default("planned"),
    carrierName: text("carrier_name"),
    trackingNumber: text("tracking_number"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("dispatches_factory_number_unique").on(table.factoryId, table.dispatchNumber),
    index("dispatches_factory_idx").on(table.factoryId),
    index("dispatches_order_idx").on(table.salesOrderId),
    index("dispatches_invoice_idx").on(table.invoiceId),
    index("dispatches_status_idx").on(table.status),
    check("dispatches_status_check", sql`${table.status} in ('planned', 'in_transit', 'delivered', 'cancelled')`),
  ],
);

export const dispatchItems = sqliteTable(
  "dispatch_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dispatchId: integer("dispatch_id")
      .notNull()
      .references(() => dispatches.id, { onDelete: "cascade" }),
    finishedGoodPacketId: integer("finished_good_packet_id")
      .notNull()
      .references(() => finishedGoodPackets.id, { onDelete: "restrict" }),
    quantityPackets: integer("quantity_packets").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("dispatch_items_dispatch_idx").on(table.dispatchId),
    index("dispatch_items_packet_idx").on(table.finishedGoodPacketId),
    check("dispatch_items_quantity_check", sql`${table.quantityPackets} > 0`),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    factoryId: integer("factory_id").references(() => factories.id, { onDelete: "restrict" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    severity: text("severity").notNull().default("info"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("audit_log_factory_idx").on(table.factoryId),
    index("audit_log_user_idx").on(table.userId),
    index("audit_log_entity_idx").on(table.entityType, table.entityId),
    index("audit_log_created_idx").on(table.createdAt),
    check("audit_log_severity_check", sql`${table.severity} in ('info', 'warning', 'critical')`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Session = typeof sessions.$inferSelect;
