import type { AssetType, ProjectResponse } from "@starline/shared";

interface Props {
  query: string;
  selectedType: AssetType | "";
  selectedProjectId: string;
  projects: ProjectResponse[];
  onQueryChange: (value: string) => void;
  onTypeChange: (value: AssetType | "") => void;
  onProjectChange: (value: string) => void;
  onReset: () => void;
}

const ASSET_TYPES: Array<AssetType> = ["image", "video", "audio", "prompt", "other"];

export default function AssetFilters(props: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Search</span>
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="Search by keyword"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Type</span>
          <select
            value={props.selectedType}
            onChange={(event) => props.onTypeChange(event.target.value as AssetType | "")}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Project</span>
          <select
            value={props.selectedProjectId}
            onChange={(event) => props.onProjectChange(event.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All projects</option>
            {props.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={props.onReset}
          className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

