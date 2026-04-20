import type { FastifyInstance } from "fastify";
import type { ProjectService } from "@starline/domain";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@starline/shared";

export function registerProjectRoutes(
  app: FastifyInstance,
  projectService: ProjectService,
) {
  app.post("/api/projects", async (req, reply) => {
    const input = CreateProjectSchema.parse(req.body);
    const project = projectService.create(input);
    return reply.code(201).send(project);
  });

  app.get("/api/projects", async (_req, reply) => {
    const projects = projectService.list();
    return reply.send(projects);
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const project = projectService.getById(req.params.id);
    if (!project) return reply.code(404).send({ error: "Not found" });
    return reply.send(project);
  });

  app.patch<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const input = UpdateProjectSchema.parse(req.body);
    const project = projectService.update(req.params.id, input);
    if (!project) return reply.code(404).send({ error: "Not found" });
    return reply.send(project);
  });

  app.post<{ Params: { id: string } }>("/api/projects/:id/archive", async (req, reply) => {
    const project = projectService.archive(req.params.id);
    if (!project) return reply.code(404).send({ error: "Not found" });
    return reply.send(project);
  });

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (req, reply) => {
    const deleted = projectService.delete(req.params.id);
    if (!deleted) return reply.code(404).send({ error: "Not found" });
    return reply.code(204).send();
  });
}
