import type { AssetListResponse } from "@starline/shared";

interface Props {
  result: AssetListResponse;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetList({ result }: Props) {
  if (result.items.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
        No assets found. Import a file or adjust your filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result.items.map((asset) => (
        <article key={asset.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{asset.name}</h3>
              <p className="text-sm text-gray-500 mt-1 break-all">{asset.filePath}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
              {asset.type}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">
              {formatFileSize(asset.fileSize)}
            </span>
            <span className="px-2 py-1 rounded bg-gray-100">
              {asset.projectId ?? "No project"}
            </span>
            <span className="px-2 py-1 rounded bg-gray-100">{asset.status}</span>
            {asset.sourceConnector && (
              <span className="px-2 py-1 rounded bg-purple-50 text-purple-700">
                {asset.sourceConnector}
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
        </article>
      ))}
    </div>
  );
}

