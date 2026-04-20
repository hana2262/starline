import type { AssetType, ProjectResponse } from "@starline/shared";
import { useI18n } from "../lib/i18n.js";

interface Props {
  query: string;
  selectedType: AssetType | "";
  selectedProjectId: string;
  selectedStatus: "active" | "trashed" | "all";
  projects: ProjectResponse[];
  onQueryChange: (value: string) => void;
  onTypeChange: (value: AssetType | "") => void;
  onProjectChange: (value: string) => void;
  onStatusChange: (value: "active" | "trashed" | "all") => void;
  onReset: () => void;
}

const ASSET_TYPES: AssetType[] = ["image", "video", "audio", "prompt", "other"];

export default function AssetFilters(props: Props) {
  const { locale, text, formatAssetType } = useI18n();
  const activeLabel = locale === "zh-CN" ? "活跃" : "Active";
  const trashLabel = locale === "zh-CN" ? "回收站" : "Trash";
  const allStatusLabel = locale === "zh-CN" ? "全部状态" : "All statuses";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.search}</span>
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={text.searchPlaceholder}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.type}</span>
          <select
            value={props.selectedType}
            onChange={(event) => props.onTypeChange(event.target.value as AssetType | "")}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{text.allTypes}</option>
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatAssetType(type)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.project}</span>
          <select
            value={props.selectedProjectId}
            onChange={(event) => props.onProjectChange(event.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{text.allProjects}</option>
            {props.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">{text.statusLabel}</span>
          <select
            value={props.selectedStatus}
            onChange={(event) => props.onStatusChange(event.target.value as "active" | "trashed" | "all")}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">{activeLabel}</option>
            <option value="trashed">{trashLabel}</option>
            <option value="all">{allStatusLabel}</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={props.onReset}
          className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          {text.resetFilters}
        </button>
      </div>
    </div>
  );
}
