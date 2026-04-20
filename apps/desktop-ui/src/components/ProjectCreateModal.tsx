import { useState } from "react";
import { useCreateProject } from "../hooks/useProjects.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  onClose: () => void;
}

export default function ProjectCreateModal({ onClose }: Props) {
  const { text, formatVisibility } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const createProject = useCreateProject();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined, visibility },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{text.projectModalTitle}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {text.name} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={text.myProject}
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {text.description}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder={text.optionalDescription}
              maxLength={2000}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {text.visibilityLabel}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="public">{formatVisibility("public")}</option>
              <option value="private">{formatVisibility("private")}</option>
            </select>
          </div>
          {createProject.isError && (
            <p className="text-red-600 text-sm">{String(createProject.error)}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
            >
              {text.cancel}
            </button>
            <button
              type="submit"
              disabled={createProject.isPending || !name.trim()}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createProject.isPending ? text.creating : text.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
