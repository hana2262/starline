import Fastify from "fastify";
import { getDb, createProjectRepository, createAssetRepository } from "@starline/storage";
import { createProjectService, createAssetService, AssetImportError, computeFileHash } from "@starline/domain";
import { runMigrations } from "@starline/storage/src/migrate.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerAssetRoutes } from "./routes/assets.js";

export function buildServer(dbPath: string) {
  const app = Fastify({ logger: true });

  // Run migrations and wire dependencies
  runMigrations(dbPath);
  const db = getDb(dbPath);

  const projectRepo = createProjectRepository(db);
  const projectService = createProjectService(projectRepo);

  const assetRepo = createAssetRepository(db);
  const assetService = createAssetService(assetRepo, computeFileHash);

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Feature routes
  registerProjectRoutes(app, projectService);
  registerAssetRoutes(app, assetService);

  // Error handler: AssetImportError → 409 or 422; ZodError → 400; else → 500
  app.setErrorHandler((err, _req, reply) => {
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
