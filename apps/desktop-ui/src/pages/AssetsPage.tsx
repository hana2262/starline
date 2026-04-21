import { useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";
import { useAssets } from "../hooks/useAssets.js";
import {
  usePermanentlyDeleteAsset,
  useRemoveAsset,
  useRestoreAsset,
  useTrashAsset,
} from "../hooks/useAsset.js";
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
  const removeAsset = useRemoveAsset();
  const permanentlyDeleteAsset = usePermanentlyDeleteAsset();

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

  const selectedAssets = useMemo(
    () => (result.data?.items ?? []).filter((asset) => selectedIds.includes(asset.id)),
    [result.data?.items, selectedIds],
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

  const canSelectActive = selectedStatus === "active";
  const canSelectTrash = selectedStatus === "trashed";
  const canSelect = canSelectActive || canSelectTrash;
  const canBulkPermanentDelete =
    canSelectTrash &&
    selectedIds.length > 0 &&
    selectedAssets.length === selectedIds.length &&
    selectedAssets.every((asset) => asset.origin === "generated");

  const copy = {
    assetManageHint:
      locale === "zh-CN"
        ? "在这里导入、筛选、查看资产，并先将不需要的内容移入回收站。"
        : "Import, filter, inspect assets, and move unneeded items into the recycle bin first.",
    selectAssets: locale === "zh-CN" ? "选择资产" : "Select assets",
    cancelSelection: locale === "zh-CN" ? "取消选择" : "Cancel selection",
    selectedAssets:
      locale === "zh-CN" ? `已选择 ${selectedIds.length} 项` : `${selectedIds.length} selected`,
    moveToTrash: locale === "zh-CN" ? "移入回收站" : "Move to trash",
    movingToTrash: locale === "zh-CN" ? "正在移入回收站..." : "Moving to trash...",
    trashConfirm:
      locale === "zh-CN"
        ? `确认将这 ${selectedIds.length} 项资产移入回收站吗？`
        : `Move ${selectedIds.length} selected assets to the recycle bin?`,
    activeView: locale === "zh-CN" ? "资产库" : "Library",
    trashView: locale === "zh-CN" ? "回收站" : "Recycle Bin",
    allView: locale === "zh-CN" ? "全部" : "All",
    movedToTrashNotice:
      locale === "zh-CN" ? "资产已移入回收站。" : "Assets moved to the recycle bin.",
    restoredNotice:
      locale === "zh-CN" ? "资产已恢复到资产库。" : "Asset restored to the library.",
    restoredBatchNotice:
      locale === "zh-CN" ? "所选资产已恢复到资产库。" : "Selected assets restored to the library.",
    removeNotice:
      locale === "zh-CN"
        ? "资产记录已从平台移除，原始文件未删除。"
        : "Asset record removed from the library. Original files were not deleted.",
    removedBatchNotice:
      locale === "zh-CN"
        ? "所选资产记录已从平台移除，原始文件未删除。"
        : "Selected asset records removed from the library. Original files were not deleted.",
    permanentDeleteNotice:
      locale === "zh-CN"
        ? "已永久删除平台生成资产及其本地文件。"
        : "Generated asset and its local file were permanently deleted.",
    permanentDeletedBatchNotice:
      locale === "zh-CN"
        ? "所选 generated 资产及其本地文件已永久删除。"
        : "Selected generated assets and their local files were permanently deleted.",
    trashActionFailed:
      locale === "zh-CN" ? "更新资产回收站状态失败。" : "Failed to update asset trash status.",
    removeActionFailed:
      locale === "zh-CN" ? "从平台移除资产失败。" : "Failed to remove asset from library.",
    permanentDeleteFailed:
      locale === "zh-CN" ? "永久删除资产失败。" : "Failed to permanently delete asset.",
    removeConfirm:
      locale === "zh-CN"
        ? "确认从平台移除此资产记录吗？此操作不会删除 imported 原始文件。"
        : "Remove this asset record from the library? Imported source files will not be deleted.",
    removeSelectedConfirm:
      locale === "zh-CN"
        ? `确认从平台移除这 ${selectedIds.length} 项资产记录吗？此操作不会删除 imported 原始文件。`
        : `Remove ${selectedIds.length} selected asset records from the library? Imported source files will not be deleted.`,
    permanentDeleteConfirm:
      locale === "zh-CN"
        ? "确认永久删除该 generated 资产及其本地文件吗？此操作不可恢复。"
        : "Permanently delete this generated asset and its local file? This cannot be undone.",
    restoreSelected: locale === "zh-CN" ? "批量恢复" : "Restore selected",
    restoringSelected: locale === "zh-CN" ? "正在恢复..." : "Restoring...",
    removeSelected: locale === "zh-CN" ? "批量从平台移除" : "Remove selected from library",
    removingSelected: locale === "zh-CN" ? "正在移除..." : "Removing...",
    permanentDeleteSelected:
      locale === "zh-CN" ? "批量永久删除" : "Permanently delete selected",
    permanentlyDeletingSelected:
      locale === "zh-CN" ? "正在永久删除..." : "Deleting permanently...",
    permanentDeleteSelectedPrompt:
      locale === "zh-CN"
        ? `你将永久删除 ${selectedIds.length} 项 generated 资产及其本地文件。输入 DELETE 继续。`
        : `You are about to permanently delete ${selectedIds.length} generated assets and their local files. Type DELETE to continue.`,
    permanentDeleteSelectionBlocked:
      locale === "zh-CN"
        ? "批量永久删除仅适用于全部为 generated 的所选资产。"
        : "Bulk permanent delete is only available when every selected asset is generated.",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{text.assetPageTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{text.assetPageSubtitle}</p>
          <p className="mt-1 text-sm text-gray-500">{copy.assetManageHint}</p>
        </div>
      </div>

      <AssetImportForm projects={projects} />

      <div className="flex flex-wrap gap-2">
        {[
          { key: "active" as const, label: copy.activeView },
          { key: "trashed" as const, label: copy.trashView },
          { key: "all" as const, label: copy.allView },
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

      {canSelect && (
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
            {selectionMode ? copy.cancelSelection : copy.selectAssets}
          </button>
        </div>
      )}

      {selectionMode && canSelect && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-gray-500">{copy.selectedAssets}</span>
            <div className="flex flex-wrap gap-2">
              {canSelectActive && (
                <button
                  onClick={() => {
                    if (selectedIds.length === 0) return;
                    const confirmed = window.confirm(copy.trashConfirm);
                    if (!confirmed) return;
                    Promise.all(selectedIds.map((id) => trashAsset.mutateAsync(id)))
                      .then(() => {
                        resetSelection();
                        setActionNotice(copy.movedToTrashNotice);
                      })
                      .catch(() => setActionNotice(copy.trashActionFailed));
                  }}
                  disabled={selectedIds.length === 0 || trashAsset.isPending}
                  className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {trashAsset.isPending ? copy.movingToTrash : copy.moveToTrash}
                </button>
              )}
              {canSelectTrash && (
                <>
                  <button
                    onClick={() => {
                      if (selectedIds.length === 0) return;
                      Promise.all(selectedIds.map((id) => restoreAsset.mutateAsync(id)))
                        .then(() => {
                          resetSelection();
                          setActionNotice(copy.restoredBatchNotice);
                        })
                        .catch(() => setActionNotice(copy.trashActionFailed));
                    }}
                    disabled={selectedIds.length === 0 || restoreAsset.isPending}
                    className="rounded border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {restoreAsset.isPending ? copy.restoringSelected : copy.restoreSelected}
                  </button>
                  <button
                    onClick={() => {
                      if (selectedIds.length === 0) return;
                      const confirmed = window.confirm(copy.removeSelectedConfirm);
                      if (!confirmed) return;
                      Promise.all(selectedIds.map((id) => removeAsset.mutateAsync(id)))
                        .then(() => {
                          resetSelection();
                          setActionNotice(copy.removedBatchNotice);
                        })
                        .catch(() => setActionNotice(copy.removeActionFailed));
                    }}
                    disabled={selectedIds.length === 0 || removeAsset.isPending}
                    className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removeAsset.isPending ? copy.removingSelected : copy.removeSelected}
                  </button>
                  {canBulkPermanentDelete && (
                    <button
                      onClick={() => {
                        if (selectedIds.length === 0) return;
                        const confirmation = window.prompt(copy.permanentDeleteSelectedPrompt, "");
                        if (confirmation !== "DELETE") return;
                        Promise.all(selectedIds.map((id) => permanentlyDeleteAsset.mutateAsync(id)))
                          .then(() => {
                            resetSelection();
                            setActionNotice(copy.permanentDeletedBatchNotice);
                          })
                          .catch(() => setActionNotice(copy.permanentDeleteFailed));
                      }}
                      disabled={permanentlyDeleteAsset.isPending}
                      className="rounded border border-red-400 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {permanentlyDeleteAsset.isPending
                        ? copy.permanentlyDeletingSelected
                        : copy.permanentDeleteSelected}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {canSelectTrash && selectedIds.length > 0 && !canBulkPermanentDelete && (
            <p className="mt-3 text-xs text-amber-700">{copy.permanentDeleteSelectionBlocked}</p>
          )}
        </div>
      )}

      {result.isLoading && <p className="text-sm text-gray-500">{text.loadingAssets}</p>}
      {result.isError && (
        <p className="text-sm text-red-600">
          {text.assetLoadError} {String(result.error)}
        </p>
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
            selectable={selectionMode && canSelect}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onRestoreAsset={(assetId) =>
              restoreAsset.mutate(assetId, {
                onSuccess: () => setActionNotice(copy.restoredNotice),
                onError: () => setActionNotice(copy.trashActionFailed),
              })}
            onRemoveAsset={(assetId) => {
              const confirmed = window.confirm(copy.removeConfirm);
              if (!confirmed) return;
              removeAsset.mutate(assetId, {
                onSuccess: () => setActionNotice(copy.removeNotice),
                onError: () => setActionNotice(copy.removeActionFailed),
              });
            }}
            onPermanentlyDeleteAsset={(assetId) => {
              const confirmed = window.confirm(copy.permanentDeleteConfirm);
              if (!confirmed) return;
              permanentlyDeleteAsset.mutate(assetId, {
                onSuccess: () => setActionNotice(copy.permanentDeleteNotice),
                onError: () => setActionNotice(copy.permanentDeleteFailed),
              });
            }}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {text.previous}
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {text.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
