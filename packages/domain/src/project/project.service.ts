import type { ProjectRepository } from "@starline/storage";
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
  createdAt: string;
  updatedAt: string;
}): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createProjectService(repo: ProjectRepository) {
  return {
    create(input: CreateProjectInput): ProjectResponse {
      const row = repo.create(input);
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
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
