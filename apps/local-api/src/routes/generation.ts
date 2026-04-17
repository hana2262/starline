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

  // Submit generation job — 201 on succeeded, 502 on failed
  app.post("/api/generation/submit", async (req, reply) => {
    const input  = GenerationSubmitSchema.parse(req.body);
    const result = await generationService.submit(input);
    const status = result.job.status === "succeeded" ? 201 : 502;
    return reply.code(status).send(result);
  });

  // Get generation job by ID
  app.get<{ Params: { id: string } }>("/api/generation/:id", async (req, reply) => {
    const job = generationService.getJob(req.params.id);
    if (!job) return reply.code(404).send({ error: "Not found" });
    return reply.send({ job });
  });
}

export { ConnectorError };
