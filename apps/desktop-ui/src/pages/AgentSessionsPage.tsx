import type { AgentSession, ProjectResponse } from "@starline/shared";
import { useAgentSessions } from "../hooks/useAgent.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  projects: ProjectResponse[];
  activeSessionId: string | null;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
}

export default function AgentSessionsPage({
  apiReady,
  projects,
  activeSessionId,
  onBack,
  onOpenSession,
}: Props) {
  const { locale } = useI18n();
  const sessions = useAgentSessions(apiReady);
  const projectNameById = Object.fromEntries(projects.map((project) => [project.id, project.name]));

  const copy = {
    title: locale === "zh-CN" ? "历史会话" : "Session history",
    subtitle:
      locale === "zh-CN"
        ? "查看并切换已保存的 Agent 会话。"
        : "Browse and reopen saved Agent conversations.",
    back: locale === "zh-CN" ? "返回 Agent" : "Back to Agent",
    globalScope: locale === "zh-CN" ? "全局资产库" : "Global library",
    updatedAt: locale === "zh-CN" ? "最近更新" : "Updated",
    empty:
      locale === "zh-CN"
        ? "还没有历史会话。先在 Agent 页面发起一次提问。"
        : "No saved sessions yet. Start by asking something in the Agent page.",
    loadFailed: locale === "zh-CN" ? "加载历史会话失败" : "Failed to load sessions",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <button
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copy.back}
        </button>
      </div>

      {sessions.isLoading && <p className="text-sm text-slate-500">{copy.title}...</p>}
      {sessions.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {copy.loadFailed}: {String(sessions.error)}
        </p>
      )}

      {sessions.data && sessions.data.sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          {copy.empty}
        </div>
      )}

      {sessions.data && sessions.data.sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.data.sessions.map((session: AgentSession) => {
            const isActive = session.id === activeSessionId;
            const projectName = session.projectId ? (projectNameById[session.projectId] ?? session.projectId) : copy.globalScope;

            return (
              <button
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                className={`w-full rounded-2xl border px-5 py-4 text-left shadow-sm transition ${
                  isActive
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{session.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{projectName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{copy.updatedAt}</p>
                    <p className="mt-1 text-sm text-slate-600">{new Date(session.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
