ALTER TABLE `assets` ADD `origin` text DEFAULT 'imported' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `trashed_at` text;