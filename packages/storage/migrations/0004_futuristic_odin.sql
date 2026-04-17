ALTER TABLE `generations` ADD `attempt_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `max_attempts` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `next_retry_at` text;--> statement-breakpoint
ALTER TABLE `generations` ADD `settings` text;