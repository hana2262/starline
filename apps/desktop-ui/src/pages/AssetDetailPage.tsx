import { useEffect, useMemo, useState } from "react";
import type { AssetResponse, ProjectResponse } from "@starline/shared";
import { useUpdateAsset } from "../hooks/useAsset.js";
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
  const [mediaFailed, setMediaFailed] = useState(false);
  const contentUrl = useMemo(() => assetsApi.contentUrl(asset.id), [asset.id]);

  useEffect(() => {
    setMediaFailed(false);
  }, [asset.id, asset.type]);

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
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <img
            src={contentUrl}
            alt={asset.name}
            className="max-h-[32rem] w-full object-contain"
            onError={() => setMediaFailed(true)}
          />
        </div>
        {mediaFailed && <p className="text-sm text-red-600">{text.mediaPreviewFailed ?? text.assetDetailLoadFailed}</p>}
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
          <video
            src={contentUrl}
            controls
            className="max-h-[32rem] w-full"
            onError={() => setMediaFailed(true)}
          />
        </div>
        {mediaFailed && <p className="text-sm text-red-600">{text.mediaPreviewFailed ?? text.assetDetailLoadFailed}</p>}
      </div>
    );
  }

  if (asset.type === "audio") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <audio
            src={contentUrl}
            controls
            className="w-full"
            onError={() => setMediaFailed(true)}
          />
        </div>
        {mediaFailed && <p className="text-sm text-red-600">{text.mediaPreviewFailed ?? text.assetDetailLoadFailed}</p>}
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
  const { locale, text, formatAssetType, formatVisibility } = useI18n();
  const updateAsset = useUpdateAsset();
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [projectId, setProjectId] = useState("");
  const [saveNotice, setSaveNotice] = useState<"idle" | "saved" | "failed">("idle");

  useEffect(() => {
    if (asset) {
      setVisibility(asset.visibility);
      setProjectId(asset.projectId ?? "");
      setSaveNotice("idle");
    }
  }, [asset]);

  const project = useMemo(
    () => projects.find((item) => item.id === asset?.projectId) ?? null,
    [asset?.projectId, projects],
  );

  const generationMeta = useMemo(() => {
    if (!asset?.generationMeta) return null;
    return asset.generationMeta;
  }, [asset?.generationMeta]);

  const visibilityDirty = asset ? visibility !== asset.visibility : false;
  const projectDirty = asset ? projectId !== (asset.projectId ?? "") : false;
  const saveDirty = visibilityDirty || projectDirty;
  const assetAssociationHelp =
    text.assetProjectHelp ??
    (locale === "zh-CN"
      ? "将资产关联到某个项目，或清空项目关联。"
      : "Associate this asset with a project, or clear the project link.");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
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
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {text.assetDetailPreviewTitle ?? "Preview"}
              </h3>
              <div className="mt-4">
                <AssetPreview asset={asset} />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {text.assetDetailSourceTitle ?? "Source"}
              </h3>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500">{text.assetGeneratedFrom}</dt>
                  <dd className="mt-1 text-gray-900">{asset.sourceConnector ?? text.notAvailable}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{text.project}</dt>
                  <dd className="mt-1 text-gray-900">{project?.name ?? text.noProject}</dd>
                </div>
                {asset.generationPrompt && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">Prompt</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-gray-900">
                      {asset.generationPrompt}
                    </dd>
                  </div>
                )}
                {generationMeta && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">Meta</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-700">
                      {generationMeta}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold text-gray-900">{asset.name}</h2>
                  <p className="mt-1 break-all text-sm text-gray-500">{asset.filePath}</p>
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

              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">{text.project}</span>
                  <select
                    value={projectId}
                    onChange={(event) => {
                      setProjectId(event.target.value);
                      setSaveNotice("idle");
                    }}
                    className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={updateAsset.isPending}
                  >
                    <option value="">{text.noProject}</option>
                    {projects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-gray-500">{assetAssociationHelp}</p>
              </div>

              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700">{text.visibilityLabel}</span>
                  <select
                    value={visibility}
                    onChange={(event) => {
                      setVisibility(event.target.value as "public" | "private");
                      setSaveNotice("idle");
                    }}
                    className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={updateAsset.isPending}
                  >
                    <option value="public">{formatVisibility("public")}</option>
                    <option value="private">{formatVisibility("private")}</option>
                  </select>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  {text.assetVisibilityHelp ?? "Choose whether this asset should be visible to agent retrieval by default."}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => {
                      updateAsset.mutate(
                        {
                          id: asset.id,
                          input: {
                            visibility,
                            projectId: projectId || null,
                          },
                        },
                        {
                          onSuccess: () => setSaveNotice("saved"),
                          onError: () => setSaveNotice("failed"),
                        },
                      );
                    }}
                    disabled={!saveDirty || updateAsset.isPending}
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {updateAsset.isPending
                      ? (text.saving ?? (locale === "zh-CN" ? "保存中..." : "Saving..."))
                      : (text.saveChanges ?? (locale === "zh-CN" ? "保存更改" : "Save changes"))}
                  </button>
                  {saveNotice === "saved" && (
                    <span className="text-sm text-green-700">
                      {text.assetVisibilitySaved ?? (locale === "zh-CN" ? "资产设置已保存。" : "Asset settings saved.")}
                    </span>
                  )}
                  {saveNotice === "failed" && (
                    <span className="text-sm text-red-600">
                      {text.assetVisibilitySaveFailed ?? (locale === "zh-CN" ? "保存资产设置失败。" : "Failed to save asset settings.")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {text.assetDetailMetadataTitle ?? "Metadata"}
              </h3>

              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
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
              </dl>

              {asset.tags.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700">{text.tags}</h4>
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
          </div>
        </section>
      )}
    </div>
  );
}
