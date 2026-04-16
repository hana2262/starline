import type { FastifyInstance } from "fastify";
import type { AssetService } from "@starline/domain";
import { AssetImportError } from "@starline/domain";
import { ImportAssetSchema, ListAssetsQuerySchema } from "@starline/shared";

export function registerAssetRoutes(app: FastifyInstance, assetService: AssetService) {
  app.post("/api/assets/import", async (req, reply) => {
    const input = ImportAssetSchema.parse(req.body);
    const result = await assetService.import(input);
    const status = result.created ? 201 : 200;
    return reply.code(status).send(result);
  });

  app.get("/api/assets", async (req, reply) => {
    const filters = ListAssetsQuerySchema.parse(req.query);
    const result = assetService.list(filters);
    return reply.send(result);
  });

  app.get<{ Params: { id: string } }>("/api/assets/:id", async (req, reply) => {
    const asset = assetService.getById(req.params.id);
    if (!asset) return reply.code(404).send({ error: "Not found" });
    return reply.send(asset);
  });
}

// Re-export error class so server.ts can reference it in the error handler
export { AssetImportError };
