CREATE TABLE `credit_note_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credit_note_id` integer NOT NULL,
	`invoice_item_id` integer,
	`product_id` integer NOT NULL,
	`hsn_code` text DEFAULT '' NOT NULL,
	`quantity_packets` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`taxable_paise` integer NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`credit_note_id`) REFERENCES `credit_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "credit_note_items_quantity_check" CHECK("credit_note_items"."quantity_packets" > 0),
	CONSTRAINT "credit_note_items_amounts_check" CHECK("credit_note_items"."unit_price_paise" >= 0 and "credit_note_items"."taxable_paise" >= 0 and "credit_note_items"."tax_paise" >= 0 and "credit_note_items"."line_total_paise" >= 0)
);
--> statement-breakpoint
CREATE INDEX `credit_note_items_note_idx` ON `credit_note_items` (`credit_note_id`);--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`credit_note_number` text NOT NULL,
	`financial_year` text NOT NULL,
	`credit_note_date` text NOT NULL,
	`reason` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`hsn_code` text DEFAULT '' NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`igst_paise` integer DEFAULT 0 NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "credit_notes_reason_check" CHECK(length("credit_notes"."reason") > 0),
	CONSTRAINT "credit_notes_amounts_check" CHECK("credit_notes"."subtotal_paise" >= 0 and "credit_notes"."tax_paise" >= 0 and "credit_notes"."total_paise" >= 0),
	CONSTRAINT "credit_notes_status_check" CHECK("credit_notes"."status" in ('issued', 'adjusted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_factory_number_unique` ON `credit_notes` (`factory_id`,`credit_note_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_notes_invoice_unique` ON `credit_notes` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `credit_notes_factory_idx` ON `credit_notes` (`factory_id`);--> statement-breakpoint
CREATE INDEX `credit_notes_customer_idx` ON `credit_notes` (`customer_id`);--> statement-breakpoint
CREATE TABLE `document_number_sequences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`document_type` text NOT NULL,
	`scope_key` text NOT NULL,
	`prefix` text NOT NULL,
	`padding` integer DEFAULT 4 NOT NULL,
	`next_value` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "document_number_sequences_prefix_check" CHECK(length("document_number_sequences"."prefix") > 0),
	CONSTRAINT "document_number_sequences_padding_check" CHECK("document_number_sequences"."padding" between 1 and 8),
	CONSTRAINT "document_number_sequences_next_check" CHECK("document_number_sequences"."next_value" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_number_sequences_scope_unique` ON `document_number_sequences` (`factory_id`,`document_type`,`scope_key`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`sales_order_item_id` integer,
	`product_id` integer NOT NULL,
	`hsn_code` text DEFAULT '' NOT NULL,
	`quantity_packets` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`taxable_paise` integer NOT NULL,
	`rate_basis_points` integer DEFAULT 500 NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`igst_paise` integer DEFAULT 0 NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`line_total_paise` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoice_items_quantity_check" CHECK("__new_invoice_items"."quantity_packets" > 0),
	CONSTRAINT "invoice_items_amounts_check" CHECK("__new_invoice_items"."unit_price_paise" >= 0 and "__new_invoice_items"."taxable_paise" >= 0 and "__new_invoice_items"."line_total_paise" >= 0 and "__new_invoice_items"."tax_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_invoice_items`("id", "invoice_id", "sales_order_item_id", "product_id", "hsn_code", "quantity_packets", "unit_price_paise", "taxable_paise", "rate_basis_points", "cgst_paise", "sgst_paise", "igst_paise", "tax_paise", "line_total_paise", "created_at", "updated_at") SELECT "id", "invoice_id", NULL, "product_id", '', "quantity_packets", "unit_price_paise", "line_total_paise", 500, 0, 0, 0, "tax_paise", "line_total_paise", "created_at", "updated_at" FROM `invoice_items`;--> statement-breakpoint
DROP TABLE `invoice_items`;--> statement-breakpoint
ALTER TABLE `__new_invoice_items` RENAME TO `invoice_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_items_order_item_idx` ON `invoice_items` (`sales_order_item_id`);--> statement-breakpoint
CREATE TABLE `__new_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`sales_order_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`financial_year` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`from_state` text NOT NULL,
	`from_gstin` text DEFAULT '' NOT NULL,
	`from_address_line1` text DEFAULT '' NOT NULL,
	`from_city` text DEFAULT '' NOT NULL,
	`from_postal_code` text DEFAULT '' NOT NULL,
	`to_state` text NOT NULL,
	`to_gstin` text DEFAULT '' NOT NULL,
	`to_address_line1` text DEFAULT '' NOT NULL,
	`to_city` text DEFAULT '' NOT NULL,
	`to_postal_code` text DEFAULT '' NOT NULL,
	`jurisdiction` text NOT NULL,
	`hsn_code` text DEFAULT '' NOT NULL,
	`payment_terms_days` integer DEFAULT 0 NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`tax_paise` integer DEFAULT 0 NOT NULL,
	`total_paise` integer NOT NULL,
	`amount_paid_paise` integer DEFAULT 0 NOT NULL,
	`credit_note_number` text,
	`credit_note_paise` integer DEFAULT 0 NOT NULL,
	`cancellation_reason` text,
	`cancelled_at` text,
	`posted_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoices_amounts_check" CHECK("__new_invoices"."subtotal_paise" >= 0 and "__new_invoices"."tax_paise" >= 0 and "__new_invoices"."total_paise" >= 0 and "__new_invoices"."amount_paid_paise" >= 0 and "__new_invoices"."credit_note_paise" >= 0),
	CONSTRAINT "invoices_jurisdiction_check" CHECK("__new_invoices"."jurisdiction" in ('intra_state', 'inter_state')),
	CONSTRAINT "invoices_terms_check" CHECK("__new_invoices"."payment_terms_days" >= 0 and "__new_invoices"."payment_terms_days" <= 365),
	CONSTRAINT "invoices_status_check" CHECK("__new_invoices"."status" in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_invoices`("id", "factory_id", "sales_order_id", "customer_id", "invoice_number", "financial_year", "invoice_date", "due_date", "from_state", "from_gstin", "from_address_line1", "from_city", "from_postal_code", "to_state", "to_gstin", "to_address_line1", "to_city", "to_postal_code", "jurisdiction", "hsn_code", "payment_terms_days", "subtotal_paise", "tax_paise", "total_paise", "amount_paid_paise", "credit_note_number", "credit_note_paise", "cancellation_reason", "cancelled_at", "posted_at", "status", "created_by_user_id", "created_at", "updated_at") SELECT "id", "factory_id", "sales_order_id", "customer_id", "invoice_number", '', "invoice_date", "due_date", '', '', '', '', '', '', '', '', '', '', 'intra_state', '', 0, "subtotal_paise", "tax_paise", "total_paise", "amount_paid_paise", NULL, 0, NULL, NULL, NULL, "status", "created_by_user_id", "created_at", "updated_at" FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_factory_number_unique` ON `invoices` (`factory_id`,`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_factory_idx` ON `invoices` (`factory_id`);--> statement-breakpoint
CREATE INDEX `invoices_order_idx` ON `invoices` (`sales_order_id`);--> statement-breakpoint
CREATE INDEX `invoices_customer_idx` ON `invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE TABLE `__new_sales_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`order_number` text NOT NULL,
	`order_date` text NOT NULL,
	`requested_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount_paise` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`salesman_user_id` integer,
	`created_by_user_id` integer NOT NULL,
	`approved_by_user_id` integer,
	`approved_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`salesman_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sales_orders_status_check" CHECK("__new_sales_orders"."status" in ('draft', 'submitted', 'confirmed', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected', 'cancelled')),
	CONSTRAINT "sales_orders_total_check" CHECK("__new_sales_orders"."total_amount_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_sales_orders`("id", "factory_id", "customer_id", "order_number", "order_date", "requested_date", "status", "total_amount_paise", "notes", "salesman_user_id", "created_by_user_id", "approved_by_user_id", "approved_at", "created_at", "updated_at") SELECT "id", "factory_id", "customer_id", "order_number", "order_date", NULL, "status", "total_amount_paise", '', NULL, "created_by_user_id", "approved_by_user_id", "approved_at", "created_at", "updated_at" FROM `sales_orders`;--> statement-breakpoint
DROP TABLE `sales_orders`;--> statement-breakpoint
ALTER TABLE `__new_sales_orders` RENAME TO `sales_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_factory_number_unique` ON `sales_orders` (`factory_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `sales_orders_factory_idx` ON `sales_orders` (`factory_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_customer_idx` ON `sales_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_orders_status_idx` ON `sales_orders` (`status`);--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`customer_type` text DEFAULT 'retailer' NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`gstin` text,
	`delivery_address_line1` text,
	`delivery_address_line2` text,
	`delivery_city` text,
	`delivery_state` text,
	`delivery_postal_code` text,
	`credit_terms_days` integer DEFAULT 30 NOT NULL,
	`credit_limit_paise` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "customers_type_check" CHECK("__new_customers"."customer_type" in ('retailer', 'distributor')),
	CONSTRAINT "customers_status_check" CHECK("__new_customers"."status" in ('active', 'inactive', 'blocked')),
	CONSTRAINT "customers_credit_terms_check" CHECK("__new_customers"."credit_terms_days" >= 0 and "__new_customers"."credit_terms_days" <= 365),
	CONSTRAINT "customers_credit_limit_check" CHECK("__new_customers"."credit_limit_paise" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "factory_id", "code", "name", "customer_type", "contact_name", "email", "phone", "address_line1", "address_line2", "city", "state", "postal_code", "gstin", "delivery_address_line1", "delivery_address_line2", "delivery_city", "delivery_state", "delivery_postal_code", "credit_terms_days", "credit_limit_paise", "status", "created_at", "updated_at") SELECT "id", "factory_id", "code", "name", 'retailer', "contact_name", "email", "phone", "address_line1", NULL, "city", "state", "postal_code", "gstin", NULL, NULL, NULL, "state", NULL, 30, 0, 'active', "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_factory_code_unique` ON `customers` (`factory_id`,`code`);--> statement-breakpoint
CREATE INDEX `customers_factory_idx` ON `customers` (`factory_id`);--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
ALTER TABLE `dispatch_items` ADD `sales_order_item_id` integer REFERENCES sales_order_items(id);--> statement-breakpoint
CREATE INDEX `dispatch_items_order_item_idx` ON `dispatch_items` (`sales_order_item_id`);--> statement-breakpoint
ALTER TABLE `dispatches` ADD `expected_date` text;--> statement-breakpoint
ALTER TABLE `dispatches` ADD `delivered_at` text;--> statement-breakpoint
ALTER TABLE `dispatches` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `gstin` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `address_line1` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `state` text DEFAULT 'Maharashtra' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `postal_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `factories` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_sales_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity_packets` integer NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`line_total_paise` integer NOT NULL,
	`hsn_code` text DEFAULT '' NOT NULL,
	`fulfilled_packets` integer DEFAULT 0 NOT NULL,
	`invoiced_packets` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sales_order_items_quantity_check" CHECK("__new_sales_order_items"."quantity_packets" > 0),
	CONSTRAINT "sales_order_items_price_check" CHECK("__new_sales_order_items"."unit_price_paise" >= 0),
	CONSTRAINT "sales_order_items_discount_check" CHECK("__new_sales_order_items"."discount_paise" >= 0 and "__new_sales_order_items"."discount_paise" <= "__new_sales_order_items"."unit_price_paise"),
	CONSTRAINT "sales_order_items_total_check" CHECK("__new_sales_order_items"."line_total_paise" >= 0),
	CONSTRAINT "sales_order_items_fulfilled_check" CHECK("__new_sales_order_items"."fulfilled_packets" >= 0 and "__new_sales_order_items"."fulfilled_packets" <= "__new_sales_order_items"."quantity_packets"),
	CONSTRAINT "sales_order_items_invoiced_check" CHECK("__new_sales_order_items"."invoiced_packets" >= 0 and "__new_sales_order_items"."invoiced_packets" <= "__new_sales_order_items"."fulfilled_packets")
);
--> statement-breakpoint
INSERT INTO `__new_sales_order_items`("id", "sales_order_id", "product_id", "quantity_packets", "unit_price_paise", "discount_paise", "line_total_paise", "hsn_code", "fulfilled_packets", "invoiced_packets", "created_at", "updated_at") SELECT "id", "sales_order_id", "product_id", "quantity_packets", "unit_price_paise", 0, "line_total_paise", '', 0, 0, "created_at", "updated_at" FROM `sales_order_items`;--> statement-breakpoint
DROP TABLE `sales_order_items`;--> statement-breakpoint
ALTER TABLE `__new_sales_order_items` RENAME TO `sales_order_items`;--> statement-breakpoint
CREATE INDEX `sales_order_items_order_idx` ON `sales_order_items` (`sales_order_id`);