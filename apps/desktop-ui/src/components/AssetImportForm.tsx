import { useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";
import { useImportAsset } from "../hooks/useImportAsset.js";

interface Props {
  projects: ProjectResponse[];
}

const ASSET_TYPES: Array<AssetType> = ["image", "video", "audio", "prompt", "other"];

export default function AssetImportForm({ projects }: Props) {
  const importAsset = useImportAsset();
  const [filePath, setFilePath] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("other");
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");

  const feedback = useMemo(() => {
    if (!importAsset.data) return null;
    return importAsset.data.created
      ? `Imported asset: ${importAsset.data.asset.name}`
      : `Used existing asset: ${importAsset.data.asset.name}`;
  }, [importAsset.data]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    importAsset.mutate({
      filePath: filePath.trim(),
      type,
      name: name.trim() || undefined,
      projectId: projectId || undefined,
      tags: tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Import Asset</h2>
        <p className="text-sm text-gray-500 mt-1">
          Sprint-1 uses manual path entry. Native file-picker stays out of scope.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">File path</span>
          <input
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            placeholder="C:\\assets\\image.png"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as AssetType)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSET_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Name override</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Optional asset name"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Tags</span>
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
            {importAsset.isPending ? "Importing..." : "Import Asset"}
          </button>
        </div>
      </form>
    </div>
  );
}
