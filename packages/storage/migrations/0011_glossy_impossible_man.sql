ALTER TABLE `assets` ADD `visibility` text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `visibility` text DEFAULT 'public' NOT NULL;
