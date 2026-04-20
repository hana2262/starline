import { useMemo, useState } from "react";
import ProjectList from "../components/ProjectList.js";
import ProjectCreateModal from "../components/ProjectCreateModal.js";
import { useDeleteProjects, useProjects } from "../hooks/useProjects.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  onOpenProject?: (projectId: string) => void;
}

type ProjectFilter = "all" | "active" | "archived";

export default function ProjectsPage({ apiReady, onOpenProject }: Props) {
  const { locale, text, formatProjectStatus } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: projects, isLoading, isError, error } = useProjects(apiReady);
  const deleteProjects = useDeleteProjects();

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (filter === "all") return projects;
    return projects.filter((project) => project.status === filter);
  }, [filter, projects]);

  function toggleSelected(projectId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, projectId])) : current.filter((id) => id !== projectId),
    );
  }

  function resetSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  const projectsManageHint =
    text.projectsManageHint ??
    (locale === "zh-CN"
      ? "查看活跃和已归档项目，编辑详情或清理旧项目。"
      : "Review active and archived projects, edit details, or clean up old work.");
  const selectProjectsLabel = text.selectProjects ?? (locale === "zh-CN" ? "选择项目" : "Select projects");
  const projectFilterLabel = text.projectFilterLabel ?? (locale === "zh-CN" ? "状态筛选" : "Status filter");
  const allStatusesLabel = text.allStatuses ?? (locale === "zh-CN" ? "全部" : "All");
  const selectedProjectsTemplate =
    text.selectedProjectsCount ?? (locale === "zh-CN" ? "已选择 {count} 项" : "{count} selected");
  const deleteProjectsConfirmTemplate =
    text.deleteProjectsConfirm ??
    (locale === "zh-CN"
      ? "要删除已选择的 {count} 个项目吗？此操作无法撤销。"
      : "Delete {count} selected projects? This cannot be undone.");
  const deletingProjectsLabel = text.deletingProjects ?? (locale === "zh-CN" ? "删除中..." : "Deleting...");
  const deleteSelectedProjectsLabel =
    text.deleteSelectedProjects ?? (locale === "zh-CN" ? "删除所选项目" : "Delete selected");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{text.projectsTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{projectsManageHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {text.newProject}
          </button>
          <button
            onClick={() => {
              if (selectionMode) {
                resetSelection();
              } else {
                setSelectionMode(true);
              }
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {selectionMode ? text.cancelSelection ?? text.cancel : selectProjectsLabel}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">
            <span className="mr-2">{projectFilterLabel}</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as ProjectFilter)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">{allStatusesLabel}</option>
              <option value="active">{formatProjectStatus("active")}</option>
              <option value="archived">{formatProjectStatus("archived")}</option>
            </select>
          </label>

          {selectionMode && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">
                {selectedProjectsTemplate.replace("{count}", String(selectedIds.length))}
              </span>
              <button
                onClick={() => {
                  if (selectedIds.length === 0) return;
                  const confirmed = window.confirm(
                    deleteProjectsConfirmTemplate.replace("{count}", String(selectedIds.length)),
                  );
                  if (!confirmed) return;
                  deleteProjects.mutate(selectedIds, {
                    onSuccess: () => resetSelection(),
                  });
                }}
                disabled={selectedIds.length === 0 || deleteProjects.isPending}
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteProjects.isPending ? deletingProjectsLabel : deleteSelectedProjectsLabel}
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400">{text.loading}</p>}
      {isError && <p className="text-sm text-red-600">Error: {String(error)}</p>}
      {projects && (
        <ProjectList
          projects={filteredProjects}
          onOpenProject={selectionMode ? undefined : onOpenProject}
          selectable={selectionMode}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
        />
      )}

      {showCreate && <ProjectCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
