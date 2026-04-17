import type { FastifyInstance } from "fastify";
import type { GenerationService } from "@starline/domain";
import { ConnectorError } from "@starline/domain";
import { GenerationSubmitSchema } from "@starline/shared";

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
}

export { ConnectorError };
