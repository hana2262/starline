import type { EventRepository } from "@starline/storage";
import type { AnalyticsOverview, AnalyticsUsage, AnalyticsUsagePoint, AnalyticsUsageQuery } from "@starline/shared";

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_RANGE",
  ) {
    super(message);
    this.name = "AnalyticsError";
  }
}

type ConnectorAggregate = AnalyticsOverview["generationByConnector"][string];

function emptyConnectorAggregate(): ConnectorAggregate {
  return {
    submitted: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
}

function emptyUsagePoint(date: string): AnalyticsUsagePoint {
  return {
    date,
    projectsCreated: 0,
    assetsImported: 0,
    agentQueries: 0,
    generationSubmitted: 0,
    generationCompleted: 0,
    generationFailed: 0,
    generationCancelled: 0,
  };
}

function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function listDayKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${toDayKey(from)}T00:00:00.000Z`);
  const end = new Date(`${toDayKey(to)}T00:00:00.000Z`);

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function ensureValidRange(query: AnalyticsUsageQuery): void {
  if (new Date(query.from).getTime() > new Date(query.to).getTime()) {
    throw new AnalyticsError("Analytics usage range is invalid.", "INVALID_RANGE");
  }
}

function connectorIdFromPayload(payload: Record<string, unknown>): string | null {
  return typeof payload["connectorId"] === "string" ? payload["connectorId"] : null;
}

export function createAnalyticsService(eventRepo: EventRepository) {
  return {
    getOverview(): AnalyticsOverview {
      const events = eventRepo.list();
      const generationByConnector: AnalyticsOverview["generationByConnector"] = {};

      const overview: AnalyticsOverview = {
        totals: {
          projectsCreated: 0,
          assetsImported: 0,
          agentQueries: 0,
          generationSubmitted: 0,
          generationCompleted: 0,
          generationFailed: 0,
          generationCancelled: 0,
        },
        generationByConnector,
        latestEventAt: events.at(-1)?.createdAt ?? null,
      };

      for (const event of events) {
        switch (event.eventType) {
          case "project.created":
            overview.totals.projectsCreated++;
            break;
          case "asset.imported":
            overview.totals.assetsImported++;
            break;
          case "agent.queried":
            overview.totals.agentQueries++;
            break;
          case "generation.submitted":
          case "generation.completed":
          case "generation.failed":
          case "generation.cancelled": {
            const connectorId = connectorIdFromPayload(event.payload);
            if (connectorId) {
              generationByConnector[connectorId] ??= emptyConnectorAggregate();
            }

            if (event.eventType === "generation.submitted") {
              overview.totals.generationSubmitted++;
              if (connectorId) generationByConnector[connectorId]!.submitted++;
            }
            if (event.eventType === "generation.completed") {
              overview.totals.generationCompleted++;
              if (connectorId) generationByConnector[connectorId]!.completed++;
            }
            if (event.eventType === "generation.failed") {
              overview.totals.generationFailed++;
              if (connectorId) generationByConnector[connectorId]!.failed++;
            }
            if (event.eventType === "generation.cancelled") {
              overview.totals.generationCancelled++;
              if (connectorId) generationByConnector[connectorId]!.cancelled++;
            }
            break;
          }
          default:
            break;
        }
      }

      return overview;
    },

    getUsage(query: AnalyticsUsageQuery): AnalyticsUsage {
      ensureValidRange(query);

      const dayKeys = listDayKeys(query.from, query.to);
      const pointsMap = new Map<string, AnalyticsUsagePoint>(
        dayKeys.map((day) => [day, emptyUsagePoint(day)]),
      );

      for (const event of eventRepo.listInRange(query)) {
        const point = pointsMap.get(toDayKey(event.createdAt));
        if (!point) continue;

        switch (event.eventType) {
          case "project.created":
            point.projectsCreated++;
            break;
          case "asset.imported":
            point.assetsImported++;
            break;
          case "agent.queried":
            point.agentQueries++;
            break;
          case "generation.submitted":
            point.generationSubmitted++;
            break;
          case "generation.completed":
            point.generationCompleted++;
            break;
          case "generation.failed":
            point.generationFailed++;
            break;
          case "generation.cancelled":
            point.generationCancelled++;
            break;
          default:
            break;
        }
      }

      return {
        from: query.from,
        to: query.to,
        points: dayKeys.map((day) => pointsMap.get(day) ?? emptyUsagePoint(day)),
      };
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
