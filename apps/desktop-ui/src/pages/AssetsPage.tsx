import { useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";
import { useAssets } from "../hooks/useAssets.js";
import { useRestoreAsset, useTrashAsset } from "../hooks/useAsset.js";
import AssetFilters from "../components/AssetFilters.js";
import AssetImportForm from "../components/AssetImportForm.js";
import AssetList from "../components/AssetList.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  projects: ProjectResponse[];
  selectedStatus: "active" | "trashed" | "all";
  onSelectedStatusChange: (status: "active" | "trashed" | "all") => void;
  onOpenAsset?: (assetId: string) => void;
}

const PAGE_SIZE = 10;

export default function AssetsPage({
  apiReady,
  projects,
  selectedStatus,
  onSelectedStatusChange,
  onOpenAsset,
}: Props) {
  const { locale, text } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<AssetType | "">("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [page, setPage] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const trashAsset = useTrashAsset();
  const restoreAsset = useRestoreAsset();

  const result = useAssets(
    {
      query: query.trim() || undefined,
      projectId: selectedProjectId || undefined,
      type: selectedType || undefined,
      status: selectedStatus,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    apiReady,
  );

  const totalPages = useMemo(() => {
    if (!result.data) return 1;
    return Math.max(1, Math.ceil(result.data.total / PAGE_SIZE));
  }, [result.data]);

  const projectNameById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  function resetSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function switchStatus(status: "active" | "trashed" | "all") {
    onSelectedStatusChange(status);
    setPage(0);
    setActionNotice(null);
    resetSelection();
  }

  function resetFilters() {
    setQuery("");
    setSelectedType("");
    setSelectedProjectId("");
    setPage(0);
    setActionNotice(null);
    switchStatus("active");
  }

  function toggleSelected(assetId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId),
    );
  }

  const canSelectForTrash = selectedStatus === "active";
  const assetManageHint = locale === "zh-CN"
    ? "浏览资产、查看回收站，并先将不需要的内容移入回收站。"
    : "Browse assets, review the trash, and move unneeded items into the recycle bin first.";
  const trashSelectionLabel = locale === "zh-CN" ? "选择资产" : "Select assets";
  const cancelSelectionLabel = locale === "zh-CN" ? "取消选择" : "Cancel selection";
  const selectedAssetsLabel = locale === "zh-CN"
    ? `已选择 ${selectedIds.length} 项`
    : `${selectedIds.length} selected`;
  const moveToTrashLabel = locale === "zh-CN" ? "移入回收站" : "Move to trash";
  const movingToTrashLabel = locale === "zh-CN" ? "正在移入回收站..." : "Moving to trash...";
  const trashConfirmText = locale === "zh-CN"
    ? `确定将所选的 ${selectedIds.length} 项资产移入回收站吗？`
    : `Move ${selectedIds.length} selected assets to the trash?`;
  const activeViewLabel = locale === "zh-CN" ? "资产库" : "Library";
  const trashViewLabel = locale === "zh-CN" ? "回收站" : "Recycle Bin";
  const allViewLabel = locale === "zh-CN" ? "全部" : "All";
  const movedToTrashNotice = locale === "zh-CN" ? "资产已移入回收站。" : "Assets moved to the recycle bin.";
  const restoredNotice = locale === "zh-CN" ? "资产已恢复到资产库。" : "Asset restored to the library.";
  const trashActionFailed = locale === "zh-CN" ? "更新资产回收站状态失败。" : "Failed to update asset trash status.";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{text.assetPageTitle}</h2>
          <p className="text-sm text-gray-500 mt-1">{text.assetPageSubtitle}</p>
          <p className="text-sm text-gray-500 mt-1">{assetManageHint}</p>
        </div>
      </div>

      <AssetImportForm projects={projects} />

      <div className="flex flex-wrap gap-2">
        {[
          { key: "active" as const, label: activeViewLabel },
          { key: "trashed" as const, label: trashViewLabel },
          { key: "all" as const, label: allViewLabel },
        ].map((view) => (
          <button
            key={view.key}
            onClick={() => switchStatus(view.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              selectedStatus === view.key
                ? "bg-gray-900 text-white"
                : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <AssetFilters
        query={query}
        selectedType={selectedType}
        selectedProjectId={selectedProjectId}
        selectedStatus={selectedStatus}
        projects={projects}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
        onTypeChange={(value) => {
          setSelectedType(value);
          setPage(0);
        }}
        onProjectChange={(value) => {
          setSelectedProjectId(value);
          setPage(0);
        }}
        onStatusChange={switchStatus}
        onReset={resetFilters}
      />

      {actionNotice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionNotice}
        </div>
      )}

      {canSelectForTrash && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (selectionMode) {
                resetSelection();
              } else {
                setSelectionMode(true);
                setActionNotice(null);
              }
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {selectionMode ? cancelSelectionLabel : trashSelectionLabel}
          </button>
        </div>
      )}

      {selectionMode && canSelectForTrash && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-gray-500">{selectedAssetsLabel}</span>
            <button
              onClick={() => {
                if (selectedIds.length === 0) return;
                const confirmed = window.confirm(trashConfirmText);
                if (!confirmed) return;
                Promise.all(selectedIds.map((id) => trashAsset.mutateAsync(id)))
                  .then(() => {
                    resetSelection();
                    setActionNotice(movedToTrashNotice);
                  })
                  .catch(() => setActionNotice(trashActionFailed));
              }}
              disabled={selectedIds.length === 0 || trashAsset.isPending}
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {trashAsset.isPending ? movingToTrashLabel : moveToTrashLabel}
            </button>
          </div>
        </div>
      )}

      {result.isLoading && <p className="text-sm text-gray-500">{text.loadingAssets}</p>}
      {result.isError && (
        <p className="text-sm text-red-600">{text.assetLoadError} {String(result.error)}</p>
      )}

      {result.data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{text.showingAssets(result.data.items.length, result.data.total)}</span>
            <span>{text.pageLabel(page + 1, totalPages)}</span>
          </div>

          <AssetList
            result={result.data}
            onOpenAsset={onOpenAsset}
            projectNameById={projectNameById}
            selectable={selectionMode && canSelectForTrash}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onRestoreAsset={(assetId) =>
              restoreAsset.mutate(assetId, {
                onSuccess: () => setActionNotice(restoredNotice),
                onError: () => setActionNotice(trashActionFailed),
              })}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {text.previous}
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {text.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
