CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`project_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_event_type_created_idx` ON `events` (`event_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `events_project_created_idx` ON `events` (`project_id`,`created_at`);
