import { eq } from "drizzle-orm";
import type { Db } from "./db.js";
import { agentProviderSecrets } from "./schema.js";
import type { AgentProviderSecret } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export function createAgentProviderSecretRepository(db: Db) {
  return {
    getById(providerConfigId: string): AgentProviderSecret | undefined {
      return db.select().from(agentProviderSecrets).where(eq(agentProviderSecrets.providerConfigId, providerConfigId)).get();
    },

    upsert(input: { providerConfigId: string; secret: string }): AgentProviderSecret {
      const existing = this.getById(input.providerConfigId);
      const timestamp = now();

      if (!existing) {
        const row: AgentProviderSecret = {
          providerConfigId: input.providerConfigId,
          secret: input.secret,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        db.insert(agentProviderSecrets).values(row).run();
        return row;
      }

      db.update(agentProviderSecrets)
        .set({
          secret: input.secret,
          updatedAt: timestamp,
        })
        .where(eq(agentProviderSecrets.providerConfigId, input.providerConfigId))
        .run();

      return this.getById(input.providerConfigId)!;
    },

    remove(providerConfigId: string): boolean {
      const existing = this.getById(providerConfigId);
      if (!existing) return false;
      db.delete(agentProviderSecrets).where(eq(agentProviderSecrets.providerConfigId, providerConfigId)).run();
      return true;
    },
  };
}

export type AgentProviderSecretRepository = ReturnType<typeof createAgentProviderSecretRepository>;
