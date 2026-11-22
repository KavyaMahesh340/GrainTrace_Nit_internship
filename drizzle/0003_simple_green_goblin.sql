CREATE TABLE `production_cost_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`production_run_id` integer NOT NULL,
	`snapshot_id` text NOT NULL,
	`run_number` text NOT NULL,
	`posted_at` text NOT NULL,
	`good_output_packets` integer NOT NULL,
	`material_cost_paise` integer NOT NULL,
	`labour_paise` integer NOT NULL,
	`gas_paise` integer NOT NULL,
	`overhead_paise` integer NOT NULL,
	`total_run_cost_paise` integer NOT NULL,
	`cost_per_good_packet_paise` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`production_run_id`) REFERENCES `production_runs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_cost_snapshots_output_check" CHECK("production_cost_snapshots"."good_output_packets" > 0),
	CONSTRAINT "production_cost_snapshots_amount_check" CHECK("production_cost_snapshots"."material_cost_paise" >= 0 and "production_cost_snapshots"."labour_paise" >= 0 and "production_cost_snapshots"."gas_paise" >= 0 and "production_cost_snapshots"."overhead_paise" >= 0 and "production_cost_snapshots"."total_run_cost_paise" >= 0 and "production_cost_snapshots"."cost_per_good_packet_paise" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_cost_snapshots_factory_snapshot_unique` ON `production_cost_snapshots` (`factory_id`,`snapshot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_cost_snapshots_run_unique` ON `production_cost_snapshots` (`production_run_id`);--> statement-breakpoint
CREATE INDEX `production_cost_snapshots_factory_idx` ON `production_cost_snapshots` (`factory_id`);--> statement-breakpoint
CREATE TABLE `production_run_materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`production_run_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`item_id` text NOT NULL,
	`base_unit` text NOT NULL,
	`raw_material_id` integer,
	`packaging_material_id` integer,
	`material_batch_id` integer,
	`packaging_batch_id` integer,
	`planned_quantity` integer NOT NULL,
	`actual_quantity` integer DEFAULT 0 NOT NULL,
	`damaged_quantity` integer DEFAULT 0 NOT NULL,
	`unit_cost_numerator` integer,
	`unit_cost_denominator` integer,
	`recorded_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`production_run_id`) REFERENCES `production_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_material_id`) REFERENCES `packaging_materials`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`material_batch_id`) REFERENCES `material_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`packaging_batch_id`) REFERENCES `packaging_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_run_materials_target_check" CHECK("production_run_materials"."target_type" in ('raw', 'packaging')),
	CONSTRAINT "production_run_materials_unit_check" CHECK("production_run_materials"."base_unit" in ('grams', 'pieces')),
	CONSTRAINT "production_run_materials_material_check" CHECK(("production_run_materials"."raw_material_id" is not null) <> ("production_run_materials"."packaging_material_id" is not null)),
	CONSTRAINT "production_run_materials_batch_check" CHECK(not ("production_run_materials"."material_batch_id" is not null and "production_run_materials"."packaging_batch_id" is not null)),
	CONSTRAINT "production_run_materials_planned_check" CHECK("production_run_materials"."planned_quantity" > 0),
	CONSTRAINT "production_run_materials_actual_check" CHECK("production_run_materials"."actual_quantity" >= 0 and "production_run_materials"."damaged_quantity" >= 0),
	CONSTRAINT "production_run_materials_cost_check" CHECK(("production_run_materials"."unit_cost_numerator" is null and "production_run_materials"."unit_cost_denominator" is null) or ("production_run_materials"."unit_cost_numerator" >= 0 and "production_run_materials"."unit_cost_denominator" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_run_materials_run_item_unique` ON `production_run_materials` (`production_run_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `production_run_materials_run_idx` ON `production_run_materials` (`production_run_id`);--> statement-breakpoint
CREATE INDEX `production_run_materials_batch_idx` ON `production_run_materials` (`material_batch_id`);--> statement-breakpoint
CREATE INDEX `production_run_materials_packaging_batch_idx` ON `production_run_materials` (`packaging_batch_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_production_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factory_id` integer NOT NULL,
	`recipe_id` integer NOT NULL,
	`sales_order_id` integer,
	`run_number` text NOT NULL,
	`planned_output_grams` integer NOT NULL,
	`actual_output_grams` integer DEFAULT 0 NOT NULL,
	`actual_output_packets` integer DEFAULT 0 NOT NULL,
	`damaged_output_packets` integer DEFAULT 0 NOT NULL,
	`labour_paise` integer DEFAULT 0 NOT NULL,
	`gas_paise` integer DEFAULT 0 NOT NULL,
	`selling_price_paise` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`started_at` text,
	`completed_at` text,
	`posted_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`factory_id`) REFERENCES `factories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "production_runs_planned_check" CHECK("__new_production_runs"."planned_output_grams" > 0),
	CONSTRAINT "production_runs_actual_check" CHECK("__new_production_runs"."actual_output_grams" >= 0),
	CONSTRAINT "production_runs_packets_check" CHECK("__new_production_runs"."actual_output_packets" >= 0 and "__new_production_runs"."damaged_output_packets" >= 0),
	CONSTRAINT "production_runs_cost_check" CHECK("__new_production_runs"."labour_paise" >= 0 and "__new_production_runs"."gas_paise" >= 0),
	CONSTRAINT "production_runs_status_check" CHECK("__new_production_runs"."status" in ('draft', 'planned', 'in_progress', 'completed', 'posted'))
);
--> statement-breakpoint
INSERT INTO `__new_production_runs`("id", "factory_id", "recipe_id", "sales_order_id", "run_number", "planned_output_grams", "actual_output_grams", "status", "started_at", "completed_at", "created_by_user_id", "created_at", "updated_at") SELECT "id", "factory_id", "recipe_id", "sales_order_id", "run_number", "planned_output_grams", "actual_output_grams", "status", "started_at", "completed_at", "created_by_user_id", "created_at", "updated_at" FROM `production_runs`;--> statement-breakpoint
DROP TABLE `production_runs`;--> statement-breakpoint
ALTER TABLE `__new_production_runs` RENAME TO `production_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `production_runs_factory_number_unique` ON `production_runs` (`factory_id`,`run_number`);--> statement-breakpoint
CREATE INDEX `production_runs_factory_idx` ON `production_runs` (`factory_id`);--> statement-breakpoint
CREATE INDEX `production_runs_recipe_idx` ON `production_runs` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `production_runs_status_idx` ON `production_runs` (`status`);