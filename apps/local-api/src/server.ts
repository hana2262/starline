import Fastify from "fastify";
import path from "path";
import { getDb, getSqlite, createProjectRepository, createAssetRepository, createGenerationRepository } from "@starline/storage";
import { createProjectService, createAssetService, AssetImportError, computeFileHash, createGenerationService, ConnectorError, GenerationRetryError } from "@starline/domain";
import { MockConnector, MinimaxConnector } from "@starline/connectors";
import type { Connector } from "@starline/connectors";
import { runMigrations } from "@starline/storage/src/migrate.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerAssetRoutes } from "./routes/assets.js";
import { registerGenerationRoutes } from "./routes/generation.js";

export function buildServer(
  dbPath: string,
  options?: { extraConnectors?: Map<string, Connector>; retryBaseMs?: number },
) {
  const app = Fastify({ logger: true });

  // Run migrations and wire dependencies
  runMigrations(dbPath);
  const db     = getDb(dbPath);
  const sqlite = getSqlite();

  const projectRepo = createProjectRepository(db);
  const projectService = createProjectService(projectRepo);

  const assetRepo      = createAssetRepository(db, sqlite);
  const assetService   = createAssetService(assetRepo, computeFileHash);
  const generationRepo = createGenerationRepository(db);

  const appDataDir        = path.join(path.dirname(dbPath), "assets");
  const connectorRegistry = new Map<string, Connector>([
    ["mock", new MockConnector()],
  ]);

  const minimaxKey = process.env["MINIMAX_API_KEY"];
  if (minimaxKey) {
    connectorRegistry.set("minimax", new MinimaxConnector(minimaxKey));
  }

  options?.extraConnectors?.forEach((c, id) => connectorRegistry.set(id, c));

  const generationService = createGenerationService(
    connectorRegistry, assetRepo, generationRepo, computeFileHash, appDataDir,
    { retryBaseMs: options?.retryBaseMs },
  );

  // Cancel pending retry timers on server shutdown
  app.addHook("onClose", async () => {
    generationService.queue.destroy();
  });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Feature routes
  registerProjectRoutes(app, projectService);
  registerAssetRoutes(app, assetService);
  registerGenerationRoutes(app, generationService);

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
    if (err instanceof GenerationRetryError) {
      const status = err.code === "JOB_NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({
        error: err.message,
        code: err.code,
        jobId: err.jobId,
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
