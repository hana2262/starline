import { z } from "zod";

export const AnalyticsOverviewSchema = z.object({
  totals: z.object({
    projectsCreated: z.number().int().nonnegative(),
    assetsImported: z.number().int().nonnegative(),
    agentQueries: z.number().int().nonnegative(),
    generationSubmitted: z.number().int().nonnegative(),
    generationCompleted: z.number().int().nonnegative(),
    generationFailed: z.number().int().nonnegative(),
    generationCancelled: z.number().int().nonnegative(),
  }),
  generationByConnector: z.record(z.object({
    submitted: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  })),
  latestEventAt: z.string().nullable(),
});
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>;

export const AnalyticsUsageQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});
export type AnalyticsUsageQuery = z.infer<typeof AnalyticsUsageQuerySchema>;

export const AnalyticsUsagePointSchema = z.object({
  date: z.string(),
  projectsCreated: z.number().int().nonnegative(),
  assetsImported: z.number().int().nonnegative(),
  agentQueries: z.number().int().nonnegative(),
  generationSubmitted: z.number().int().nonnegative(),
  generationCompleted: z.number().int().nonnegative(),
  generationFailed: z.number().int().nonnegative(),
  generationCancelled: z.number().int().nonnegative(),
});
export type AnalyticsUsagePoint = z.infer<typeof AnalyticsUsagePointSchema>;

export const AnalyticsUsageSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  points: z.array(AnalyticsUsagePointSchema),
});
export type AnalyticsUsage = z.infer<typeof AnalyticsUsageSchema>;
