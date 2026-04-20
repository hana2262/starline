import { useEffect, useMemo, useState } from "react";
import type { AssetResponse, ProjectResponse } from "@starline/shared";
import { useI18n } from "../lib/i18n.js";
import { assetsApi } from "../lib/api.js";

interface Props {
  asset: AssetResponse | undefined;
  projects: ProjectResponse[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onBack: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetPreview({ asset }: { asset: AssetResponse }) {
  const { text, formatAssetType } = useI18n();
  const [promptContent, setPromptContent] = useState<string>("");
  const [promptState, setPromptState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const contentUrl = useMemo(() => assetsApi.contentUrl(asset.id), [asset.id]);

  useEffect(() => {
    if (asset.type !== "prompt") {
      setPromptContent("");
      setPromptState("idle");
      return;
    }

    let cancelled = false;
    setPromptState("loading");
    fetch(contentUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Preview request failed with status ${response.status}`);
        }
        return response.text();
      })
      .then((content) => {
        if (!cancelled) {
          setPromptContent(content);
          setPromptState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromptContent("");
          setPromptState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset.type, contentUrl]);

  if (asset.type === "image") {
    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
        <img src={contentUrl} alt={asset.name} className="max-h-[32rem] w-full object-contain" />
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
        <video src={contentUrl} controls className="max-h-[32rem] w-full" />
      </div>
    );
  }

  if (asset.type === "audio") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <audio src={contentUrl} controls className="w-full" />
      </div>
    );
  }

  if (asset.type === "prompt") {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-950 p-4">
        {promptState === "loading" && (
          <p className="text-sm text-gray-300">{text.loadingPromptPreview}</p>
        )}
        {promptState === "failed" && (
          <p className="text-sm text-red-300">{text.promptPreviewFailed}</p>
        )}
        {promptState === "ready" && (
          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-100">
            {promptContent}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-gray-700">{text.previewUnavailableTitle}</p>
      <p className="mt-2 text-sm text-gray-500">
        {text.previewUnavailableBody(formatAssetType(asset.type))}
      </p>
    </div>
  );
}

export default function AssetDetailPage({ asset, projects, isLoading, isError, error, onBack }: Props) {
  const { text, formatAssetType, formatVisibility } = useI18n();
  const project = useMemo(
    () => projects.find((item) => item.id === asset?.projectId) ?? null,
    [asset?.projectId, projects],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-700">
        {text.assetDetailBack}
      </button>

      {isLoading && <p className="text-sm text-gray-500">{text.loadingAssetDetail}</p>}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{text.assetDetailLoadFailed}</p>
          <p className="mt-1 text-sm text-red-600">{String(error)}</p>
        </div>
      )}

      {!isLoading && !isError && !asset && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">{text.assetDetailNotFound}</p>
        </div>
      )}

      {asset && (
        <>
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
            <AssetPreview asset={asset} />

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold text-gray-900">{asset.name}</h2>
                  <p className="mt-1 text-sm text-gray-500 break-all">{asset.filePath}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {formatAssetType(asset.type)}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                    {formatVisibility(asset.visibility)}
                  </span>
                </div>
              </div>

              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">{text.project}</dt>
                  <dd className="mt-1 text-gray-900">{project?.name ?? text.noProject}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.fileSizeLabel}</dt>
                  <dd className="mt-1 text-gray-900">{formatFileSize(asset.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.statusLabel}</dt>
                  <dd className="mt-1 text-gray-900">{asset.status}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.mimeTypeLabel}</dt>
                  <dd className="mt-1 text-gray-900">{asset.mimeType ?? text.notAvailable}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.created}</dt>
                  <dd className="mt-1 text-gray-900">{new Date(asset.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.updated}</dt>
                  <dd className="mt-1 text-gray-900">{new Date(asset.updatedAt).toLocaleString()}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">{text.description}</dt>
                  <dd className="mt-1 text-gray-900">{asset.description || text.noDescriptionYet}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">{text.contentHashLabel}</dt>
                  <dd className="mt-1 break-all text-gray-900">{asset.contentHash}</dd>
                </div>
                {asset.sourceConnector && (
                  <div>
                    <dt className="text-gray-500">{text.assetGeneratedFrom}</dt>
                    <dd className="mt-1 text-gray-900">{asset.sourceConnector}</dd>
                  </div>
                )}
              </dl>

              {asset.tags.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700">{text.tags}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {asset.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
