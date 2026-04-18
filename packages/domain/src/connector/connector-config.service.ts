import type { ConnectorConfigRepository, ConnectorSecretRepository } from "@starline/storage";
import { MinimaxConnectorConfigSchema, type ConnectorConfigUpsertInput, type ConnectorConfigView, type StableDiffusionConnectorConfig } from "@starline/shared";

export class ConnectorConfigError extends Error {
  constructor(
    message: string,
    public readonly code: "SECRET_REQUIRED",
    public readonly connectorId: string,
  ) {
    super(message);
    this.name = "ConnectorConfigError";
  }
}

function buildMinimaxView(
  enabled: boolean,
  source: "db" | "env",
  hasStoredSecret: boolean,
  createdAt: string,
  updatedAt: string,
): ConnectorConfigView {
  return {
    connectorId: "minimax",
    enabled,
    source,
    config: {},
    hasSensitiveConfig: true,
    hasStoredSecret,
    createdAt,
    updatedAt,
  };
}

function buildStableDiffusionView(
  enabled: boolean,
  source: "db" | "env",
  config: StableDiffusionConnectorConfig,
  hasStoredSecret: boolean,
  createdAt: string,
  updatedAt: string,
): ConnectorConfigView {
  return {
    connectorId: "stable-diffusion",
    enabled,
    source,
    config,
    hasSensitiveConfig: false,
    hasStoredSecret,
    createdAt,
    updatedAt,
  };
}

export type ConnectorEnvFallbacks = {
  minimaxApiKey?: string;
  stableDiffusionBaseUrl?: string;
};

export function createConnectorConfigService(
  repo: ConnectorConfigRepository,
  secretRepo: ConnectorSecretRepository,
  env: ConnectorEnvFallbacks,
) {
  return {
    list(): ConnectorConfigView[] {
      const persisted = repo.list();
      const items = new Map<ConnectorConfigView["connectorId"], ConnectorConfigView>();

      for (const row of persisted) {
        try {
          if (row.connectorId === "minimax") {
            const secret = secretRepo.getById("minimax");
            items.set("minimax", buildMinimaxView(row.enabled, "db", secret !== undefined, row.createdAt, row.updatedAt));
            continue;
          }

          if (row.connectorId === "stable-diffusion") {
            const config = JSON.parse(row.config) as StableDiffusionConnectorConfig;
            items.set(
              "stable-diffusion",
              buildStableDiffusionView(row.enabled, "db", config, false, row.createdAt, row.updatedAt),
            );
          }
        } catch {
          continue;
        }
      }

      const now = new Date().toISOString();
      if (!items.has("minimax") && env.minimaxApiKey) {
        items.set("minimax", buildMinimaxView(true, "env", true, now, now));
      }

      if (!items.has("stable-diffusion") && env.stableDiffusionBaseUrl) {
        items.set(
          "stable-diffusion",
          buildStableDiffusionView(
            true,
            "env",
            { baseUrl: env.stableDiffusionBaseUrl },
            false,
            now,
            now,
          ),
        );
      }

      return Array.from(items.values());
    },

    upsert(input: ConnectorConfigUpsertInput): ConnectorConfigView {
      const persistedConfig = input.connectorId === "minimax"
        ? "{}"
        : JSON.stringify(input.config);
      const saved = repo.upsert({
        connectorId: input.connectorId,
        enabled: input.enabled,
        config: persistedConfig,
      });

      if (input.connectorId === "minimax") {
        const config = MinimaxConnectorConfigSchema.parse(input.config);
        if (config.apiKey) {
          secretRepo.upsert({
            connectorId: "minimax",
            secret: config.apiKey,
          });
        } else if (!secretRepo.getById("minimax")) {
          throw new ConnectorConfigError(
            "MiniMax API key is required before this connector can be enabled or saved.",
            "SECRET_REQUIRED",
            "minimax",
          );
        }
        return buildMinimaxView(saved.enabled, "db", true, saved.createdAt, saved.updatedAt);
      }

      return buildStableDiffusionView(
        saved.enabled,
        "db",
        input.config,
        false,
        saved.createdAt,
        saved.updatedAt,
      );
    },
  };
}

export type ConnectorConfigService = ReturnType<typeof createConnectorConfigService>;
