import type { FastifyInstance, FastifyReply } from "fastify";
import type { AgentService, AgentProviderService } from "@starline/domain";
import { AgentProviderUpsertSchema, AgentQuerySchema } from "@starline/shared";

export function registerAgentRoutes(app: FastifyInstance, agentService: AgentService, agentProviderService: AgentProviderService) {
  function writeSse(reply: FastifyReply, event: string, payload: unknown) {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

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

  app.post("/api/agent/query/stream", async (req, reply) => {
    const input = AgentQuerySchema.parse(req.body);

    reply.hijack();
    reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    writeSse(reply, "ack", { ok: true });

    try {
      const result = await agentService.queryStream(input, {
        onSessionReady(payload) {
          writeSse(reply, "metadata", payload);
        },
        onAssistantDelta(delta) {
          writeSse(reply, "assistant_delta", { delta });
        },
      });

      writeSse(reply, "done", result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent streaming failed";
      writeSse(reply, "error", { message });
    } finally {
      reply.raw.end();
    }
  });

  app.get<{ Params: { id: string } }>("/api/agent/sessions/:id", async (req, reply) => {
    const result = agentService.getSession(req.params.id);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return reply.send(result);
  });
}
