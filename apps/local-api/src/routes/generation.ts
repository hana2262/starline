import type { FastifyInstance } from "fastify";
import type { GenerationService } from "@starline/domain";
import { ConnectorError, GenerationRetryError, GenerationCancelError, GenerationListError } from "@starline/domain";
import { GenerationSubmitSchema, GenerationListQuerySchema } from "@starline/shared";

export function registerGenerationRoutes(app: FastifyInstance, generationService: GenerationService) {
  // Connector health check
  app.post<{ Params: { id: string } }>("/api/connectors/:id/test", async (req, reply) => {
    const result = await generationService.test(req.params.id);
    return reply.send(result);
  });

  // Submit generation job — always 202 Accepted (async processing)
  app.post("/api/generation/submit", async (req, reply) => {
    const input  = GenerationSubmitSchema.parse(req.body);
    const result = await generationService.enqueue(input);
    return reply.code(202).send(result);
  });

  // Get generation job by ID
  app.get<{ Params: { id: string } }>("/api/generation/:id", async (req, reply) => {
    const job = generationService.getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: "Not found" });
    return reply.send({ job });
  });

  app.get("/api/generation", async (req, reply) => {
    const query = GenerationListQuerySchema.parse(req.query);
    const result = generationService.listJobs(query);
    return reply.send(result);
  });

  app.get("/api/generation/metrics", async (_req, reply) => {
    const result = generationService.getMetrics();
    return reply.send(result);
  });

  app.post<{ Params: { id: string } }>("/api/generation/:id/retry", async (req, reply) => {
    const result = generationService.retry(req.params.id);
    return reply.code(202).send(result);
  });

  app.post<{ Params: { id: string } }>("/api/generation/:id/cancel", async (req, reply) => {
    const result = generationService.cancel(req.params.id);
    return reply.code(202).send(result);
  });
}

export { ConnectorError, GenerationRetryError, GenerationCancelError, GenerationListError };
