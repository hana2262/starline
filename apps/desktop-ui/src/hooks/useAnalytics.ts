import { useQuery } from "@tanstack/react-query";
import type { AnalyticsUsageQuery } from "@starline/shared";
import { analyticsApi } from "../lib/api.js";

const OVERVIEW_QUERY_KEY = ["analytics", "overview"] as const;

function toUtcBoundaryDate(date: Date, boundary: "start" | "end"): string {
  const copy = new Date(date);
  if (boundary === "start") {
    copy.setUTCHours(0, 0, 0, 0);
  } else {
    copy.setUTCHours(23, 59, 59, 999);
  }
  return copy.toISOString();
}

export function buildRecentUsageRange(days: number): AnalyticsUsageQuery {
  const safeDays = Math.max(1, Math.floor(days));
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));

  return {
    from: toUtcBoundaryDate(start, "start"),
    to: toUtcBoundaryDate(end, "end"),
  };
}

export function useAnalyticsOverview(enabled = true) {
  return useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: analyticsApi.getOverview,
    enabled,
  });
}

export function useAnalyticsUsage(query: AnalyticsUsageQuery, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "usage", query] as const,
    queryFn: () => analyticsApi.getUsage(query),
    enabled,
  });
}
