CREATE TABLE `inventory_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`adjustment_number` text NOT NULL,
	`raw_material_batch_id` integer,
	`packaging_batch_id` integer,
	`finished_good_id` integer,
	`direction` text NOT NULL,
	`base_unit` text NOT NULL,
	`quantity_base` integer NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`unit_cost_numerator` integer,
	`unit_cost_denominator` integer,
	`occurred_at` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`raw_material_batch_id`) REFERENCES `material_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_batch_id`) REFERENCES `packaging_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`finished_good_id`) REFERENCES `finished_goods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "inventory_adjustments_target_check" CHECK(("inventory_adjustments"."raw_material_batch_id" is not null) + ("inventory_adjustments"."packaging_batch_id" is not null) + ("inventory_adjustments"."finished_good_id" is not null) = 1),
	CONSTRAINT "inventory_adjustments_direction_check" CHECK("inventory_adjustments"."direction" in ('increment', 'decrement')),
	CONSTRAINT "inventory_adjustments_base_unit_check" CHECK("inventory_adjustments"."base_unit" in ('grams', 'millilitres', 'pieces')),
	CONSTRAINT "inventory_adjustments_quantity_check" CHECK("inventory_adjustments"."quantity_base" > 0),
	CONSTRAINT "inventory_adjustments_reason_check" CHECK(length("inventory_adjustments"."reason") > 0),
	CONSTRAINT "inventory_adjustments_cost_check" CHECK(("inventory_adjustments"."unit_cost_numerator" is null and "inventory_adjustments"."unit_cost_denominator" is null) or ("inventory_adjustments"."unit_cost_numerator" >= 0 and "inventory_adjustments"."unit_cost_denominator" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_adjustments_factory_number_unique` ON `inventory_adjustments` (`factory_id`,`adjustment_number`);--> statement-breakpoint
CREATE INDEX `inventory_adjustments_factory_idx` ON `inventory_adjustments` (`factory_id`);--> statement-breakpoint
CREATE INDEX `inventory_adjustments_raw_batch_idx` ON `inventory_adjustments` (`raw_material_batch_id`);--> statement-breakpoint
CREATE INDEX `inventory_adjustments_packaging_batch_idx` ON `inventory_adjustments` (`packaging_batch_id`);--> statement-breakpoint
CREATE INDEX `inventory_adjustments_finished_good_idx` ON `inventory_adjustments` (`finished_good_id`);--> statement-breakpoint
CREATE TABLE `packaging_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`packaging_material_id` integer NOT NULL,
	`goods_receipt_item_id` integer,
	`supplier_id` integer,
	`batch_code` text NOT NULL,
	`received_at` text NOT NULL,
	`quantity_units` integer NOT NULL,
	`available_units` integer NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`goods_receipt_item_id`) REFERENCES `goods_receipt_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "packaging_batches_quantity_check" CHECK("packaging_batches"."quantity_units" > 0),
	CONSTRAINT "packaging_batches_available_check" CHECK("packaging_batches"."available_units" >= 0),
	CONSTRAINT "packaging_batches_available_limit_check" CHECK("packaging_batches"."available_units" <= "packaging_batches"."quantity_units")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packaging_batches_factory_code_unique` ON `packaging_batches` (`factory_id`,`batch_code`);--> statement-breakpoint
CREATE INDEX `packaging_batches_factory_idx` ON `packaging_batches` (`factory_id`);--> statement-breakpoint
CREATE INDEX `packaging_batches_material_idx` ON `packaging_batches` (`packaging_material_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`supplier_id` integer NOT NULL,
	`order_number` text NOT NULL,
	`order_date` text NOT NULL,
	`expected_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount_paise` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`approved_by_user_id` integer,
	`approved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "purchase_orders_status_check" CHECK("__new_purchase_orders"."status" in ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_total_check" CHECK("__new_purchase_orders"."total_amount_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_purchase_orders`("id", "factory_id", "supplier_id", "order_number", "order_date", "expected_date", "status", "total_amount_paise", "created_by_user_id", "approved_by_user_id", "approved_at", "created_at", "updated_at") SELECT "id", "factory_id", "supplier_id", "order_number", "order_date", "expected_date", "status", "total_amount_paise", "created_by_user_id", "approved_by_user_id", "approved_at", "created_at", "updated_at" FROM `purchase_orders`;--> statement-breakpoint
DROP TABLE `purchase_orders`;--> statement-breakpoint
ALTER TABLE `__new_purchase_orders` RENAME TO `purchase_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_factory_number_unique` ON `purchase_orders` (`factory_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `purchase_orders_factory_idx` ON `purchase_orders` (`factory_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE TABLE `__new_stock_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`material_batch_id` integer,
	`packaging_batch_id` integer,
	`finished_good_id` integer,
	`transaction_type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`reference_number` text NOT NULL,
	`base_unit` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`balance` integer NOT NULL,
	`quantity_delta_grams` integer DEFAULT 0 NOT NULL,
	`balance_grams` integer DEFAULT 0 NOT NULL,
	`unit_cost_numerator` integer,
	`unit_cost_denominator` integer,
	`occurred_at` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`material_batch_id`) REFERENCES `material_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_batch_id`) REFERENCES `packaging_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`finished_good_id`) REFERENCES `finished_goods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "stock_ledger_source_check" CHECK(("__new_stock_ledger"."material_batch_id" is not null) + ("__new_stock_ledger"."packaging_batch_id" is not null) + ("__new_stock_ledger"."finished_good_id" is not null) = 1),
	CONSTRAINT "stock_ledger_base_unit_check" CHECK("__new_stock_ledger"."base_unit" in ('grams', 'millilitres', 'pieces')),
	CONSTRAINT "stock_ledger_delta_check" CHECK("__new_stock_ledger"."quantity_delta" <> 0),
	CONSTRAINT "stock_ledger_balance_check" CHECK("__new_stock_ledger"."balance" >= 0),
	CONSTRAINT "stock_ledger_cost_check" CHECK(("__new_stock_ledger"."unit_cost_numerator" is null and "__new_stock_ledger"."unit_cost_denominator" is null) or ("__new_stock_ledger"."unit_cost_numerator" >= 0 and "__new_stock_ledger"."unit_cost_denominator" > 0))
);
--> statement-breakpoint
INSERT INTO `__new_stock_ledger`("id", "factory_id", "material_batch_id", "finished_good_id", "transaction_type", "reference_type", "reference_id", "reference_number", "base_unit", "quantity_delta", "balance", "quantity_delta_grams", "balance_grams", "occurred_at", "created_by_user_id", "created_at") SELECT "id", "factory_id", "material_batch_id", "finished_good_id", "transaction_type", "reference_type", "reference_id", "reference_type" || ':' || CAST("reference_id" AS TEXT), 'grams', "quantity_delta_grams", "balance_grams", "quantity_delta_grams", "balance_grams", "occurred_at", "created_by_user_id", "created_at" FROM `stock_ledger`;--> statement-breakpoint
DROP TABLE `stock_ledger`;--> statement-breakpoint
ALTER TABLE `__new_stock_ledger` RENAME TO `stock_ledger`;--> statement-breakpoint
CREATE INDEX `stock_ledger_factory_idx` ON `stock_ledger` (`factory_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_material_batch_idx` ON `stock_ledger` (`material_batch_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_packaging_batch_idx` ON `stock_ledger` (`packaging_batch_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_finished_good_idx` ON `stock_ledger` (`finished_good_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_reference_idx` ON `stock_ledger` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE TABLE `__new_goods_receipt_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goods_receipt_id` integer NOT NULL,
	`raw_material_id` integer,
	`packaging_material_id` integer,
	`quantity_grams` integer,
	`quantity_units` integer,
	`purchase_order_raw_material_id` integer,
	`purchase_order_packaging_material_id` integer,
	`damaged_quantity` integer DEFAULT 0 NOT NULL,
	`rejected_quantity` integer DEFAULT 0 NOT NULL,
	`lot_code` text DEFAULT '' NOT NULL,
	`expires_at` text,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`purchase_order_raw_material_id`) REFERENCES `purchase_order_raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`purchase_order_packaging_material_id`) REFERENCES `purchase_order_packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "goods_receipt_items_material_check" CHECK(("__new_goods_receipt_items"."raw_material_id" is not null) <> ("__new_goods_receipt_items"."packaging_material_id" is not null)),
	CONSTRAINT "goods_receipt_items_order_line_check" CHECK(("__new_goods_receipt_items"."purchase_order_raw_material_id" is not null) <> ("__new_goods_receipt_items"."purchase_order_packaging_material_id" is not null)),
	CONSTRAINT "goods_receipt_items_quantity_check" CHECK(coalesce("__new_goods_receipt_items"."quantity_grams", 0) > 0 or coalesce("__new_goods_receipt_items"."quantity_units", 0) > 0),
	CONSTRAINT "goods_receipt_items_exception_check" CHECK("__new_goods_receipt_items"."damaged_quantity" >= 0 and "__new_goods_receipt_items"."rejected_quantity" >= 0),
	CONSTRAINT "goods_receipt_items_lot_check" CHECK(length("__new_goods_receipt_items"."lot_code") > 0),
	CONSTRAINT "goods_receipt_items_price_check" CHECK("__new_goods_receipt_items"."unit_price_paise" >= 0),
	CONSTRAINT "goods_receipt_items_total_check" CHECK("__new_goods_receipt_items"."line_total_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_goods_receipt_items`("id", "goods_receipt_id", "raw_material_id", "packaging_material_id", "quantity_grams", "quantity_units", "unit_price_paise", "line_total_paise", "created_at", "updated_at") SELECT "id", "goods_receipt_id", "raw_material_id", "packaging_material_id", "quantity_grams", "quantity_units", "unit_price_paise", "line_total_paise", "created_at", "updated_at" FROM `goods_receipt_items`;--> statement-breakpoint
DROP TABLE `goods_receipt_items`;--> statement-breakpoint
ALTER TABLE `__new_goods_receipt_items` RENAME TO `goods_receipt_items`;--> statement-breakpoint
CREATE INDEX `goods_receipt_items_receipt_idx` ON `goods_receipt_items` (`goods_receipt_id`);--> statement-breakpoint
CREATE TABLE `__new_material_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`raw_material_id` integer NOT NULL,
	`goods_receipt_item_id` integer,
	`supplier_id` integer,
	`batch_code` text NOT NULL,
	`received_at` text NOT NULL,
	`quantity_grams` integer NOT NULL,
	`available_grams` integer NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`goods_receipt_item_id`) REFERENCES `goods_receipt_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "material_batches_quantity_check" CHECK("__new_material_batches"."quantity_grams" > 0),
	CONSTRAINT "material_batches_available_check" CHECK("__new_material_batches"."available_grams" >= 0),
	CONSTRAINT "material_batches_available_limit_check" CHECK("__new_material_batches"."available_grams" <= "__new_material_batches"."quantity_grams")
);
--> statement-breakpoint
INSERT INTO `__new_material_batches`("id", "factory_id", "raw_material_id", "goods_receipt_item_id", "supplier_id", "batch_code", "received_at", "quantity_grams", "available_grams", "expires_at", "created_at", "updated_at") SELECT "id", "factory_id", "raw_material_id", "goods_receipt_item_id", "supplier_id", "batch_code", "received_at", "quantity_grams", "available_grams", "expires_at", "created_at", "updated_at" FROM `material_batches`;--> statement-breakpoint
DROP TABLE `material_batches`;--> statement-breakpoint
ALTER TABLE `__new_material_batches` RENAME TO `material_batches`;--> statement-breakpoint
CREATE UNIQUE INDEX `material_batches_factory_code_unique` ON `material_batches` (`factory_id`,`batch_code`);--> statement-breakpoint
CREATE INDEX `material_batches_factory_idx` ON `material_batches` (`factory_id`);--> statement-breakpoint
CREATE INDEX `material_batches_material_idx` ON `material_batches` (`raw_material_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
