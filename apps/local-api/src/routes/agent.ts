import type { FastifyInstance } from "fastify";
import type { AgentService } from "@starline/domain";
import { AgentQuerySchema } from "@starline/shared";

export function registerAgentRoutes(app: FastifyInstance, agentService: AgentService) {
  app.post("/api/agent/query", async (req, reply) => {
    const input = AgentQuerySchema.parse(req.body);
    const result = agentService.query(input);
    return reply.code(200).send(result);
  });

  app.get<{ Params: { id: string } }>("/api/agent/sessions/:id", async (req, reply) => {
    const result = agentService.getSession(req.params.id);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return reply.send(result);
  });
}
