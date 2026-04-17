import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { generations } from "./schema.js";
import type { Generation } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export type GenerationRow = Generation;

export function createGenerationRepository(db: Db) {
  return {
    create(input: {
      id?:         string;
      connectorId: string;
      prompt:      string;
      type:        "image" | "video" | "audio" | "prompt" | "other";
      projectId?:  string | null;
    }): GenerationRow {
      const row: GenerationRow = {
        id:           input.id ?? randomUUID(),
        connectorId:  input.connectorId,
        prompt:       input.prompt,
        type:         input.type,
        projectId:    input.projectId ?? null,
        status:       "queued",
        assetId:      null,
        errorCode:    null,
        errorMessage: null,
        createdAt:    now(),
        startedAt:    null,
        finishedAt:   null,
      };
      db.insert(generations).values(row).run();
      return row;
    },

    getById(id: string): GenerationRow | undefined {
      return db.select().from(generations).where(eq(generations.id, id)).get();
    },

    markRunning(id: string): void {
      db.update(generations)
        .set({ status: "running", startedAt: now() })
        .where(eq(generations.id, id))
        .run();
    },

    markSucceeded(id: string, assetId: string): void {
      db.update(generations)
        .set({ status: "succeeded", assetId, finishedAt: now() })
        .where(eq(generations.id, id))
        .run();
    },

    markFailed(id: string, errorCode: string, errorMessage: string): void {
      db.update(generations)
        .set({ status: "failed", errorCode, errorMessage, finishedAt: now() })
        .where(eq(generations.id, id))
        .run();
    },
  };
}

export type GenerationRepository = ReturnType<typeof createGenerationRepository>;
