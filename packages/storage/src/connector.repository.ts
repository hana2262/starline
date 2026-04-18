import { eq } from "drizzle-orm";
import type { Db } from "./db.js";
import { connectorConfigs } from "./schema.js";
import type { ConnectorConfig } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export function createConnectorConfigRepository(db: Db) {
  return {
    list(): ConnectorConfig[] {
      return db.select().from(connectorConfigs).all();
    },

    getById(connectorId: string): ConnectorConfig | undefined {
      return db.select().from(connectorConfigs).where(eq(connectorConfigs.connectorId, connectorId)).get();
    },

    upsert(input: { connectorId: string; enabled: boolean; config: string }): ConnectorConfig {
      const existing = this.getById(input.connectorId);
      const timestamp = now();

      if (!existing) {
        const row: ConnectorConfig = {
          connectorId: input.connectorId,
          enabled: input.enabled,
          config: input.config,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        db.insert(connectorConfigs).values(row).run();
        return row;
      }

      db.update(connectorConfigs)
        .set({
          enabled: input.enabled,
          config: input.config,
          updatedAt: timestamp,
        })
        .where(eq(connectorConfigs.connectorId, input.connectorId))
        .run();

      return this.getById(input.connectorId)!;
    },
  };
}

export type ConnectorConfigRepository = ReturnType<typeof createConnectorConfigRepository>;
