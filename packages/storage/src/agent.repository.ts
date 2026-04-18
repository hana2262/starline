import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "./db.js";
import { agentMessages, agentSessions } from "./schema.js";
import type { AgentMessage, AgentSession, NewAgentMessage, NewAgentSession } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

function serializeIds(ids: string[]): string {
  return JSON.stringify(ids);
}

function deserializeIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export type AgentMessageRow = Omit<AgentMessage, "relatedAssetIds"> & {
  relatedAssetIds: string[];
};

function toMessageRow(row: AgentMessage): AgentMessageRow {
  return {
    ...row,
    relatedAssetIds: deserializeIds(row.relatedAssetIds),
  };
}

export function createAgentRepository(db: Db) {
  return {
    createSession(input: { projectId?: string | null; title: string }): AgentSession {
      const timestamp = now();
      const row: NewAgentSession = {
        id: randomUUID(),
        projectId: input.projectId ?? null,
        title: input.title,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      db.insert(agentSessions).values(row).run();
      return row as AgentSession;
    },

    getSessionById(id: string): AgentSession | undefined {
      return db.select().from(agentSessions).where(eq(agentSessions.id, id)).get();
    },

    touchSession(id: string): AgentSession | undefined {
      db.update(agentSessions)
        .set({ updatedAt: now() })
        .where(eq(agentSessions.id, id))
        .run();

      return this.getSessionById(id);
    },

    createMessage(input: {
      sessionId: string;
      role: "user" | "assistant";
      content: string;
      relatedAssetIds?: string[];
    }): AgentMessageRow {
      const row: NewAgentMessage = {
        id: randomUUID(),
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        relatedAssetIds: serializeIds(input.relatedAssetIds ?? []),
        createdAt: now(),
      };

      db.insert(agentMessages).values(row).run();
      db.update(agentSessions)
        .set({ updatedAt: row.createdAt })
        .where(eq(agentSessions.id, input.sessionId))
        .run();

      return toMessageRow(row as AgentMessage);
    },

    listMessagesBySession(sessionId: string): AgentMessageRow[] {
      return db.select()
        .from(agentMessages)
        .where(eq(agentMessages.sessionId, sessionId))
        .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id))
        .all()
        .map(toMessageRow);
    },

    listMessagesBySessionAndRole(sessionId: string, role: "user" | "assistant"): AgentMessageRow[] {
      return db.select()
        .from(agentMessages)
        .where(and(eq(agentMessages.sessionId, sessionId), eq(agentMessages.role, role)))
        .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id))
        .all()
        .map(toMessageRow);
    },
  };
}

export type AgentRepository = ReturnType<typeof createAgentRepository>;
