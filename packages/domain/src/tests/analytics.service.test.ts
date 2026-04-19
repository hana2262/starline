import { describe, expect, it, vi } from "vitest";
import { AnalyticsError, createAnalyticsService } from "../analytics/analytics.service.js";
import type { EventRepository } from "@starline/storage";

function makeEventRepository(overrides: Partial<EventRepository> = {}): EventRepository {
  return {
    create: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    listByType: vi.fn().mockReturnValue([]),
    listInRange: vi.fn().mockReturnValue([]),
    ...overrides,
  } as EventRepository;
}

describe("analyticsService.getOverview", () => {
  it("aggregates totals and generation metrics by connector", () => {
    const eventRepo = makeEventRepository({
      list: vi.fn().mockReturnValue([
        {
          id: "1",
          eventType: "project.created",
          entityType: "project",
          entityId: "proj-1",
          projectId: "proj-1",
          payload: { status: "active" },
          createdAt: "2026-04-19T00:00:00.000Z",
        },
        {
          id: "2",
          eventType: "asset.imported",
          entityType: "asset",
          entityId: "asset-1",
          projectId: "proj-1",
          payload: { type: "prompt" },
          createdAt: "2026-04-19T00:10:00.000Z",
        },
        {
          id: "3",
          eventType: "agent.queried",
          entityType: "agent_session",
          entityId: "session-1",
          projectId: "proj-1",
          payload: { relatedAssetCount: 1 },
          createdAt: "2026-04-19T00:20:00.000Z",
        },
        {
          id: "4",
          eventType: "generation.submitted",
          entityType: "generation",
          entityId: "job-1",
          projectId: "proj-1",
          payload: { connectorId: "mock", type: "image" },
          createdAt: "2026-04-19T00:30:00.000Z",
        },
        {
          id: "5",
          eventType: "generation.completed",
          entityType: "generation",
          entityId: "job-1",
          projectId: "proj-1",
          payload: { connectorId: "mock", type: "image", assetId: "asset-2" },
          createdAt: "2026-04-19T00:31:00.000Z",
        },
        {
          id: "6",
          eventType: "generation.submitted",
          entityType: "generation",
          entityId: "job-2",
          projectId: "proj-1",
          payload: { connectorId: "minimax", type: "image" },
          createdAt: "2026-04-19T00:40:00.000Z",
        },
        {
          id: "7",
          eventType: "generation.failed",
          entityType: "generation",
          entityId: "job-2",
          projectId: "proj-1",
          payload: { connectorId: "minimax", type: "image", errorCode: "GENERATION_FAILED", retryable: false },
          createdAt: "2026-04-19T00:41:00.000Z",
        },
      ]),
    });

    const service = createAnalyticsService(eventRepo);
    const overview = service.getOverview();

    expect(overview.totals).toEqual({
      projectsCreated: 1,
      assetsImported: 1,
      agentQueries: 1,
      generationSubmitted: 2,
      generationCompleted: 1,
      generationFailed: 1,
      generationCancelled: 0,
    });
    expect(overview.generationByConnector).toEqual({
      mock: {
        submitted: 1,
        completed: 1,
        failed: 0,
        cancelled: 0,
      },
      minimax: {
        submitted: 1,
        completed: 0,
        failed: 1,
        cancelled: 0,
      },
    });
    expect(overview.latestEventAt).toBe("2026-04-19T00:41:00.000Z");
  });
});

describe("analyticsService.getUsage", () => {
  it("aggregates events into daily usage buckets", () => {
    const eventRepo = makeEventRepository({
      listInRange: vi.fn().mockReturnValue([
        {
          id: "1",
          eventType: "project.created",
          entityType: "project",
          entityId: "proj-1",
          projectId: "proj-1",
          payload: {},
          createdAt: "2026-04-18T10:00:00.000Z",
        },
        {
          id: "2",
          eventType: "generation.submitted",
          entityType: "generation",
          entityId: "job-1",
          projectId: "proj-1",
          payload: { connectorId: "mock" },
          createdAt: "2026-04-18T11:00:00.000Z",
        },
        {
          id: "3",
          eventType: "generation.completed",
          entityType: "generation",
          entityId: "job-1",
          projectId: "proj-1",
          payload: { connectorId: "mock" },
          createdAt: "2026-04-19T08:00:00.000Z",
        },
        {
          id: "4",
          eventType: "agent.queried",
          entityType: "agent_session",
          entityId: "session-1",
          projectId: "proj-1",
          payload: {},
          createdAt: "2026-04-19T09:00:00.000Z",
        },
      ]),
    });

    const service = createAnalyticsService(eventRepo);
    const usage = service.getUsage({
      from: "2026-04-18T00:00:00.000Z",
      to: "2026-04-19T23:59:59.999Z",
    });

    expect(usage.points).toEqual([
      {
        date: "2026-04-18",
        projectsCreated: 1,
        assetsImported: 0,
        agentQueries: 0,
        generationSubmitted: 1,
        generationCompleted: 0,
        generationFailed: 0,
        generationCancelled: 0,
      },
      {
        date: "2026-04-19",
        projectsCreated: 0,
        assetsImported: 0,
        agentQueries: 1,
        generationSubmitted: 0,
        generationCompleted: 1,
        generationFailed: 0,
        generationCancelled: 0,
      },
    ]);
  });

  it("rejects invalid ranges", () => {
    const service = createAnalyticsService(makeEventRepository());

    expect(() => service.getUsage({
      from: "2026-04-19T00:00:00.000Z",
      to: "2026-04-18T00:00:00.000Z",
    })).toThrow(AnalyticsError);
  });
});
