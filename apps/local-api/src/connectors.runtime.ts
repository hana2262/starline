import { MinimaxConnector, StableDiffusionConnector } from "@starline/connectors";
import type { Connector } from "@starline/connectors";
import type { ConnectorConfigRepository, ConnectorSecretRepository } from "@starline/storage";
import { StableDiffusionConnectorConfigSchema } from "@starline/shared";

type Logger = {
  warn: (obj: Record<string, unknown>, msg: string) => void;
};

export function buildConfiguredConnectors(
  repo: ConnectorConfigRepository,
  secretRepo: ConnectorSecretRepository,
  env: {
    minimaxApiKey?: string;
    stableDiffusionBaseUrl?: string;
  },
  logger: Logger,
): Map<string, Connector> {
  const configured = new Map<string, Connector>();
  const persisted = new Map(repo.list().map((row) => [row.connectorId, row]));

  const minimaxRow = persisted.get("minimax");
  if (minimaxRow) {
    if (minimaxRow.enabled) {
      try {
        const secret = secretRepo.getById("minimax");
        if (!secret?.secret) {
          throw new Error("Missing stored secret");
        }
        configured.set("minimax", new MinimaxConnector(secret.secret));
      } catch (error) {
        logger.warn({
          event: "connector.config.invalid",
          connectorId: "minimax",
          source: "db",
          error: (error as Error).message,
        }, "skipping invalid persisted connector config");
      }
    }
  } else if (env.minimaxApiKey) {
    configured.set("minimax", new MinimaxConnector(env.minimaxApiKey));
  }

  const stableDiffusionRow = persisted.get("stable-diffusion");
  if (stableDiffusionRow) {
    if (stableDiffusionRow.enabled) {
      try {
        const config = StableDiffusionConnectorConfigSchema.parse(JSON.parse(stableDiffusionRow.config));
        configured.set("stable-diffusion", new StableDiffusionConnector(config.baseUrl));
      } catch (error) {
        logger.warn({
          event: "connector.config.invalid",
          connectorId: "stable-diffusion",
          source: "db",
          error: (error as Error).message,
        }, "skipping invalid persisted connector config");
      }
    }
  } else if (env.stableDiffusionBaseUrl) {
    configured.set("stable-diffusion", new StableDiffusionConnector(env.stableDiffusionBaseUrl));
  }

  return configured;
}
