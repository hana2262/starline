import Fastify from "fastify";
import type { FastifyBaseLogger } from "fastify";
import path from "path";
import { getDb, getSqlite, createProjectRepository, createAssetRepository, createGenerationRepository, createConnectorConfigRepository, createConnectorSecretRepository, createAgentRepository, createEventRepository } from "@starline/storage";
import { createProjectService, createAssetService, AssetImportError, computeFileHash, createGenerationService, ConnectorError, GenerationRetryError, GenerationCancelError, GenerationListError, createConnectorConfigService, ConnectorConfigError, createAgentService, AgentError, createAnalyticsService, AnalyticsError } from "@starline/domain";
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
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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

export function buildServer(
  dbPath: string,
  options?: { extraConnectors?: Map<string, Connector>; retryBaseMs?: number; generationConcurrency?: number },
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
  const generationRepo = createGenerationRepository(db);
  const connectorConfigRepo = createConnectorConfigRepository(db);
  const connectorSecretRepo = createConnectorSecretRepository(db);
  const agentRepo = createAgentRepository(db);
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
  const agentService = createAgentService(agentRepo, projectRepo, assetRepo, eventRepo);
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
  registerAgentRoutes(app, agentService);
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
    if (err.name === "ZodError") {
      return reply.code(400).send({ error: "Validation error", details: err.message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
