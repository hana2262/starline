import type { AssetRepository, EventRepository, ProjectRepository } from "@starline/storage";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectResponse,
} from "@starline/shared";

function toResponse(row: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  visibility: "public" | "private";
  createdAt: string;
  updatedAt: string;
}): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createProjectService(
  repo: ProjectRepository,
  assetRepo?: AssetRepository,
  eventRepo?: EventRepository,
) {
  return {
    create(input: CreateProjectInput): ProjectResponse {
      const row = repo.create(input);
      eventRepo?.create({
        eventType: "project.created",
        entityType: "project",
        entityId: row.id,
        projectId: row.id,
        payload: {
          status: row.status,
          visibility: row.visibility,
        },
      });
      return toResponse(row);
    },

    list(): ProjectResponse[] {
      return repo.list().map(toResponse);
    },

    getById(id: string): ProjectResponse | null {
      const row = repo.getById(id);
      return row ? toResponse(row) : null;
    },

    update(id: string, input: UpdateProjectInput): ProjectResponse | null {
      const row = repo.update(id, input);
      return row ? toResponse(row) : null;
    },

    archive(id: string): ProjectResponse | null {
      const row = repo.archive(id);
      return row ? toResponse(row) : null;
    },

    delete(id: string): boolean {
      const existing = repo.getById(id);
      if (!existing) return false;

      assetRepo?.clearProject(id);
      return repo.delete(id);
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
