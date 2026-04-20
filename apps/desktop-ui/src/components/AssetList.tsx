import type { AssetListResponse } from "@starline/shared";
import { useI18n } from "../lib/i18n.js";

interface Props {
  result: AssetListResponse;
  onOpenAsset?: (assetId: string) => void;
  projectNameById?: Record<string, string>;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelected?: (assetId: string, checked: boolean) => void;
  onRestoreAsset?: (assetId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetList({
  result,
  onOpenAsset,
  projectNameById = {},
  selectable = false,
  selectedIds = [],
  onToggleSelected,
  onRestoreAsset,
}: Props) {
  const { locale, text, formatAssetType, formatVisibility } = useI18n();
  const restoreLabel = locale === "zh-CN" ? "恢复" : "Restore";
  const trashedStatusLabel = locale === "zh-CN" ? "回收站" : "Trash";
  const selectAssetLabel = locale === "zh-CN" ? "选择资产" : "Select asset";

  if (result.items.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
        {text.assetEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.items.map((asset) => (
        <article key={asset.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {selectable && asset.status === "active" && (
                <label className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(asset.id)}
                    onChange={(event) => onToggleSelected?.(asset.id, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{selectAssetLabel}</span>
                </label>
              )}
              <button
                onClick={() => onOpenAsset?.(asset.id)}
                className="truncate text-left font-medium text-gray-900 hover:text-blue-600"
              >
                {asset.name}
              </button>
              <p className="text-sm text-gray-500 mt-1 break-all">{asset.filePath}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {formatAssetType(asset.type)}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  asset.visibility === "private"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {formatVisibility(asset.visibility)}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">
              {formatFileSize(asset.fileSize)}
            </span>
            <span className="px-2 py-1 rounded bg-gray-100">
              {asset.projectId ? (projectNameById[asset.projectId] ?? asset.projectId) : text.assetStatusNoProject}
            </span>
            <span className={`px-2 py-1 rounded ${asset.status === "trashed" ? "bg-red-50 text-red-700" : "bg-gray-100"}`}>
              {asset.status === "trashed" ? trashedStatusLabel : asset.status}
            </span>
            {asset.sourceConnector && (
              <span className="px-2 py-1 rounded bg-purple-50 text-purple-700">
                {text.assetGeneratedFrom}: {asset.sourceConnector}
              </span>
            )}
          </div>

          {asset.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {asset.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 rounded-full text-xs bg-green-50 text-green-700">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-3">
            {asset.status === "trashed" && onRestoreAsset && (
              <button
                onClick={() => onRestoreAsset(asset.id)}
                className="text-sm font-medium text-green-600 hover:text-green-700"
              >
                {restoreLabel}
              </button>
            )}
            <button
              onClick={() => onOpenAsset?.(asset.id)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {text.viewAssetDetail}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
