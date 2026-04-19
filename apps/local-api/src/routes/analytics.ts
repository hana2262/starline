import type { FastifyInstance } from "fastify";
import type { AnalyticsService } from "@starline/domain";
import { AnalyticsUsageQuerySchema } from "@starline/shared";

export function registerAnalyticsRoutes(app: FastifyInstance, analyticsService: AnalyticsService) {
  app.get("/api/analytics/overview", async (_req, reply) => {
    const result = analyticsService.getOverview();
    return reply.send(result);
  });

  app.get("/api/analytics/usage", async (req, reply) => {
    const query = AnalyticsUsageQuerySchema.parse(req.query);
    const result = analyticsService.getUsage(query);
    return reply.send(result);
  });
}
