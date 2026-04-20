import { createReadStream, existsSync, statSync } from "fs";
import type { FastifyInstance } from "fastify";
import type { AssetService } from "@starline/domain";
import { AssetImportError } from "@starline/domain";
import { ImportAssetFolderSchema, ImportAssetSchema, ListAssetsQuerySchema, UpdateAssetSchema } from "@starline/shared";

export function registerAssetRoutes(app: FastifyInstance, assetService: AssetService) {
  app.post("/api/assets/import", async (req, reply) => {
    const input = ImportAssetSchema.parse(req.body);
    const result = await assetService.import(input);
    const status = result.created ? 201 : 200;
    return reply.code(status).send(result);
  });

  app.post("/api/assets/import-folder", async (req, reply) => {
    const input = ImportAssetFolderSchema.parse(req.body);
    const result = await assetService.importFolder(input);
    return reply.code(200).send(result);
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

  app.patch<{ Params: { id: string } }>("/api/assets/:id", async (req, reply) => {
    const input = UpdateAssetSchema.parse(req.body);
    const asset = assetService.update(req.params.id, input);
    if (!asset) return reply.code(404).send({ error: "Not found" });
    return reply.send(asset);
  });

  app.get<{ Params: { id: string } }>("/api/assets/:id/content", async (req, reply) => {
    const asset = assetService.getById(req.params.id);
    if (!asset) return reply.code(404).send({ error: "Not found" });
    if (!existsSync(asset.filePath)) {
      return reply.code(404).send({ error: "Asset file not found" });
    }

    const fileStat = statSync(asset.filePath);
    const mimeType = asset.mimeType ?? "application/octet-stream";
    const rangeHeader = req.headers.range;

    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Type", mimeType);
    reply.header("Cache-Control", "no-store");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(asset.name)}"`);

    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (!match) {
        return reply.code(416).send({ error: "Invalid range" });
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : fileStat.size - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileStat.size) {
        return reply.code(416).send({ error: "Invalid range" });
      }

      reply.code(206);
      reply.header("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);
      reply.header("Content-Length", String(end - start + 1));
      return reply.send(createReadStream(asset.filePath, { start, end }));
    }

    reply.header("Content-Length", String(fileStat.size));
    return reply.send(createReadStream(asset.filePath));
  });
}

// Re-export error class so server.ts can reference it in the error handler
export { AssetImportError };
