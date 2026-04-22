CREATE TABLE `agent_provider_configs` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `label` text NOT NULL,
  `base_url` text,
  `model` text NOT NULL,
  `temperature` text,
  `max_output_tokens` integer,
  `is_active` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_provider_configs_provider_idx` ON `agent_provider_configs` (`provider`);
--> statement-breakpoint
CREATE INDEX `agent_provider_configs_active_idx` ON `agent_provider_configs` (`is_active`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `agent_provider_secrets` (
  `provider_config_id` text PRIMARY KEY NOT NULL,
  `secret` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
