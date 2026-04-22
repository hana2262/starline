import type { FastifyInstance } from "fastify";
import type { AgentService, AgentProviderService } from "@starline/domain";
import { AgentProviderUpsertSchema, AgentQuerySchema } from "@starline/shared";

export function registerAgentRoutes(app: FastifyInstance, agentService: AgentService, agentProviderService: AgentProviderService) {
  app.get("/api/agent/sessions", async (_req, reply) => {
    const result = agentService.listSessions();
    return reply.code(200).send(result);
  });

  app.get("/api/agent/runtime", async (_req, reply) => {
    return reply.code(200).send(agentService.getAgentRuntime());
  });

  app.get("/api/agent/providers", async (_req, reply) => {
    return reply.code(200).send(agentProviderService.list());
  });

  app.post("/api/agent/providers", async (req, reply) => {
    const input = AgentProviderUpsertSchema.parse(req.body);
    const result = agentProviderService.upsert(input);
    return reply.code(200).send(result);
  });

  app.post<{ Params: { id: string } }>("/api/agent/providers/:id/activate", async (req, reply) => {
    const result = agentProviderService.activate(req.params.id);
    return reply.code(200).send(result);
  });

  app.post<{ Params: { id: string } }>("/api/agent/providers/:id/test", async (req, reply) => {
    const result = await agentProviderService.test(req.params.id);
    return reply.code(200).send(result);
  });

  app.delete<{ Params: { id: string } }>("/api/agent/providers/:id", async (req, reply) => {
    agentProviderService.remove(req.params.id);
    return reply.code(204).send();
  });

  app.post("/api/agent/query", async (req, reply) => {
    const input = AgentQuerySchema.parse(req.body);
    const result = await agentService.query(input);
    return reply.code(200).send(result);
  });

  app.get<{ Params: { id: string } }>("/api/agent/sessions/:id", async (req, reply) => {
    const result = agentService.getSession(req.params.id);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return reply.send(result);
  });
}
