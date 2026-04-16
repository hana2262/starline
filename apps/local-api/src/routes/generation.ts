import type { FastifyInstance } from "fastify";
import type { GenerationService } from "@starline/domain";
import { ConnectorError } from "@starline/domain";
import { GenerationSubmitSchema } from "@starline/shared";

export function registerGenerationRoutes(app: FastifyInstance, generationService: GenerationService) {
  app.post<{ Params: { id: string } }>("/api/connectors/:id/test", async (req, reply) => {
    const result = await generationService.test(req.params.id);
    return reply.send(result);
  });

  app.post("/api/generation/submit", async (req, reply) => {
    const input  = GenerationSubmitSchema.parse(req.body);
    const result = await generationService.submit(input);
    return reply.code(result.created ? 201 : 200).send(result);
  });
}

export { ConnectorError };
