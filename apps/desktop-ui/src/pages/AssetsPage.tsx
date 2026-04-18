import { useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";
import { useAssets } from "../hooks/useAssets.js";
import AssetFilters from "../components/AssetFilters.js";
import AssetImportForm from "../components/AssetImportForm.js";
import AssetList from "../components/AssetList.js";

interface Props {
  apiReady: boolean;
  projects: ProjectResponse[];
}

const PAGE_SIZE = 10;

export default function AssetsPage({ apiReady, projects }: Props) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<AssetType | "">("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [page, setPage] = useState(0);

  const result = useAssets(
    {
      query: query.trim() || undefined,
      projectId: selectedProjectId || undefined,
      type: selectedType || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    apiReady,
  );

  const totalPages = useMemo(() => {
    if (!result.data) return 1;
    return Math.max(1, Math.ceil(result.data.total / PAGE_SIZE));
  }, [result.data]);

  function resetFilters() {
    setQuery("");
    setSelectedType("");
    setSelectedProjectId("");
    setPage(0);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Assets</h2>
        <p className="text-sm text-gray-500 mt-1">
          Import, browse, and search your local asset library.
        </p>
      </div>

      <AssetImportForm projects={projects} />

      <AssetFilters
        query={query}
        selectedType={selectedType}
        selectedProjectId={selectedProjectId}
        projects={projects}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
        onTypeChange={(value) => {
          setSelectedType(value);
          setPage(0);
        }}
        onProjectChange={(value) => {
          setSelectedProjectId(value);
          setPage(0);
        }}
        onReset={resetFilters}
      />

      {result.isLoading && <p className="text-sm text-gray-500">Loading assets...</p>}
      {result.isError && (
        <p className="text-sm text-red-600">Error loading assets: {String(result.error)}</p>
      )}
      {result.data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {result.data.items.length} of {result.data.total} assets
            </span>
            <span>
              Page {page + 1} / {totalPages}
            </span>
          </div>

          <AssetList result={result.data} />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
