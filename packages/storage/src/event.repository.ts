import { and, asc, eq, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { events } from "./schema.js";
import type { Event, NewEvent } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

function serializePayload(payload: Record<string, unknown> | undefined): string {
  return JSON.stringify(payload ?? {});
}

function deserializePayload(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export type EventRow = Omit<Event, "payload"> & { payload: Record<string, unknown> };

function toEventRow(row: Event): EventRow {
  return {
    ...row,
    payload: deserializePayload(row.payload),
  };
}

export function createEventRepository(db: Db) {
  return {
    create(input: {
      eventType: string;
      entityType: string;
      entityId?: string | null;
      projectId?: string | null;
      payload?: Record<string, unknown>;
    }): EventRow {
      const row: NewEvent = {
        id: randomUUID(),
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        projectId: input.projectId ?? null,
        payload: serializePayload(input.payload),
        createdAt: now(),
      };

      db.insert(events).values(row).run();
      return toEventRow(row as Event);
    },

    list(): EventRow[] {
      return db.select()
        .from(events)
        .orderBy(asc(events.createdAt), asc(events.id))
        .all()
        .map(toEventRow);
    },

    listByType(eventType: string): EventRow[] {
      return db.select()
        .from(events)
        .where(eq(events.eventType, eventType))
        .orderBy(asc(events.createdAt), asc(events.id))
        .all()
        .map(toEventRow);
    },

    listInRange(input: { from: string; to: string }): EventRow[] {
      return db.select()
        .from(events)
        .where(and(gte(events.createdAt, input.from), lte(events.createdAt, input.to)))
        .orderBy(asc(events.createdAt), asc(events.id))
        .all()
        .map(toEventRow);
    },
  };
}

export type EventRepository = ReturnType<typeof createEventRepository>;
