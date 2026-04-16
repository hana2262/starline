import Fastify from "fastify";
import { getDb, createProjectRepository } from "@starline/storage";
import { createProjectService } from "@starline/domain";
import { runMigrations } from "@starline/storage/src/migrate.js";
import { registerProjectRoutes } from "./routes/projects.js";

export function buildServer(dbPath: string) {
  const app = Fastify({ logger: true });

  // Run migrations and wire dependencies
  runMigrations(dbPath);
  const db = getDb(dbPath);
  const projectRepo = createProjectRepository(db);
  const projectService = createProjectService(projectRepo);

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Feature routes
  registerProjectRoutes(app, projectService);

  // Zod validation errors → 400
  app.setErrorHandler((err, _req, reply) => {
    if (err.name === "ZodError") {
      return reply.code(400).send({ error: "Validation error", details: err.message });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
