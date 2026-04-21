import { useEffect, useMemo, useState } from "react";
import type { AgentAssetReference, AgentSessionResult, ProjectResponse } from "@starline/shared";
import { useAgentQuery, useAgentSession } from "../hooks/useAgent.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  projects: ProjectResponse[];
  sessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
  onOpenHistory: () => void;
}

function transcriptTone(role: "user" | "assistant"): string {
  return role === "assistant"
    ? "border-slate-900 bg-slate-900 text-white"
    : "border-slate-200 bg-white text-slate-900";
}

function mergeRelatedAssets(existing: AgentAssetReference[], incoming: AgentAssetReference[]): AgentAssetReference[] {
  const seen = new Set(existing.map((asset) => asset.id));
  const merged = [...existing];

  for (const asset of incoming) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    merged.push(asset);
  }

  return merged;
}

export default function AgentPage({
  apiReady,
  projects,
  sessionId,
  onSessionChange,
  onOpenHistory,
}: Props) {
  const { locale, text, formatAssetType } = useI18n();
  const [draft, setDraft] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [allowPrivateForThisQuery, setAllowPrivateForThisQuery] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<AgentSessionResult | null>(null);

  const session = useAgentSession(sessionId, apiReady);
  const sendQuery = useAgentQuery();

  useEffect(() => {
    if (session.data) {
      setLastSnapshot(session.data);
      if (session.data.session.projectId) {
        setSelectedProjectId(session.data.session.projectId);
      }
    }
  }, [session.data]);

  const effectiveSnapshot = useMemo(() => {
    if (session.data) return session.data;
    return lastSnapshot;
  }, [lastSnapshot, session.data]);

  async function submitQuery() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const result = await sendQuery.mutateAsync({
      sessionId: sessionId ?? undefined,
      projectId: selectedProjectId || undefined,
      allowPrivateForThisQuery,
      query: trimmed,
    });

    setDraft("");
    onSessionChange(result.session.id);
    setSelectedProjectId(result.session.projectId ?? selectedProjectId);
    setLastSnapshot((current) => {
      if (current && current.session.id === result.session.id) {
        return {
          session: result.session,
          messages: [...current.messages, result.userMessage, result.assistantMessage],
          relatedAssets: mergeRelatedAssets(current.relatedAssets, result.relatedAssets),
          project: result.project,
        };
      }

      return {
        session: result.session,
        messages: [result.userMessage, result.assistantMessage],
        relatedAssets: result.relatedAssets,
        project: result.project,
      };
    });
  }

  function startNewSession() {
    onSessionChange(null);
    setDraft("");
    setAllowPrivateForThisQuery(false);
    setLastSnapshot(null);
  }

  const messages = effectiveSnapshot?.messages ?? [];
  const relatedAssets = effectiveSnapshot?.relatedAssets ?? [];

  const copy = {
    history: locale === "zh-CN" ? "查看历史会话" : "Open history",
    send: locale === "zh-CN" ? "发送给 Agent" : "Send to Agent",
    sessionCode: locale === "zh-CN" ? "当前会话" : "Session",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{text.agentTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.agentSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {sessionId && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{copy.sessionCode}</p>
              <p className="text-sm font-medium text-slate-700">{sessionId.slice(0, 8)}</p>
            </div>
          )}
          <button
            onClick={onOpenHistory}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copy.history}
          </button>
          <button
            onClick={startNewSession}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {text.newSession}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-4">
              <label className="min-w-[220px] flex-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{text.projectScope}</span>
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  disabled={Boolean(sessionId)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">{text.allLocalAssets}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-[280px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {text.agentPrivateAccessLabel}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {text.agentPrivateAccessTitle}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {allowPrivateForThisQuery
                        ? text.agentPrivateAccessEnabledBody
                        : text.agentPrivateAccessDisabledBody}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowPrivateForThisQuery((current) => !current)}
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                      allowPrivateForThisQuery ? "bg-amber-500" : "bg-slate-300"
                    }`}
                    aria-pressed={allowPrivateForThisQuery}
                    title={text.agentPrivateAccessToggle}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        allowPrivateForThisQuery ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </label>
            </div>

            <div className="relative">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={text.askAgentPlaceholder}
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-4 pr-20 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
              <button
                onClick={() => void submitQuery()}
                disabled={!apiReady || sendQuery.isPending || draft.trim().length === 0}
                className="absolute bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={copy.send}
                aria-label={copy.send}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 18V6" />
                  <path d="M7 11l5-5 5 5" />
                </svg>
              </button>
            </div>
          </div>

          {sendQuery.isError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {String(sendQuery.error)}
            </p>
          )}

          <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            allowPrivateForThisQuery
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}>
            {allowPrivateForThisQuery
              ? text.agentPrivateAccessEnabledHint
              : text.agentPrivateAccessDisabledHint}
          </p>

          <div className="mt-6 space-y-4">
            {session.isLoading && sessionId && (
              <p className="text-sm text-slate-500">{text.loadingSession}</p>
            )}
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">{text.noSessionTitle}</p>
                <p className="mt-2 text-sm text-slate-500">{text.noSessionBody}</p>
              </div>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-2xl border px-5 py-4 shadow-sm ${transcriptTone(message.role)}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
                    {message.role === "assistant" ? text.agentRole : text.youRole}
                  </p>
                  <p className="text-xs opacity-70">{new Date(message.createdAt).toLocaleString()}</p>
                </div>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                  {message.content}
                </pre>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{text.currentContext}</p>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {effectiveSnapshot?.project?.name ?? text.globalLibrary}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {effectiveSnapshot?.project?.description ?? text.globalLibraryBody}
            </p>
            {effectiveSnapshot?.session && (
              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <dt>{text.started}</dt>
                  <dd>{new Date(effectiveSnapshot.session.createdAt).toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{text.updated}</dt>
                  <dd>{new Date(effectiveSnapshot.session.updatedAt).toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>{text.messages}</dt>
                  <dd>{messages.length}</dd>
                </div>
              </dl>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top,#eff6ff_0%,#ffffff_70%)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{text.relatedAssets}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{text.retrievedLocalContext}</h3>
              </div>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                {relatedAssets.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {relatedAssets.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  {text.noRelatedAssets}
                </p>
              )}
              {relatedAssets.map((asset) => (
                <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{asset.name}</h4>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{formatAssetType(asset.type)}</p>
                    </div>
                    <p className="text-xs text-slate-400">{new Date(asset.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{asset.reason}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
