import { randomUUID } from "crypto";
import type {
  AgentProviderConfigRepository,
  AgentProviderSecretRepository,
} from "@starline/storage";
import type {
  AgentProviderActivateResult,
  AgentProviderConfig,
  AgentProviderListResult,
  AgentProtocolId,
  AgentProviderTestResult,
  AgentProviderUpsertInput,
  AgentProviderUpsertResult,
  AgentVendorId,
} from "@starline/shared";
import { LLMProviderError } from "./llm/errors.js";
import type { AgentLLMHandle } from "./llm/provider.js";
import type { LLMProviderConfig, LLMProviderRegistry } from "./llm/index.js";

export class AgentProviderConfigError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "SECRET_REQUIRED" | "UNSUPPORTED_PROTOCOL" | "ACTIVE_PROVIDER_DELETE_BLOCKED",
    public readonly providerConfigId?: string,
  ) {
    super(message);
    this.name = "AgentProviderConfigError";
  }
}

function toView(
  row: ReturnType<AgentProviderConfigRepository["getById"]> extends infer T ? Exclude<T, undefined> : never,
  hasApiKey: boolean,
): AgentProviderConfig {
  return {
    id: row.id,
    slug: row.slug,
    vendor: row.vendor as AgentVendorId,
    protocol: row.protocol as AgentProtocolId,
    label: row.label,
    note: row.note,
    website: row.website,
    baseUrl: row.baseUrl,
    model: row.model,
    temperature: row.temperature,
    maxOutputTokens: row.maxOutputTokens,
    isActive: row.isActive,
    hasApiKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeNullable(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildProviderConfig(
  row: Exclude<ReturnType<AgentProviderConfigRepository["getById"]>, undefined>,
  apiKey?: string,
): LLMProviderConfig {
  return {
    vendor: row.vendor as LLMProviderConfig["vendor"],
    protocol: row.protocol as LLMProviderConfig["protocol"],
    model: row.model,
    baseUrl: row.baseUrl ?? undefined,
    apiKey,
    temperature: row.temperature !== null ? Number(row.temperature) : undefined,
    maxOutputTokens: row.maxOutputTokens ?? undefined,
  };
}

function requiresApiKey(protocol: AgentProtocolId): boolean {
  return protocol !== "mock";
}

export function createAgentProviderService(
  repo: AgentProviderConfigRepository,
  secretRepo: AgentProviderSecretRepository,
  registry: LLMProviderRegistry,
) {
  const supportedProtocols = new Set(registry.listProtocols());

  return {
    list(): AgentProviderListResult {
      return {
        items: repo.list().map((row) => toView(row, secretRepo.getById(row.id) !== undefined)),
      };
    },

    upsert(input: AgentProviderUpsertInput): AgentProviderUpsertResult {
      const id = input.id ?? randomUUID();
      const hasStoredSecret = secretRepo.getById(id) !== undefined;

      if (requiresApiKey(input.protocol) && !input.apiKey && !hasStoredSecret) {
        throw new AgentProviderConfigError(
          "API key is required before this provider can be saved.",
          "SECRET_REQUIRED",
          id,
        );
      }

      if (input.isActive && !supportedProtocols.has(input.protocol)) {
        throw new AgentProviderConfigError(
          `Protocol ${input.protocol} is not implemented yet.`,
          "UNSUPPORTED_PROTOCOL",
          id,
        );
      }

      const saved = repo.upsert({
        id,
        slug: input.slug,
        provider: input.protocol,
        vendor: input.vendor,
        protocol: input.protocol,
        label: input.label.trim(),
        note: normalizeNullable(input.note),
        website: normalizeNullable(input.website),
        baseUrl: normalizeNullable(input.baseUrl),
        model: input.model.trim(),
        temperature: normalizeNullable(input.temperature),
        maxOutputTokens: input.maxOutputTokens ?? null,
        isActive: input.isActive,
      });

      if (input.apiKey?.trim()) {
        secretRepo.upsert({
          providerConfigId: id,
          secret: input.apiKey.trim(),
        });
      }

      return {
        item: toView(saved, secretRepo.getById(id) !== undefined),
      };
    },

    activate(id: string): AgentProviderActivateResult {
      const existing = repo.getById(id);
      if (!existing) {
        throw new AgentProviderConfigError("Agent provider config not found", "NOT_FOUND", id);
      }
      if (!supportedProtocols.has(existing.protocol as AgentProtocolId)) {
        throw new AgentProviderConfigError(
          `Protocol ${existing.protocol} is not implemented yet.`,
          "UNSUPPORTED_PROTOCOL",
          id,
        );
      }

      const saved = repo.activate(id)!;
      return {
        item: toView(saved, secretRepo.getById(id) !== undefined),
      };
    },

    async test(id: string): Promise<AgentProviderTestResult> {
      const row = repo.getById(id);
      if (!row) {
        throw new AgentProviderConfigError("Agent provider config not found", "NOT_FOUND", id);
      }

      if (!supportedProtocols.has(row.protocol as AgentProtocolId)) {
        return {
          ok: false,
          vendor: row.vendor as AgentVendorId,
          protocol: row.protocol as AgentProtocolId,
          model: row.model,
          latencyMs: 0,
          error: `Protocol ${row.protocol} is not implemented yet.`,
        };
      }

      const secret = secretRepo.getById(id);
      const config = buildProviderConfig(row, secret?.secret);
      const handle = registry.create(config);
      const startedAt = Date.now();

      try {
        const response = await handle.provider.generate({
          systemPrompt: "You are a connectivity test responder.",
          messages: [{ role: "user", content: "Return a short provider connectivity confirmation." }],
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
        }, config);
        return {
          ok: true,
          vendor: row.vendor as AgentVendorId,
          protocol: response.protocol as AgentProtocolId,
          model: response.model,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof LLMProviderError) {
          return {
            ok: false,
            vendor: row.vendor as AgentVendorId,
            protocol: row.protocol as AgentProtocolId,
            model: row.model,
            latencyMs: Date.now() - startedAt,
            error: message,
          };
        }

        return {
          ok: false,
          vendor: row.vendor as AgentVendorId,
          protocol: row.protocol as AgentProtocolId,
          model: row.model,
          latencyMs: Date.now() - startedAt,
          error: message,
        };
      }
    },

    remove(id: string): void {
      const row = repo.getById(id);
      if (!row) {
        throw new AgentProviderConfigError("Agent provider config not found", "NOT_FOUND", id);
      }
      if (row.isActive) {
        throw new AgentProviderConfigError(
          "Active provider config cannot be deleted directly.",
          "ACTIVE_PROVIDER_DELETE_BLOCKED",
          id,
        );
      }

      secretRepo.remove(id);
      repo.remove(id);
    },

    resolveActiveHandle(): AgentLLMHandle | undefined {
      const active = repo.getActive();
      if (!active) return undefined;
      if (!supportedProtocols.has(active.protocol as AgentProtocolId)) {
        return undefined;
      }
      const secret = secretRepo.getById(active.id);
      return registry.create(buildProviderConfig(active, secret?.secret));
    },
  };
}

export type AgentProviderService = ReturnType<typeof createAgentProviderService>;
