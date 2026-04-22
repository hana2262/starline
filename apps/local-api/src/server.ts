import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import path from "path";
import { getDb, getSqlite, createProjectRepository, createAssetRepository, createGenerationRepository, createConnectorConfigRepository, createConnectorSecretRepository, createAgentRepository, createEventRepository, createAgentProviderConfigRepository, createAgentProviderSecretRepository } from "@starline/storage";
import { createProjectService, createAssetService, AssetImportError, AssetDeleteError, computeFileHash, createGenerationService, ConnectorError, GenerationRetryError, GenerationCancelError, GenerationListError, createConnectorConfigService, ConnectorConfigError, createAgentService, AgentError, createAnalyticsService, AnalyticsError, createDefaultLLMProviderRegistry, createAgentProviderService, AgentProviderConfigError } from "@starline/domain";
import type { LLMProviderConfig } from "@starline/domain";
import { MockConnector } from "@starline/connectors";
import type { Connector } from "@starline/connectors";
import { runMigrations } from "@starline/storage/src/migrate.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerGenerationRoutes } from "./routes/generation.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";
import { buildConfiguredConnectors } from "./connectors.runtime.js";

function setCorsHeaders(reply: { header: (name: string, value: string) => unknown }): void {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
}

function resolveGenerationConcurrency(
  envValue: string | undefined,
  logger: FastifyBaseLogger,
  override?: number,
): number {
  if (override !== undefined) return override;
  if (envValue === undefined) return 1;

  const parsed = Number(envValue);
  if (Number.isInteger(parsed) && parsed >= 2 && parsed <= 4) {
    return parsed;
  }

  logger.warn({
    event: "generation.concurrency.invalid",
    configuredValue: envValue,
    fallback: 1,
  }, "invalid generation concurrency, using default");
  return 1;
}

function isRecoverableTrashPurgeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("no such column") && error.message.includes("origin");
}

function resolveOptionalNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveAgentLLMConfig(env: NodeJS.ProcessEnv, override?: LLMProviderConfig): LLMProviderConfig | undefined {
  if (override) return override;

  const protocol = env["AGENT_LLM_PROVIDER"];
  if (!protocol) return undefined;

  if (protocol === "openai-compatible") {
    const model = env["AGENT_LLM_MODEL"];
    const baseUrl = env["AGENT_LLM_BASE_URL"];
    const apiKey = env["AGENT_LLM_API_KEY"];
    if (!model || !baseUrl || !apiKey) {
      return undefined;
    }

    return {
      vendor: "custom",
      protocol,
      model,
      baseUrl,
      apiKey,
      temperature: resolveOptionalNumber(env["AGENT_LLM_TEMPERATURE"]),
      maxOutputTokens: resolveOptionalNumber(env["AGENT_LLM_MAX_OUTPUT_TOKENS"]),
    };
  }

  if (protocol === "mock") {
    return {
      vendor: "mock",
      protocol,
      model: env["AGENT_LLM_MODEL"] ?? "mock-agent-v1",
      temperature: resolveOptionalNumber(env["AGENT_LLM_TEMPERATURE"]) ?? 0.2,
      maxOutputTokens: resolveOptionalNumber(env["AGENT_LLM_MAX_OUTPUT_TOKENS"]) ?? 512,
    };
  }

  return undefined;
}

export function buildServer(
  dbPath: string,
  options?: {
    extraConnectors?: Map<string, Connector>;
    retryBaseMs?: number;
    generationConcurrency?: number;
    agentLLMConfig?: LLMProviderConfig;
  },
) {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (_req, reply) => {
    setCorsHeaders(reply);
  });

  app.options("/*", async (_req, reply) => {
    setCorsHeaders(reply);
    return reply.code(204).send();
  });

  // Run migrations and wire dependencies
  runMigrations(dbPath);
  const db     = getDb(dbPath);
  const sqlite = getSqlite();

  const assetRepo      = createAssetRepository(db, sqlite);
  const projectRepo = createProjectRepository(db);
  const eventRepo = createEventRepository(db);
  const projectService = createProjectService(projectRepo, assetRepo, eventRepo);
  const assetService   = createAssetService(assetRepo, computeFileHash, eventRepo);
  try {
    const purgeResult = assetService.purgeExpiredTrash();
    if (purgeResult.purgedCount > 0 || purgeResult.deletedFiles > 0) {
      app.log.info({
        event: "asset.trash.purged",
        purgedCount: purgeResult.purgedCount,
        deletedFiles: purgeResult.deletedFiles,
      }, "expired trash assets purged");
    }
  } catch (error) {
    if (!isRecoverableTrashPurgeError(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    app.log.warn({
      event: "asset.trash.purge.skipped",
      reason,
    }, "skipping trash purge until schema columns are available");
  }
  const generationRepo = createGenerationRepository(db);
  const connectorConfigRepo = createConnectorConfigRepository(db);
  const connectorSecretRepo = createConnectorSecretRepository(db);
  const agentRepo = createAgentRepository(db);
  const agentProviderConfigRepo = createAgentProviderConfigRepository(db);
  const agentProviderSecretRepo = createAgentProviderSecretRepository(db);
  const connectorConfigService = createConnectorConfigService(
    connectorConfigRepo,
    connectorSecretRepo,
    {
      minimaxApiKey: process.env["MINIMAX_API_KEY"],
      stableDiffusionBaseUrl: process.env["STABLE_DIFFUSION_BASE_URL"],
    },
  );

  const appDataDir        = path.join(path.dirname(dbPath), "assets");
  const connectorRegistry = new Map<string, Connector>([
    ["mock", new MockConnector()],
  ]);
  buildConfiguredConnectors(
    connectorConfigRepo,
    connectorSecretRepo,
    {
      minimaxApiKey: process.env["MINIMAX_API_KEY"],
      stableDiffusionBaseUrl: process.env["STABLE_DIFFUSION_BASE_URL"],
    },
    app.log,
  ).forEach((connector, id) => connectorRegistry.set(id, connector));

  options?.extraConnectors?.forEach((c, id) => connectorRegistry.set(id, c));
  const generationConcurrency = resolveGenerationConcurrency(
    process.env["GENERATION_CONCURRENCY"],
    app.log,
    options?.generationConcurrency,
  );
  app.log.info({
    event: "generation.concurrency.configured",
    generationConcurrency,
  }, "generation concurrency configured");

  const generationService = createGenerationService(
    connectorRegistry, assetRepo, generationRepo, computeFileHash, appDataDir,
    { retryBaseMs: options?.retryBaseMs, concurrency: generationConcurrency, logger: app.log, eventRepo },
  );
  const llmRegistry = createDefaultLLMProviderRegistry();
  const agentProviderService = createAgentProviderService(agentProviderConfigRepo, agentProviderSecretRepo, llmRegistry);
  const fallbackLLMConfig: LLMProviderConfig = {
    vendor: "mock",
    protocol: "mock",
    model: "mock-agent-v1",
    temperature: 0.2,
    maxOutputTokens: 512,
  };
  const agentService = createAgentService(agentRepo, projectRepo, assetRepo, eventRepo, () => {
    const activeHandle = agentProviderService.resolveActiveHandle();
    if (activeHandle) {
      return activeHandle;
    }

    const configuredLLM = resolveAgentLLMConfig(process.env, options?.agentLLMConfig);
    if (configuredLLM) {
      return llmRegistry.create(configuredLLM);
    }

    return llmRegistry.create(fallbackLLMConfig);
  });
  const activeProvider = agentProviderService.resolveActiveHandle();
  if (activeProvider) {
    app.log.info({
      event: "agent.llm.active_provider",
      vendor: activeProvider.config.vendor,
      protocol: activeProvider.config.protocol,
      model: activeProvider.config.model,
    }, "agent llm provider loaded from active local config");
  } else {
    const configuredLLM = resolveAgentLLMConfig(process.env, options?.agentLLMConfig);
    if (!configuredLLM) {
      app.log.info({
        event: "agent.llm.fallback",
        vendor: fallbackLLMConfig.vendor,
        protocol: fallbackLLMConfig.protocol,
        model: fallbackLLMConfig.model,
      }, "agent llm provider not configured, using mock fallback");
    } else {
      app.log.info({
        event: "agent.llm.configured",
        vendor: configuredLLM.vendor,
        protocol: configuredLLM.protocol,
        model: configuredLLM.model,
      }, "agent llm provider configured from env");
    }
  }
  const analyticsService = createAnalyticsService(eventRepo);

  generationService.recoverPendingJobs();

  // Cancel pending retry timers on server shutdown
  app.addHook("onClose", async () => {
    generationService.queue.destroy();
  });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Feature routes
  registerProjectRoutes(app, projectService);
  registerAssetRoutes(app, assetService);
  registerConnectorRoutes(app, connectorConfigService);
  registerGenerationRoutes(app, generationService);
  registerAgentRoutes(app, agentService, agentProviderService);
  registerAnalyticsRoutes(app, analyticsService);

  // Error handler: ConnectorError → 404/502; AssetImportError → 409/422; ZodError → 400; else → 500
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ConnectorError) {
      const status = err.code === "CONNECTOR_NOT_FOUND" ? 404 : 502;
      return reply.code(status).send({
        error:       err.message,
        code:        err.code,
        connectorId: err.connectorId,
      });
    }
    if (err instanceof ConnectorConfigError) {
      return reply.code(400).send({
        error: err.message,
        code: err.code,
        connectorId: err.connectorId,
      });
    }
    if (err instanceof AgentError) {
      const status = err.code === "SESSION_NOT_FOUND" || err.code === "PROJECT_NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        ...err.details,
      });
    }
    if (err instanceof AgentProviderConfigError) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "UNSUPPORTED_PROTOCOL" || err.code === "ACTIVE_PROVIDER_DELETE_BLOCKED"
            ? 409
            : 400;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        providerConfigId: err.providerConfigId,
      });
    }
    if (err instanceof AnalyticsError) {
      return reply.code(400).send({
        error: err.message,
        code: err.code,
      });
    }
    if (err instanceof GenerationRetryError) {
      const status = err.code === "JOB_NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        jobId: err.jobId,
      });
    }
    if (err instanceof GenerationCancelError) {
      const status = err.code === "JOB_NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        jobId: err.jobId,
      });
    }
    if (err instanceof GenerationListError) {
      return reply.code(400).send({
        error: err.message,
        code: err.code,
      });
    }
    if (err instanceof AssetImportError) {
      const status = err.code === "PATH_CONFLICT" ? 409 : 422;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        ...(err.existingAssetId ? { existingAssetId: err.existingAssetId } : {}),
      });
    }
    if (err instanceof AssetDeleteError) {
      const status = err.code === "ASSET_NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
      });
    }
    if (err.name === "ZodError") {
      return reply.code(400).send({ error: "Validation error", details: err.message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
