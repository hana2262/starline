import type { AssetListResponse, AssetResponse } from "@starline/shared";
import { useI18n } from "../lib/i18n.js";

interface Props {
  result: AssetListResponse;
  onOpenAsset?: (assetId: string) => void;
  projectNameById?: Record<string, string>;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelected?: (assetId: string, checked: boolean) => void;
  onRestoreAsset?: (assetId: string) => void;
  onRemoveAsset?: (assetId: string) => void;
  onPermanentlyDeleteAsset?: (assetId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTrashMeta(asset: AssetResponse): { purgeAt: Date; daysRemaining: number } | null {
  if (!asset.trashedAt) return null;
  const trashedAt = new Date(asset.trashedAt);
  const purgeAt = new Date(trashedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return { purgeAt, daysRemaining };
}

export default function AssetList({
  result,
  onOpenAsset,
  projectNameById = {},
  selectable = false,
  selectedIds = [],
  onToggleSelected,
  onRestoreAsset,
  onRemoveAsset,
  onPermanentlyDeleteAsset,
}: Props) {
  const { locale, text, formatAssetType, formatVisibility } = useI18n();
  const restoreLabel = locale === "zh-CN" ? "恢复" : "Restore";
  const removeLabel = locale === "zh-CN" ? "从平台移除" : "Remove from library";
  const permanentDeleteLabel = locale === "zh-CN" ? "永久删除" : "Permanently delete";
  const trashedStatusLabel = locale === "zh-CN" ? "回收站" : "Trash";
  const selectAssetLabel = locale === "zh-CN" ? "选择资产" : "Select asset";
  const importedOriginLabel = locale === "zh-CN" ? "用户导入" : "Imported";
  const generatedOriginLabel = locale === "zh-CN" ? "平台生成" : "Generated";
  const purgeAtLabel = locale === "zh-CN" ? "自动清理时间" : "Auto purge";
  const daysRemainingLabel = (days: number) =>
    locale === "zh-CN" ? `剩余 ${days} 天` : `${days} days remaining`;
  const trashedAtLabel = locale === "zh-CN" ? "移入回收站时间" : "Trashed at";
  const originLabel = locale === "zh-CN" ? "来源" : "Origin";

  if (result.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        {text.assetEmpty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.items.map((asset) => {
        const trashMeta = getTrashMeta(asset);

        return (
          <article key={asset.id} className="rounded-lg border border-gray-200 bg-white p-4">
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
                <p className="mt-1 break-all text-sm text-gray-500">{asset.filePath}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
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
              <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">{formatFileSize(asset.fileSize)}</span>
              <span className="rounded bg-gray-100 px-2 py-1">
                {asset.projectId ? (projectNameById[asset.projectId] ?? asset.projectId) : text.assetStatusNoProject}
              </span>
              <span className={`rounded px-2 py-1 ${asset.status === "trashed" ? "bg-red-50 text-red-700" : "bg-gray-100"}`}>
                {asset.status === "trashed" ? trashedStatusLabel : asset.status}
              </span>
              <span className="rounded bg-purple-50 px-2 py-1 text-purple-700">
                {originLabel}: {asset.origin === "generated" ? generatedOriginLabel : importedOriginLabel}
              </span>
              {asset.sourceConnector && (
                <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">
                  {text.assetGeneratedFrom}: {asset.sourceConnector}
                </span>
              )}
            </div>

            {asset.status === "trashed" && trashMeta && (
              <div className="mt-3 grid gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800 sm:grid-cols-3">
                <div>
                  <span className="font-medium">{trashedAtLabel}:</span>{" "}
                  {new Date(asset.trashedAt!).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">{purgeAtLabel}:</span>{" "}
                  {trashMeta.purgeAt.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">{daysRemainingLabel(trashMeta.daysRemaining)}</span>
                </div>
              </div>
            )}

            {asset.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {asset.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              {asset.status === "trashed" && onRestoreAsset && (
                <button
                  onClick={() => onRestoreAsset(asset.id)}
                  className="text-sm font-medium text-green-600 hover:text-green-700"
                >
                  {restoreLabel}
                </button>
              )}
              {asset.status === "trashed" && onRemoveAsset && (
                <button
                  onClick={() => onRemoveAsset(asset.id)}
                  className="text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  {removeLabel}
                </button>
              )}
              {asset.status === "trashed" && asset.origin === "generated" && onPermanentlyDeleteAsset && (
                <button
                  onClick={() => onPermanentlyDeleteAsset(asset.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  {permanentDeleteLabel}
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
        );
      })}
    </div>
  );
}
