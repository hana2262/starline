import { useMemo, useRef, useState } from "react";
import type { AssetType, ImportAssetFolderResult, ProjectResponse } from "@starline/shared";
import { useImportAsset, useImportAssetFolder } from "../hooks/useImportAsset.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  projects: ProjectResponse[];
}

const ASSET_TYPES: Array<AssetType> = ["image", "video", "audio", "prompt", "other"];

type DirectoryFile = File & { path?: string };

function deriveFolderPath(files: DirectoryFile[]): string | null {
  const first = files.find((file) => typeof file.path === "string" && file.path.length > 0);
  if (!first?.path) return null;

  const relativePath = first.webkitRelativePath || first.name;
  const separator = first.path.includes("\\") ? "\\" : "/";
  const normalizedRelativePath = relativePath.split("/").join(separator);

  if (!first.path.endsWith(normalizedRelativePath)) {
    return first.path;
  }

  const prefix = first.path
    .slice(0, first.path.length - normalizedRelativePath.length)
    .replace(/[\\/]+$/, "");
  const rootDirectoryName = relativePath.split("/")[0] ?? "";
  if (!rootDirectoryName) {
    return first.path;
  }

  return prefix ? `${prefix}${separator}${rootDirectoryName}` : rootDirectoryName;
}

function buildFolderImportSummary(locale: "zh-CN" | "en", result: ImportAssetFolderResult, formatAssetType: (type: AssetType) => string): string {
  const typeOrder: AssetType[] = ["image", "video", "audio", "prompt", "other"];
  const counters = new Map<AssetType, number>();

  for (const item of result.items) {
    counters.set(item.asset.type, (counters.get(item.asset.type) ?? 0) + 1);
  }

  const typeLines = typeOrder
    .filter((type) => (counters.get(type) ?? 0) > 0)
    .map((type) => {
      const count = counters.get(type) ?? 0;
      if (locale === "zh-CN") {
        return `本次导入 ${count} 条${formatAssetType(type)}`;
      }
      return `${count} ${formatAssetType(type)}`;
    });

  if (locale === "zh-CN") {
    return [
      "文件夹导入完成",
      ...typeLines,
      `新增 ${result.importedCount} 项`,
      `复用 ${result.reusedCount} 项`,
      `失败 ${result.failedCount} 项`,
    ].join("\n");
  }

  return [
    "Folder import complete",
    ...typeLines,
    `Imported: ${result.importedCount}`,
    `Reused: ${result.reusedCount}`,
    `Failed: ${result.failedCount}`,
  ].join("\n");
}

export default function AssetImportForm({ projects }: Props) {
  const { locale, text, formatAssetType, formatVisibility } = useI18n();
  const importAsset = useImportAsset();
  const importAssetFolder = useImportAssetFolder();
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [filePath, setFilePath] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("other");
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const feedback = useMemo(() => {
    if (!importAsset.data) return null;
    return importAsset.data.created
      ? text.importedAsset(importAsset.data.asset.name)
      : text.reusedAsset(importAsset.data.asset.name);
  }, [importAsset.data, text]);

  const folderFeedback = useMemo(() => {
    if (!importAssetFolder.data) return null;
    const imported = importAssetFolder.data.importedCount;
    const reused = importAssetFolder.data.reusedCount;
    const failed = importAssetFolder.data.failedCount;
    if (locale === "zh-CN") {
      return `文件夹导入完成：新增 ${imported} 项，复用 ${reused} 项，失败 ${failed} 项。`;
    }
    return `Folder import complete: ${imported} imported, ${reused} reused, ${failed} failed.`;
  }, [importAssetFolder.data, locale]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    importAsset.mutate({
      filePath: filePath.trim(),
      type,
      name: name.trim() || undefined,
      projectId: projectId || undefined,
      visibility,
      tags: tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
  }

  function handleFolderImport() {
    if (!folderPath.trim()) return;
    importAssetFolder.mutate(
      {
        folderPath: folderPath.trim(),
        projectId: projectId || undefined,
        visibility,
      },
      {
        onSuccess: (result) => {
          window.alert(buildFolderImportSummary(locale, result, formatAssetType));
        },
      },
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{text.importAssetTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {text.importAssetSubtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.filePath}</span>
          <input
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            placeholder="C:\\assets\\image.png"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{text.type}</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as AssetType)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSET_TYPES.map((item) => (
                <option key={item} value={item}>
                  {formatAssetType(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{text.project}</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{text.noProject}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{text.nameOverride}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text.optionalAssetName}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{text.visibilityLabel}</span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "public" | "private")}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="public">{formatVisibility("public")}</option>
              <option value="private">{formatVisibility("private")}</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.tags}</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="comma,separated,tags"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {importAsset.isError && (
          <p className="text-sm text-red-600">
            {String(importAsset.error)}
          </p>
        )}
        {feedback && <p className="text-sm text-green-700">{feedback}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={importAsset.isPending || !filePath.trim()}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importAsset.isPending ? text.importingAsset : text.importAsset}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {locale === "zh-CN" ? "批量导入文件夹" : "Import Folder"}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "zh-CN"
              ? "递归导入文件夹内的文件，自动识别资产类型，并默认使用原文件名。"
              : "Recursively import files from a folder, infer asset types, and use original file names by default."}
          </p>
        </div>

        <input
          ref={(node) => {
            folderInputRef.current = node;
            if (node) {
              node.setAttribute("webkitdirectory", "");
              node.setAttribute("directory", "");
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []) as DirectoryFile[];
            const derivedPath = deriveFolderPath(files);
            if (derivedPath) {
              setFolderPath(derivedPath);
            }
            event.currentTarget.value = "";
          }}
        />

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {locale === "zh-CN" ? "文件夹路径" : "Folder path"}
            </span>
            <div className="flex gap-2">
              <input
                value={folderPath}
                onChange={(event) => setFolderPath(event.target.value)}
                placeholder={locale === "zh-CN" ? "C:\\assets\\batch-folder" : "C:\\assets\\batch-folder"}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {locale === "zh-CN" ? "选择文件夹" : "Choose folder"}
              </button>
            </div>
          </label>

          {importAssetFolder.isError && (
            <p className="text-sm text-red-600">{String(importAssetFolder.error)}</p>
          )}
          {folderFeedback && <p className="text-sm text-green-700">{folderFeedback}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={importAssetFolder.isPending || !folderPath.trim()}
              onClick={handleFolderImport}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importAssetFolder.isPending
                ? (locale === "zh-CN" ? "导入文件夹中..." : "Importing folder...")
                : (locale === "zh-CN" ? "导入文件夹" : "Import folder")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
