import type { FastifyInstance } from "fastify";
import type { ConnectorConfigService } from "@starline/domain";
import { ConnectorConfigUpsertSchema } from "@starline/shared";

export function registerConnectorRoutes(app: FastifyInstance, connectorConfigService: ConnectorConfigService) {
  app.get("/api/connectors", async (_req, reply) => {
    return reply.send({ items: connectorConfigService.list() });
  });

  app.post("/api/connectors", async (req, reply) => {
    const input = ConnectorConfigUpsertSchema.parse(req.body);
    const item = connectorConfigService.upsert(input);
    return reply.code(200).send({ item });
  });
}
