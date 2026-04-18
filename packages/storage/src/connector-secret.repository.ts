import { eq } from "drizzle-orm";
import type { Db } from "./db.js";
import { connectorSecrets } from "./schema.js";
import type { ConnectorSecret } from "./schema.js";

function now(): string {
  return new Date().toISOString();
}

export function createConnectorSecretRepository(db: Db) {
  return {
    getById(connectorId: string): ConnectorSecret | undefined {
      return db.select().from(connectorSecrets).where(eq(connectorSecrets.connectorId, connectorId)).get();
    },

    upsert(input: { connectorId: string; secret: string }): ConnectorSecret {
      const existing = this.getById(input.connectorId);
      const timestamp = now();

      if (!existing) {
        const row: ConnectorSecret = {
          connectorId: input.connectorId,
          secret: input.secret,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        db.insert(connectorSecrets).values(row).run();
        return row;
      }

      db.update(connectorSecrets)
        .set({
          secret: input.secret,
          updatedAt: timestamp,
        })
        .where(eq(connectorSecrets.connectorId, input.connectorId))
        .run();

      return this.getById(input.connectorId)!;
    },
  };
}

export type ConnectorSecretRepository = ReturnType<typeof createConnectorSecretRepository>;
