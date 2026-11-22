PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`payment_number` text NOT NULL,
	`paid_at` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`method` text NOT NULL,
	`reference_no` text,
	`notes` text DEFAULT '' NOT NULL,
	`direction` text DEFAULT 'credit' NOT NULL,
	`status` text DEFAULT 'posted' NOT NULL,
	`corrects_payment_id` integer,
	`reason` text,
	`duplicate_key` text,
	`recorded_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payments_amount_check" CHECK("__new_payments"."amount_paise" > 0),
	CONSTRAINT "payments_method_check" CHECK("__new_payments"."method" in ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
	CONSTRAINT "payments_direction_check" CHECK("__new_payments"."direction" in ('credit', 'debit')),
	CONSTRAINT "payments_status_check" CHECK("__new_payments"."status" in ('posted', 'partially_corrected', 'corrected', 'correction'))
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "factory_id", "invoice_id", "customer_id", "payment_number", "paid_at", "amount_paise", "method", "reference_no", "notes", "direction", "status", "corrects_payment_id", "reason", "duplicate_key", "recorded_by_user_id", "created_at", "updated_at") SELECT "id", "factory_id", "invoice_id", "customer_id", "payment_number", "paid_at", "amount_paise", "method", "reference_no", "notes", "direction", "status", "corrects_payment_id", "reason", "duplicate_key", "recorded_by_user_id", "created_at", "updated_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_factory_number_unique` ON `payments` (`factory_id`,`payment_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_factory_duplicate_unique` ON `payments` (`factory_id`,`duplicate_key`);--> statement-breakpoint
CREATE INDEX `payments_factory_idx` ON `payments` (`factory_id`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_customer_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_correction_idx` ON `payments` (`corrects_payment_id`);--> statement-breakpoint
ALTER TABLE `stock_ledger` ADD `movement_key` text;--> statement-breakpoint
UPDATE `stock_ledger` SET `movement_key` = `transaction_type` || ':' || `reference_type` || ':' || `reference_number` || ':' || CASE WHEN `material_batch_id` IS NOT NULL THEN 'raw:' || CAST(`material_batch_id` AS TEXT) WHEN `packaging_batch_id` IS NOT NULL THEN 'packaging:' || CAST(`packaging_batch_id` AS TEXT) ELSE 'finished_good:' || CAST(`finished_good_id` AS TEXT) END;--> statement-breakpoint
CREATE UNIQUE INDEX `stock_ledger_movement_key_unique` ON `stock_ledger` (`factory_id`,`movement_key`);