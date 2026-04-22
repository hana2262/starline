ALTER TABLE agent_provider_configs ADD COLUMN slug text;
--> statement-breakpoint
ALTER TABLE agent_provider_configs ADD COLUMN vendor text;
--> statement-breakpoint
ALTER TABLE agent_provider_configs ADD COLUMN protocol text;
--> statement-breakpoint
ALTER TABLE agent_provider_configs ADD COLUMN note text;
--> statement-breakpoint
ALTER TABLE agent_provider_configs ADD COLUMN website text;
--> statement-breakpoint
UPDATE agent_provider_configs
SET
  slug = CASE
    WHEN provider = 'mock' THEN 'mock'
    WHEN provider = 'openai-compatible' THEN 'custom-openai-compatible'
    WHEN provider = 'anthropic' THEN 'anthropic'
    WHEN provider = 'gemini' THEN 'gemini'
    WHEN provider = 'minimax' THEN 'minimax'
    WHEN provider = 'qwen' THEN 'qwen'
    ELSE lower(replace(id, '_', '-'))
  END,
  vendor = CASE
    WHEN provider = 'mock' THEN 'mock'
    WHEN provider = 'anthropic' THEN 'anthropic'
    WHEN provider = 'gemini' THEN 'gemini'
    WHEN provider = 'minimax' THEN 'minimax'
    WHEN provider = 'qwen' THEN 'qwen'
    ELSE 'custom'
  END,
  protocol = CASE
    WHEN provider = 'mock' THEN 'mock'
    WHEN provider = 'openai-compatible' THEN 'openai-compatible'
    WHEN provider = 'anthropic' THEN 'anthropic'
    WHEN provider = 'gemini' THEN 'gemini'
    ELSE 'openai-compatible'
  END
WHERE slug IS NULL OR vendor IS NULL OR protocol IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS agent_provider_configs_slug_idx
ON agent_provider_configs (slug);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_provider_configs_vendor_protocol_idx
ON agent_provider_configs (vendor, protocol);
