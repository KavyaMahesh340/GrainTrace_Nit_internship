ALTER TABLE `sales_orders` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_factory_idempotency_unique` ON `sales_orders` (`factory_id`,`idempotency_key`);