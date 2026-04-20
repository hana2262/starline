import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { projects } from "./schema.js";
import type { Project, NewProject } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export function createProjectRepository(db: Db) {
  return {
    create(input: {
      name: string;
      description?: string | null;
      visibility?: "public" | "private";
    }): Project {
      const row: NewProject = {
        id: randomUUID(),
        name: input.name,
        description: input.description ?? null,
        status: "active",
        visibility: input.visibility ?? "public",
        createdAt: now(),
        updatedAt: now(),
      };
      db.insert(projects).values(row).run();
      return row as Project;
    },

    list(): Project[] {
      return db.select().from(projects).all();
    },

    getById(id: string): Project | undefined {
      return db.select().from(projects).where(eq(projects.id, id)).get();
    },

    update(
      id: string,
      input: {
        name?: string;
        description?: string | null;
        visibility?: "public" | "private";
      },
    ): Project | undefined {
      const existing = this.getById(id);
      if (!existing) return undefined;
      const updated = {
        ...input,
        updatedAt: now(),
      };
      db.update(projects).set(updated).where(eq(projects.id, id)).run();
      return this.getById(id);
    },

    archive(id: string): Project | undefined {
      const existing = this.getById(id);
      if (!existing) return undefined;
      db.update(projects)
        .set({ status: "archived", updatedAt: now() })
        .where(eq(projects.id, id))
        .run();
      return this.getById(id);
    },
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
