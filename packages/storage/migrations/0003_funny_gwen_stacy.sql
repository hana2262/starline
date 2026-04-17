CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`connector_id` text NOT NULL,
	`prompt` text NOT NULL,
	`type` text NOT NULL,
	`project_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`asset_id` text,
	`error_code` text,
	`error_message` text,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text
);
