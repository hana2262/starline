import { useMemo, useState } from "react";
import type { AnalyticsUsagePoint } from "@starline/shared";
import { buildRecentUsageRange, useAnalyticsOverview, useAnalyticsUsage } from "../hooks/useAnalytics.js";

interface Props {
  apiReady: boolean;
}

const RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
] as const;

function formatTimestamp(value: string | null): string {
  if (!value) return "No events yet";
  return new Date(value).toLocaleString();
}

function formatDayLabel(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function totalActivity(point: AnalyticsUsagePoint): number {
  return (
    point.projectsCreated
    + point.assetsImported
    + point.agentQueries
    + point.generationSubmitted
    + point.generationCompleted
    + point.generationFailed
    + point.generationCancelled
  );
}

function usageBarWidth(point: AnalyticsUsagePoint, maxValue: number): string {
  if (maxValue <= 0) return "4%";
  return `${Math.max(4, Math.round((totalActivity(point) / maxValue) * 100))}%`;
}

function statCard(title: string, value: number, tone: string, detail: string) {
  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

export default function AnalyticsPage({ apiReady }: Props) {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]["days"]>(14);
  const usageRange = useMemo(() => buildRecentUsageRange(days), [days]);

  const overview = useAnalyticsOverview(apiReady);
  const usage = useAnalyticsUsage(usageRange, apiReady);

  const usageMax = useMemo(() => {
    const points = usage.data?.points ?? [];
    return points.reduce((max, point) => Math.max(max, totalActivity(point)), 0);
  }, [usage.data]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Analytics</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review local project, asset, generation, and agent activity without sending telemetry anywhere else.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest Event</p>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {formatTimestamp(overview.data?.latestEventAt ?? null)}
          </p>
        </div>
      </div>

      {(overview.isLoading || usage.isLoading) && (
        <p className="text-sm text-slate-500">Loading analytics...</p>
      )}
      {(overview.isError || usage.isError) && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load analytics.
        </p>
      )}

      {overview.data && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCard(
            "Projects",
            overview.data.totals.projectsCreated,
            "border-sky-200 bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#ffffff_72%)]",
            "Total locally created projects.",
          )}
          {statCard(
            "Assets",
            overview.data.totals.assetsImported,
            "border-emerald-200 bg-[radial-gradient(circle_at_top,#dcfce7_0%,#ffffff_72%)]",
            "Imported and indexed local assets.",
          )}
          {statCard(
            "Agent Queries",
            overview.data.totals.agentQueries,
            "border-violet-200 bg-[radial-gradient(circle_at_top,#f3e8ff_0%,#ffffff_72%)]",
            "Persisted retrieval-backed agent requests.",
          )}
          {statCard(
            "Generations",
            overview.data.totals.generationSubmitted,
            "border-amber-200 bg-[radial-gradient(circle_at_top,#fef3c7_0%,#ffffff_72%)]",
            `${overview.data.totals.generationCompleted} completed, ${overview.data.totals.generationFailed} failed, ${overview.data.totals.generationCancelled} cancelled.`,
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Usage</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">Recent Local Activity</h3>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  onClick={() => setDays(option.days)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    days === option.days
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(usage.data?.points ?? []).length === 0 && !usage.isLoading && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No analytics events available in the selected range.
              </p>
            )}
            {(usage.data?.points ?? []).map((point) => (
              <article key={point.date} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDayLabel(point.date)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {point.projectsCreated} projects, {point.assetsImported} assets, {point.agentQueries} agent,
                      {" "}{point.generationSubmitted} submitted, {point.generationCompleted} completed
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-600">{totalActivity(point)} events</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500"
                    style={{ width: usageBarWidth(point, usageMax) }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Generation Outcomes</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Completed</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-900">
                  {overview.data?.totals.generationCompleted ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Failed</p>
                <p className="mt-2 text-2xl font-semibold text-rose-900">
                  {overview.data?.totals.generationFailed ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-700">Cancelled</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {overview.data?.totals.generationCancelled ?? 0}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">By Connector</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">Generation Mix</h3>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                {Object.keys(overview.data?.generationByConnector ?? {}).length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {Object.entries(overview.data?.generationByConnector ?? {}).length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  No generation activity has been recorded yet.
                </p>
              )}
              {Object.entries(overview.data?.generationByConnector ?? {}).map(([connectorId, stats]) => (
                <article key={connectorId} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-sm font-semibold text-slate-900">{connectorId}</h4>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {stats.submitted} submitted
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-600">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Completed</dt>
                      <dd className="mt-1 font-medium text-emerald-700">{stats.completed}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Failed</dt>
                      <dd className="mt-1 font-medium text-rose-700">{stats.failed}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-slate-400">Cancelled</dt>
                      <dd className="mt-1 font-medium text-slate-700">{stats.cancelled}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
