import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AgentAssetReference, AgentRuntime, AgentSessionResult, AgentToolUsage, ProjectResponse } from "@starline/shared";
import { agentApi } from "../lib/api.js";
import { useAgentRuntime, useAgentSession } from "../hooks/useAgent.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  projects: ProjectResponse[];
  sessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
  onOpenHistory: () => void;
  onOpenProviders: () => void;
}

interface HoverRailItem {
  id: string;
  icon: string;
  label: string;
  title: string;
  body: ReactNode;
}

interface RenderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
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

function defaultAgentRuntime(): AgentRuntime {
  return {
    mode: "llm",
    vendor: "mock",
    protocol: "mock",
    model: "mock-agent-v1",
  };
}

function bubbleTone(role: "user" | "assistant", pending = false, error = false): string {
  if (role === "assistant") {
    if (error) return "mr-8 border-red-200 bg-red-50 text-red-700 shadow-sm";
    if (pending) return "mr-8 border-slate-200 bg-slate-50 text-slate-600 shadow-sm";
    return "mr-8 border-slate-200 bg-white text-slate-900 shadow-sm";
  }

  return "ml-12 border-blue-600 bg-blue-600 text-white shadow-sm";
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function sameMessage(a: RenderMessage, b: RenderMessage): boolean {
  return a.role === b.role && a.content === b.content;
}

export default function AgentPage({
  apiReady,
  projects,
  sessionId,
  onSessionChange,
  onOpenHistory,
  onOpenProviders,
}: Props) {
  const { locale, text, formatAssetType } = useI18n();
  const [draft, setDraft] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [allowPrivateForThisQuery, setAllowPrivateForThisQuery] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<AgentSessionResult | null>(null);
  const [lastToolUsage, setLastToolUsage] = useState<AgentToolUsage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<RenderMessage[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const latestSnapshotRef = useRef<AgentSessionResult | null>(null);

  const session = useAgentSession(sessionId, apiReady);
  const runtime = useAgentRuntime(apiReady);

  useEffect(() => {
    if (!session.data) return;
    setLastSnapshot((current) => {
      if (!current) return session.data;
      if (current.session.id !== session.data.session.id) return session.data;

      const currentUpdatedAt = new Date(current.session.updatedAt).getTime();
      const incomingUpdatedAt = new Date(session.data.session.updatedAt).getTime();
      if (incomingUpdatedAt >= currentUpdatedAt) {
        return session.data;
      }

      return current;
    });

    if (!isStreaming) {
      setPendingMessages([]);
      setLastToolUsage([]);
    }

    if (session.data.session.projectId) {
      setSelectedProjectId(session.data.session.projectId);
    }
  }, [isStreaming, session.data]);

  useEffect(() => {
    const node = conversationRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lastSnapshot, pendingMessages, session.data]);

  const effectiveSnapshot = useMemo(() => {
    if (lastSnapshot && sessionId && lastSnapshot.session.id === sessionId) {
      return lastSnapshot;
    }
    if (session.data) return session.data;
    return lastSnapshot;
  }, [lastSnapshot, session.data, sessionId]);

  useEffect(() => {
    latestSnapshotRef.current = effectiveSnapshot ?? null;
  }, [effectiveSnapshot]);

  async function submitQuery() {
    const trimmed = draft.trim();
    if (!trimmed || isStreaming) return;

    const now = new Date().toISOString();
    const userPendingId = `pending-user-${Date.now()}`;
    const assistantPendingId = `pending-assistant-${Date.now()}`;

    setDraft("");
    setStreamError(null);
    setIsStreaming(true);
    setPendingMessages([
      {
        id: userPendingId,
        role: "user",
        content: trimmed,
        createdAt: now,
      },
      {
        id: assistantPendingId,
        role: "assistant",
        content: locale === "zh-CN" ? "正在生成内容..." : "Generating response...",
        createdAt: now,
        pending: true,
      },
    ]);

    try {
      await agentApi.queryStream(
        {
          sessionId: sessionId ?? undefined,
          projectId: selectedProjectId || undefined,
          allowPrivateForThisQuery,
          query: trimmed,
        },
        {
          onMetadata: (payload) => {
            onSessionChange(payload.session.id);
            setSelectedProjectId(payload.session.projectId ?? selectedProjectId);
            setLastToolUsage(payload.toolUsage);
          },
          onAssistantDelta: (delta) => {
            setPendingMessages((current) =>
              current.map((message) =>
                message.id === assistantPendingId
                  ? {
                      ...message,
                      content:
                        message.content === (locale === "zh-CN" ? "正在生成内容..." : "Generating response...")
                          ? delta
                          : `${message.content}${delta}`,
                    }
                  : message,
              ),
            );
          },
          onDone: (result) => {
            setIsStreaming(false);
            setPendingMessages([]);
            setLastToolUsage(result.toolUsage);
            setLastSnapshot(() => {
              const latestSnapshot = latestSnapshotRef.current;
              const baseSnapshot = latestSnapshot?.session.id === result.session.id ? latestSnapshot : null;
              const baseMessages = baseSnapshot?.messages ?? [];
              const baseRelatedAssets = baseSnapshot?.relatedAssets ?? [];

              return {
                session: result.session,
                messages: [...baseMessages, result.userMessage, result.assistantMessage].filter(
                  (message, index, array) => array.findIndex((entry) => entry.id === message.id) === index,
                ),
                relatedAssets: mergeRelatedAssets(baseRelatedAssets, result.relatedAssets),
                project: result.project,
                agentRuntime: result.agentRuntime,
              };
            });
            void session.refetch();
          },
          onError: (message) => {
            setIsStreaming(false);
            setStreamError(message);
            setPendingMessages((current) =>
              current.map((entry) =>
                entry.id === assistantPendingId
                  ? {
                      ...entry,
                      content: locale === "zh-CN" ? "生成失败，请重试。" : "Generation failed. Please retry.",
                      pending: false,
                      error: true,
                    }
                  : entry,
              ),
            );
          },
        },
      );
    } catch (error) {
      setIsStreaming(false);
      setStreamError(String(error));
      setPendingMessages((current) =>
        current.map((entry) =>
          entry.id === assistantPendingId
            ? {
                ...entry,
                content: locale === "zh-CN" ? "生成失败，请重试。" : "Generation failed. Please retry.",
                pending: false,
                error: true,
              }
            : entry,
        ),
      );
    }
  }

  function startNewSession() {
    onSessionChange(null);
    setDraft("");
    setAllowPrivateForThisQuery(false);
    setLastSnapshot(null);
    setLastToolUsage([]);
    setPendingMessages([]);
    setStreamError(null);
    setIsStreaming(false);
  }

  const messages = effectiveSnapshot?.messages ?? [];
  const baseMessages: RenderMessage[] = messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));
  const dedupedPendingMessages = pendingMessages.filter((pending) => !baseMessages.some((existing) => sameMessage(existing, pending)));
  const combinedMessages: RenderMessage[] = [...baseMessages, ...dedupedPendingMessages];
  const relatedAssets = effectiveSnapshot?.relatedAssets ?? [];
  const agentRuntime = effectiveSnapshot?.agentRuntime ?? runtime.data ?? defaultAgentRuntime();
  const currentProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  const currentProjectName = currentProject?.name ?? text.allLocalAssets;
  const conversationTitle = effectiveSnapshot?.session.title ?? (locale === "zh-CN" ? "当前会话" : "Current session");
  const roleLabel = (role: "user" | "assistant") => (role === "assistant" ? text.agentRole : locale === "zh-CN" ? "你" : "You");

  const railItems: HoverRailItem[] = [
    {
      id: "runtime",
      icon: "AI",
      label: locale === "zh-CN" ? "运行状态" : "Runtime",
      title: locale === "zh-CN" ? "当前 Agent 运行状态" : "Current agent runtime",
      body: (
        <dl className="grid gap-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <dt>{locale === "zh-CN" ? "模式" : "Mode"}</dt>
            <dd className="font-medium text-slate-900">{agentRuntime.mode}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Vendor</dt>
            <dd className="font-medium text-slate-900">{agentRuntime.vendor ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>{locale === "zh-CN" ? "接口格式" : "Protocol"}</dt>
            <dd className="font-medium text-slate-900">{agentRuntime.protocol ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>Model</dt>
            <dd className="font-medium text-slate-900">{agentRuntime.model ?? "—"}</dd>
          </div>
        </dl>
      ),
    },
    {
      id: "context",
      icon: "CTX",
      label: locale === "zh-CN" ? "上下文" : "Context",
      title: locale === "zh-CN" ? "当前上下文" : "Current context",
      body: (
        <div className="space-y-3 text-sm text-slate-600">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{text.projectScope}</p>
            <p className="mt-2 font-medium text-slate-900">{currentProjectName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {locale === "zh-CN" ? "会话开始" : "Started"}
            </p>
            <p className="mt-2">{formatDateLabel(effectiveSnapshot?.session.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {locale === "zh-CN" ? "最近更新" : "Updated"}
            </p>
            <p className="mt-2">{formatDateLabel(effectiveSnapshot?.session.updatedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {locale === "zh-CN" ? "消息数" : "Messages"}
            </p>
            <p className="mt-2">{combinedMessages.length}</p>
          </div>
        </div>
      ),
    },
    {
      id: "assets",
      icon: String(relatedAssets.length),
      label: locale === "zh-CN" ? "相关资产" : "Assets",
      title: locale === "zh-CN" ? "相关资产" : "Related assets",
      body:
        relatedAssets.length === 0 ? (
          <p className="text-sm text-slate-500">{text.noRelatedAssets}</p>
        ) : (
          <div className="space-y-3">
            {relatedAssets.map((asset) => (
              <article key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{asset.name}</h4>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      {formatAssetType(asset.type)}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400">{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{asset.reason}</p>
              </article>
            ))}
          </div>
        ),
    },
    {
      id: "tools",
      icon: lastToolUsage.length > 0 ? String(lastToolUsage.length) : "T",
      label: locale === "zh-CN" ? "工具" : "Tools",
      title: locale === "zh-CN" ? "本次使用的工具" : "Tools used in this reply",
      body:
        lastToolUsage.length === 0 ? (
          <p className="text-sm text-slate-500">
            {locale === "zh-CN" ? "当前回复没有使用工具。" : "No tool was used for the latest reply."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lastToolUsage.map((tool) => (
              <span
                key={tool.name}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {tool.name}
              </span>
            ))}
          </div>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{text.agentTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{text.agentSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenHistory}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {locale === "zh-CN" ? "查看历史会话" : "History"}
          </button>
          <button
            onClick={onOpenProviders}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {locale === "zh-CN" ? "Provider 设置" : "Providers"}
          </button>
          <button
            onClick={startNewSession}
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {text.newSession}
          </button>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
        <div className="rounded-[1.8rem] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {locale === "zh-CN" ? "会话内容" : "Conversation"}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{conversationTitle}</h3>
            </div>
            {isStreaming && (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                {locale === "zh-CN" ? "生成中" : "Generating"}
              </div>
            )}
          </div>

          <div
            ref={conversationRef}
            className="h-[28rem] overflow-y-auto rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_14%,#ffffff_100%)] px-4 py-4"
          >
            {combinedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">{text.noSessionTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text.noSessionBody}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {combinedMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`rounded-[1.5rem] border px-5 py-4 ${bubbleTone(message.role, message.pending, message.error)}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                        {roleLabel(message.role)}
                      </p>
                      <p className="text-[11px] opacity-50">{new Date(message.createdAt).toLocaleString()}</p>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6">
                      {message.content}
                    </pre>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="min-w-0 flex-1 rounded-[1.7rem] border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {text.projectScope}
                  </span>
                  <select
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    disabled={Boolean(sessionId)}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <option value="">{text.allLocalAssets}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {text.agentPrivateAccessLabel}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{text.agentPrivateAccessTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {allowPrivateForThisQuery
                          ? text.agentPrivateAccessEnabledHint
                          : text.agentPrivateAccessDisabledHint}
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
                </div>
              </div>

              <div className="relative mt-4">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={text.askAgentPlaceholder}
                  rows={4}
                  className="w-full resize-none rounded-[1.6rem] border border-slate-300 bg-white px-5 py-5 pr-24 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500"
                />
                <button
                  onClick={() => void submitQuery()}
                  disabled={!apiReady || isStreaming || draft.trim().length === 0}
                  className="absolute bottom-5 right-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title={locale === "zh-CN" ? "发送给 Agent" : "Send to agent"}
                  aria-label={locale === "zh-CN" ? "发送给 Agent" : "Send to agent"}
                >
                  {isStreaming ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 18V6" />
                      <path d="M7 11l5-5 5 5" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="mt-4 min-h-[24px]">
                {streamError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {streamError}
                  </p>
                ) : lastToolUsage.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      {locale === "zh-CN" ? "已使用工具" : "Tools used"}: {lastToolUsage.map((tool) => tool.name).join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 pt-1">
              {railItems.map((item) => (
                <div key={item.id} className="group relative flex items-center justify-end">
                  <div className="pointer-events-none absolute bottom-0 right-16 z-20 hidden w-80 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-xl group-hover:block">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <h4 className="mt-2 text-base font-semibold text-slate-900">{item.title}</h4>
                    <div className="mt-3">{item.body}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900"
                    title={item.label}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
