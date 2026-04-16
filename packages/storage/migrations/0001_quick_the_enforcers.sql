CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text,
	`content_hash` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_content_hash_idx` ON `assets` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_file_path_idx` ON `assets` (`file_path`);--> statement-breakpoint
CREATE INDEX `assets_project_created_idx` ON `assets` (`project_id`,`created_at`);