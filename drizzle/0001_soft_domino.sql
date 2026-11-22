CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer,
	`user_id` integer,
	`session_id` integer,
	`actor_email` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`severity` text DEFAULT 'info' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "audit_log_severity_check" CHECK("audit_log"."severity" in ('info', 'warning', 'critical'))
);
--> statement-breakpoint
CREATE INDEX `audit_log_factory_idx` ON `audit_log` (`factory_id`);--> statement-breakpoint
CREATE INDEX `audit_log_user_idx` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address_line1` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`gstin` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_factory_code_unique` ON `customers` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `customers_factory_idx` ON `customers` (`factory_id`);--> statement-breakpoint
CREATE TABLE `dispatch_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dispatch_id` integer NOT NULL,
	`finished_good_packet_id` integer NOT NULL,
	`quantity_packets` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`dispatch_id`) REFERENCES `dispatches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`finished_good_packet_id`) REFERENCES `finished_good_packets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "dispatch_items_quantity_check" CHECK("dispatch_items"."quantity_packets" > 0)
);
--> statement-breakpoint
CREATE INDEX `dispatch_items_dispatch_idx` ON `dispatch_items` (`dispatch_id`);--> statement-breakpoint
CREATE INDEX `dispatch_items_packet_idx` ON `dispatch_items` (`finished_good_packet_id`);--> statement-breakpoint
CREATE TABLE `dispatches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`sales_order_id` integer,
	`invoice_id` integer,
	`customer_id` integer NOT NULL,
	`dispatch_number` text NOT NULL,
	`dispatched_at` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`carrier_name` text,
	`tracking_number` text,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "dispatches_status_check" CHECK("dispatches"."status" in ('planned', 'in_transit', 'delivered', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dispatches_factory_number_unique` ON `dispatches` (`factory_id`,`dispatch_number`);--> statement-breakpoint
CREATE INDEX `dispatches_factory_idx` ON `dispatches` (`factory_id`);--> statement-breakpoint
CREATE INDEX `dispatches_order_idx` ON `dispatches` (`sales_order_id`);--> statement-breakpoint
CREATE INDEX `dispatches_invoice_idx` ON `dispatches` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `dispatches_status_idx` ON `dispatches` (`status`);--> statement-breakpoint
CREATE TABLE `finished_good_packets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`finished_good_id` integer NOT NULL,
	`packet_code` text NOT NULL,
	`quantity_grams` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`finished_good_id`) REFERENCES `finished_goods`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "finished_good_packets_quantity_check" CHECK("finished_good_packets"."quantity_grams" > 0),
	CONSTRAINT "finished_good_packets_status_check" CHECK("finished_good_packets"."status" in ('available', 'reserved', 'dispatched', 'sold'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finished_good_packets_factory_code_unique` ON `finished_good_packets` (`factory_id`,`packet_code`);--> statement-breakpoint
CREATE INDEX `finished_good_packets_finished_good_idx` ON `finished_good_packets` (`finished_good_id`);--> statement-breakpoint
CREATE TABLE `finished_goods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`production_run_id` integer NOT NULL,
	`batch_code` text NOT NULL,
	`quantity_grams` integer NOT NULL,
	`available_grams` integer NOT NULL,
	`packed_on` text NOT NULL,
	`expires_on` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`production_run_id`) REFERENCES `production_runs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "finished_goods_quantity_check" CHECK("finished_goods"."quantity_grams" > 0),
	CONSTRAINT "finished_goods_available_check" CHECK("finished_goods"."available_grams" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `finished_goods_factory_code_unique` ON `finished_goods` (`factory_id`,`batch_code`);--> statement-breakpoint
CREATE INDEX `finished_goods_factory_idx` ON `finished_goods` (`factory_id`);--> statement-breakpoint
CREATE INDEX `finished_goods_product_idx` ON `finished_goods` (`product_id`);--> statement-breakpoint
CREATE TABLE `goods_receipt_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goods_receipt_id` integer NOT NULL,
	`raw_material_id` integer,
	`packaging_material_id` integer,
	`quantity_grams` integer,
	`quantity_units` integer,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "goods_receipt_items_material_check" CHECK(("goods_receipt_items"."raw_material_id" is not null) <> ("goods_receipt_items"."packaging_material_id" is not null)),
	CONSTRAINT "goods_receipt_items_quantity_check" CHECK(coalesce("goods_receipt_items"."quantity_grams", 0) > 0 or coalesce("goods_receipt_items"."quantity_units", 0) > 0),
	CONSTRAINT "goods_receipt_items_price_check" CHECK("goods_receipt_items"."unit_price_paise" >= 0),
	CONSTRAINT "goods_receipt_items_total_check" CHECK("goods_receipt_items"."line_total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `goods_receipt_items_receipt_idx` ON `goods_receipt_items` (`goods_receipt_id`);--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`receipt_number` text NOT NULL,
	`received_at` text NOT NULL,
	`received_by_user_id` integer NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goods_receipts_factory_number_unique` ON `goods_receipts` (`factory_id`,`receipt_number`);--> statement-breakpoint
CREATE INDEX `goods_receipts_factory_idx` ON `goods_receipts` (`factory_id`);--> statement-breakpoint
CREATE INDEX `goods_receipts_order_idx` ON `goods_receipts` (`purchase_order_id`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity_packets` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoice_items_quantity_check" CHECK("invoice_items"."quantity_packets" > 0),
	CONSTRAINT "invoice_items_amounts_check" CHECK("invoice_items"."unit_price_paise" >= 0 and "invoice_items"."line_total_paise" >= 0 and "invoice_items"."tax_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`sales_order_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`amount_paid_paise` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoices_amounts_check" CHECK("invoices"."subtotal_paise" >= 0 and "invoices"."tax_paise" >= 0 and "invoices"."total_paise" >= 0 and "invoices"."amount_paid_paise" >= 0),
	CONSTRAINT "invoices_status_check" CHECK("invoices"."status" in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_factory_number_unique` ON `invoices` (`factory_id`,`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_factory_idx` ON `invoices` (`factory_id`);--> statement-breakpoint
CREATE INDEX `invoices_order_idx` ON `invoices` (`sales_order_id`);--> statement-breakpoint
CREATE INDEX `invoices_customer_idx` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE `material_batches` (
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
	CONSTRAINT "material_batches_quantity_check" CHECK("material_batches"."quantity_grams" > 0),
	CONSTRAINT "material_batches_available_check" CHECK("material_batches"."available_grams" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `material_batches_factory_code_unique` ON `material_batches` (`factory_id`,`batch_code`);--> statement-breakpoint
CREATE INDEX `material_batches_factory_idx` ON `material_batches` (`factory_id`);--> statement-breakpoint
CREATE INDEX `material_batches_material_idx` ON `material_batches` (`raw_material_id`);--> statement-breakpoint
CREATE TABLE `packaging_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`unit_of_measure` text DEFAULT 'pcs' NOT NULL,
	`reorder_level_units` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "packaging_materials_reorder_check" CHECK("packaging_materials"."reorder_level_units" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `packaging_materials_factory_code_unique` ON `packaging_materials` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `packaging_materials_factory_idx` ON `packaging_materials` (`factory_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`payment_number` text NOT NULL,
	`paid_at` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`method` text NOT NULL,
	`reference_no` text,
	`recorded_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_amount_check" CHECK("payments"."amount_paise" > 0),
	CONSTRAINT "payments_method_check" CHECK("payments"."method" in ('cash', 'upi', 'bank_transfer', 'cheque', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_factory_number_unique` ON `payments` (`factory_id`,`payment_number`);--> statement-breakpoint
CREATE INDEX `payments_factory_idx` ON `payments` (`factory_id`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE TABLE `production_run_inputs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`production_run_id` integer NOT NULL,
	`material_batch_id` integer NOT NULL,
	`quantity_grams` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`production_run_id`) REFERENCES `production_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`material_batch_id`) REFERENCES `material_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_run_inputs_quantity_check" CHECK("production_run_inputs"."quantity_grams" > 0)
);
--> statement-breakpoint
CREATE INDEX `production_run_inputs_run_idx` ON `production_run_inputs` (`production_run_id`);--> statement-breakpoint
CREATE INDEX `production_run_inputs_batch_idx` ON `production_run_inputs` (`material_batch_id`);--> statement-breakpoint
CREATE TABLE `production_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`recipe_id` integer NOT NULL,
	`sales_order_id` integer,
	`run_number` text NOT NULL,
	`planned_output_grams` integer NOT NULL,
	`actual_output_grams` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_runs_planned_check" CHECK("production_runs"."planned_output_grams" > 0),
	CONSTRAINT "production_runs_actual_check" CHECK("production_runs"."actual_output_grams" >= 0),
	CONSTRAINT "production_runs_status_check" CHECK("production_runs"."status" in ('planned', 'in_progress', 'completed', 'scrapped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_runs_factory_number_unique` ON `production_runs` (`factory_id`,`run_number`);--> statement-breakpoint
CREATE INDEX `production_runs_factory_idx` ON `production_runs` (`factory_id`);--> statement-breakpoint
CREATE INDEX `production_runs_recipe_idx` ON `production_runs` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `production_runs_status_idx` ON `production_runs` (`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`packet_grams` integer NOT NULL,
	`hsn_code` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "products_packet_grams_check" CHECK("products"."packet_grams" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_factory_code_unique` ON `products` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `products_factory_idx` ON `products` (`factory_id`);--> statement-breakpoint
CREATE TABLE `purchase_order_packaging_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`packaging_material_id` integer NOT NULL,
	`quantity_units` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "purchase_order_packaging_quantity_check" CHECK("purchase_order_packaging_materials"."quantity_units" > 0),
	CONSTRAINT "purchase_order_packaging_price_check" CHECK("purchase_order_packaging_materials"."unit_price_paise" >= 0),
	CONSTRAINT "purchase_order_packaging_total_check" CHECK("purchase_order_packaging_materials"."line_total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `purchase_order_packaging_order_idx` ON `purchase_order_packaging_materials` (`purchase_order_id`);--> statement-breakpoint
CREATE TABLE `purchase_order_raw_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_order_id` integer NOT NULL,
	`raw_material_id` integer NOT NULL,
	`quantity_grams` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "purchase_order_raw_materials_quantity_check" CHECK("purchase_order_raw_materials"."quantity_grams" > 0),
	CONSTRAINT "purchase_order_raw_materials_price_check" CHECK("purchase_order_raw_materials"."unit_price_paise" >= 0),
	CONSTRAINT "purchase_order_raw_materials_total_check" CHECK("purchase_order_raw_materials"."line_total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `purchase_order_raw_materials_order_idx` ON `purchase_order_raw_materials` (`purchase_order_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
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
	CONSTRAINT "purchase_orders_status_check" CHECK("purchase_orders"."status" in ('draft', 'approved', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_total_check" CHECK("purchase_orders"."total_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_factory_number_unique` ON `purchase_orders` (`factory_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `purchase_orders_factory_idx` ON `purchase_orders` (`factory_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_orders_status_idx` ON `purchase_orders` (`status`);--> statement-breakpoint
CREATE TABLE `raw_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`unit_of_measure` text DEFAULT 'g' NOT NULL,
	`reorder_level_grams` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "raw_materials_reorder_check" CHECK("raw_materials"."reorder_level_grams" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_materials_factory_code_unique` ON `raw_materials` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `raw_materials_factory_idx` ON `raw_materials` (`factory_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`raw_material_id` integer NOT NULL,
	`quantity_grams` integer NOT NULL,
	`tolerance_percent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recipe_ingredients_quantity_check" CHECK("recipe_ingredients"."quantity_grams" > 0),
	CONSTRAINT "recipe_ingredients_tolerance_check" CHECK("recipe_ingredients"."tolerance_percent" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_ingredients_unique` ON `recipe_ingredients` (`recipe_id`,`raw_material_id`);--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe_packaging` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`packaging_material_id` integer NOT NULL,
	`quantity_units` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recipe_packaging_quantity_check" CHECK("recipe_packaging"."quantity_units" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_packaging_unique` ON `recipe_packaging` (`recipe_id`,`packaging_material_id`);--> statement-breakpoint
CREATE INDEX `recipe_packaging_recipe_idx` ON `recipe_packaging` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`expected_yield_grams` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "recipes_version_check" CHECK("recipes"."version" > 0),
	CONSTRAINT "recipes_yield_check" CHECK("recipes"."expected_yield_grams" > 0),
	CONSTRAINT "recipes_status_check" CHECK("recipes"."status" in ('draft', 'active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_factory_code_version_unique` ON `recipes` (`factory_id`,`code`,`version`);--> statement-breakpoint
CREATE INDEX `recipes_factory_idx` ON `recipes` (`factory_id`);--> statement-breakpoint
CREATE INDEX `recipes_product_idx` ON `recipes` (`product_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	CONSTRAINT "roles_name_check" CHECK("roles"."name" in ('owner', 'admin', 'salesman', 'production', 'accountant'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `sales_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity_packets` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sales_order_items_quantity_check" CHECK("sales_order_items"."quantity_packets" > 0),
	CONSTRAINT "sales_order_items_price_check" CHECK("sales_order_items"."unit_price_paise" >= 0),
	CONSTRAINT "sales_order_items_total_check" CHECK("sales_order_items"."line_total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `sales_order_items_order_idx` ON `sales_order_items` (`sales_order_id`);--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`order_number` text NOT NULL,
	`order_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount_paise` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`approved_by_user_id` integer,
	`approved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sales_orders_status_check" CHECK("sales_orders"."status" in ('draft', 'confirmed', 'approved', 'rejected', 'fulfilled', 'cancelled')),
	CONSTRAINT "sales_orders_total_check" CHECK("sales_orders"."total_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_factory_number_unique` ON `sales_orders` (`factory_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `sales_orders_factory_idx` ON `sales_orders` (`factory_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_customer_idx` ON `sales_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_status_idx` ON `sales_orders` (`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `stock_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`material_batch_id` integer,
	`finished_good_id` integer,
	`transaction_type` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` integer NOT NULL,
	`quantity_delta_grams` integer NOT NULL,
	`balance_grams` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`material_batch_id`) REFERENCES `material_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`finished_good_id`) REFERENCES `finished_goods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "stock_ledger_source_check" CHECK(("stock_ledger"."material_batch_id" is not null) <> ("stock_ledger"."finished_good_id" is not null)),
	CONSTRAINT "stock_ledger_delta_check" CHECK("stock_ledger"."quantity_delta_grams" <> 0),
	CONSTRAINT "stock_ledger_balance_check" CHECK("stock_ledger"."balance_grams" >= 0)
);
--> statement-breakpoint
CREATE INDEX `stock_ledger_factory_idx` ON `stock_ledger` (`factory_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_material_batch_idx` ON `stock_ledger` (`material_batch_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_finished_good_idx` ON `stock_ledger` (`finished_good_id`);--> statement-breakpoint
CREATE INDEX `stock_ledger_reference_idx` ON `stock_ledger` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address_line1` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`gstin` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_factory_code_unique` ON `suppliers` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `suppliers_factory_idx` ON `suppliers` (`factory_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "users_status_check" CHECK("users"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_factory_idx` ON `users` (`factory_id`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role_id`);--> statement-breakpoint
ALTER TABLE `factories` ADD `updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL;