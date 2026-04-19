import type { ProjectResponse } from "@starline/shared";
import { useState } from "react";
import { useAssets } from "../hooks/useAssets.js";
import AssetList from "../components/AssetList.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  project: ProjectResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onBack: () => void;
}

export default function ProjectDetailPage(props: Props) {
  const { text, formatProjectStatus } = useI18n();
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const projectAssets = useAssets(
    {
      query: undefined,
      projectId: props.project?.id,
      type: undefined,
      limit: pageSize,
      offset: page * pageSize,
    },
    props.apiReady && Boolean(props.project?.id),
  );

  const totalPages = projectAssets.data
    ? Math.max(1, Math.ceil(projectAssets.data.total / pageSize))
    : 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={props.onBack}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        ← {text.projectDetailBack}
      </button>

      {props.isLoading && <p className="text-sm text-gray-500">{text.loadingProject}</p>}

      {props.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700">{text.projectLoadFailed}</p>
          <p className="text-sm text-red-600 mt-1">{String(props.error)}</p>
        </div>
      )}

      {!props.isLoading && !props.isError && !props.project && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">{text.projectNotFound}</p>
        </div>
      )}

      {props.project && (
        <>
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{props.project.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {props.project.description || text.noDescriptionYet}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  props.project.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {formatProjectStatus(props.project.status)}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-gray-500">{text.created}</dt>
                <dd className="text-gray-900 mt-1">{new Date(props.project.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{text.updated}</dt>
                <dd className="text-gray-900 mt-1">{new Date(props.project.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white border border-dashed border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900">{text.projectAssets}</h3>
            <p className="text-sm text-gray-500 mt-2">
              {text.projectAssetsBody}
            </p>

            <div className="mt-4">
              {projectAssets.isLoading && <p className="text-sm text-gray-500">{text.loadingProjectAssets}</p>}
              {projectAssets.isError && (
                <p className="text-sm text-red-600">{text.projectAssetsLoadError} {String(projectAssets.error)}</p>
              )}
              {projectAssets.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {text.showingAssets(projectAssets.data.items.length, projectAssets.data.total)}
                    </span>
                    <span>
                      {text.pageLabel(page + 1, totalPages)}
                    </span>
                  </div>

                  <AssetList result={projectAssets.data} />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                      className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {text.previous}
                    </button>
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {text.next}
                    </button>
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
