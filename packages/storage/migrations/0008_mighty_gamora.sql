CREATE TABLE `connector_secrets` (
	`connector_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
