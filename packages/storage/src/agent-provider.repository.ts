import { eq } from "drizzle-orm";
import type { Db } from "./db.js";
import { agentProviderConfigs } from "./schema.js";
import type { AgentProviderConfig } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export function createAgentProviderConfigRepository(db: Db) {
  return {
    list(): AgentProviderConfig[] {
      return db.select().from(agentProviderConfigs).all();
    },

    getById(id: string): AgentProviderConfig | undefined {
      return db.select().from(agentProviderConfigs).where(eq(agentProviderConfigs.id, id)).get();
    },

    getActive(): AgentProviderConfig | undefined {
      return db.select().from(agentProviderConfigs).where(eq(agentProviderConfigs.isActive, true)).get();
    },

    upsert(input: {
      id: string;
      slug: string;
      provider: string;
      vendor: string;
      protocol: string;
      label: string;
      note: string | null;
      website: string | null;
      baseUrl: string | null;
      model: string;
      temperature: string | null;
      maxOutputTokens: number | null;
      isActive: boolean;
    }): AgentProviderConfig {
      const existing = this.getById(input.id);
      const timestamp = now();

      if (input.isActive) {
        db.update(agentProviderConfigs).set({ isActive: false, updatedAt: timestamp }).run();
      }

      if (!existing) {
        const row: AgentProviderConfig = {
          id: input.id,
          slug: input.slug,
          provider: input.provider,
          vendor: input.vendor,
          protocol: input.protocol,
          label: input.label,
          note: input.note,
          website: input.website,
          baseUrl: input.baseUrl,
          model: input.model,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
          isActive: input.isActive,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        db.insert(agentProviderConfigs).values(row).run();
        return row;
      }

      db.update(agentProviderConfigs)
        .set({
          slug: input.slug,
          provider: input.provider,
          vendor: input.vendor,
          protocol: input.protocol,
          label: input.label,
          note: input.note,
          website: input.website,
          baseUrl: input.baseUrl,
          model: input.model,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
          isActive: input.isActive,
          updatedAt: timestamp,
        })
        .where(eq(agentProviderConfigs.id, input.id))
        .run();

      return this.getById(input.id)!;
    },

    activate(id: string): AgentProviderConfig | undefined {
      const existing = this.getById(id);
      if (!existing) return undefined;
      const timestamp = now();
      db.update(agentProviderConfigs).set({ isActive: false, updatedAt: timestamp }).run();
      db.update(agentProviderConfigs)
        .set({ isActive: true, updatedAt: timestamp })
        .where(eq(agentProviderConfigs.id, id))
        .run();
      return this.getById(id);
    },

    remove(id: string): boolean {
      const existing = this.getById(id);
      if (!existing) return false;
      db.delete(agentProviderConfigs).where(eq(agentProviderConfigs.id, id)).run();
      return true;
    },
  };
}

export type AgentProviderConfigRepository = ReturnType<typeof createAgentProviderConfigRepository>;
