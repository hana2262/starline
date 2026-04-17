import { eq, and, or, isNull, lte, asc, desc, sql, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { generations } from "./schema.js";
import type { Generation } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export type GenerationRow = Generation;
export type GenerationStatus = GenerationRow["status"];

export type GenerationListInput = {
  status?: GenerationStatus;
  connectorId?: string;
  projectId?: string;
  cursor?: { createdAt: string; id: string };
  limit: number;
};

export type GenerationListPage = {
  items: GenerationRow[];
  nextCursor: { createdAt: string; id: string } | null;
};

export function createGenerationRepository(db: Db) {
  return {
    create(input: {
      id?:          string;
      connectorId:  string;
      prompt:       string;
      type:         "image" | "video" | "audio" | "prompt" | "other";
      projectId?:   string | null;
      maxAttempts?: number;
      settings?:    string | null;
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
        cancelReason: null,
        cancelMessage: null,
        cancelRequestedAt: null,
        cancelledAt:  null,
        createdAt:    now(),
        startedAt:    null,
        finishedAt:   null,
        attemptCount: 0,
        maxAttempts:  input.maxAttempts ?? 3,
        nextRetryAt:  null,
        retryable:    null,
        settings:     input.settings ?? null,
      };
      db.insert(generations).values(row).run();
      return row;
    },

    getById(id: string): GenerationRow | undefined {
      return db.select().from(generations).where(eq(generations.id, id)).get();
    },

    markRunning(id: string): void {
      db.update(generations)
        .set({
          status:       "running",
          startedAt:    now(),
          nextRetryAt:  null,
          cancelReason: null,
          cancelMessage: null,
          cancelRequestedAt: null,
          cancelledAt:  null,
          attemptCount: sql`${generations.attemptCount} + 1`,
        })
        .where(eq(generations.id, id))
        .run();
    },

    markSucceeded(id: string, assetId: string): void {
      db.update(generations)
        .set({
          status: "succeeded",
          assetId,
          finishedAt: now(),
          errorCode: null,
          errorMessage: null,
          retryable: null,
          cancelReason: null,
          cancelMessage: null,
          cancelRequestedAt: null,
          cancelledAt: null,
        })
        .where(eq(generations.id, id))
        .run();
    },

    markFailed(id: string, errorCode: string, errorMessage: string, retryable: boolean): void {
      db.update(generations)
        .set({
          status: "failed",
          errorCode,
          errorMessage,
          finishedAt: now(),
          retryable: retryable ? 1 : 0,
          nextRetryAt: null,
          cancelReason: null,
          cancelMessage: null,
          cancelRequestedAt: null,
          cancelledAt: null,
        })
        .where(eq(generations.id, id))
        .run();
    },

    markRetrying(id: string, nextRetryAt: string): void {
      db.update(generations)
        .set({
          status: "queued",
          nextRetryAt,
          startedAt: null,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
          retryable: null,
          cancelReason: null,
          cancelMessage: null,
          cancelRequestedAt: null,
          cancelledAt: null,
        })
        .where(eq(generations.id, id))
        .run();
    },

    requeue(id: string): void {
      db.update(generations)
        .set({
          status:       "queued",
          assetId:      null,
          errorCode:    null,
          errorMessage: null,
          startedAt:    null,
          finishedAt:   null,
          attemptCount: 0,
          nextRetryAt:  null,
          retryable:    null,
          cancelReason: null,
          cancelMessage: null,
          cancelRequestedAt: null,
          cancelledAt:  null,
        })
        .where(eq(generations.id, id))
        .run();
    },

    markCancelling(id: string, cancelReason: string, cancelMessage: string, cancelRequestedAt: string): void {
      db.update(generations)
        .set({
          status: "cancelling",
          cancelReason,
          cancelMessage,
          cancelRequestedAt,
          cancelledAt: null,
        })
        .where(eq(generations.id, id))
        .run();
    },

    markCancelled(id: string, cancelReason: string, cancelMessage: string, cancelRequestedAt: string, cancelledAt: string): void {
      db.update(generations)
        .set({
          status: "cancelled",
          assetId: null,
          errorCode: null,
          errorMessage: null,
          retryable: null,
          nextRetryAt: null,
          finishedAt: cancelledAt,
          cancelReason,
          cancelMessage,
          cancelRequestedAt,
          cancelledAt,
        })
        .where(eq(generations.id, id))
        .run();
    },

    listQueuedReady(nowIso?: string): GenerationRow[] {
      const cutoff = nowIso ?? now();
      return db
        .select()
        .from(generations)
        .where(
          and(
            eq(generations.status, "queued"),
            or(isNull(generations.nextRetryAt), lte(generations.nextRetryAt, cutoff)),
          ),
        )
        .orderBy(asc(generations.createdAt))
        .all();
    },

    listRunning(): GenerationRow[] {
      return db
        .select()
        .from(generations)
        .where(eq(generations.status, "running"))
        .orderBy(asc(generations.createdAt))
        .all();
    },

    listCancelling(): GenerationRow[] {
      return db
        .select()
        .from(generations)
        .where(eq(generations.status, "cancelling"))
        .orderBy(asc(generations.createdAt))
        .all();
    },

    list(input: GenerationListInput): GenerationListPage {
      const conditions = [];

      if (input.status) conditions.push(eq(generations.status, input.status));
      if (input.connectorId) conditions.push(eq(generations.connectorId, input.connectorId));
      if (input.projectId) conditions.push(eq(generations.projectId, input.projectId));
      if (input.cursor) {
        conditions.push(
          or(
            lt(generations.createdAt, input.cursor.createdAt),
            and(eq(generations.createdAt, input.cursor.createdAt), lt(generations.id, input.cursor.id)),
          )!,
        );
      }

      const rows = db
        .select()
        .from(generations)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(generations.createdAt), desc(generations.id))
        .limit(input.limit + 1)
        .all();

      const items = rows.slice(0, input.limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor: rows.length > input.limit && last
          ? { createdAt: last.createdAt, id: last.id }
          : null,
      };
    },
  };
}

export type GenerationRepository = ReturnType<typeof createGenerationRepository>;
