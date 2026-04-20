import type { ProjectResponse } from "@starline/shared";
import { useEffect, useState } from "react";
import { useAssets } from "../hooks/useAssets.js";
import { useUpdateProject } from "../hooks/useProjects.js";
import AssetList from "../components/AssetList.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  project: ProjectResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onBack: () => void;
  onOpenAsset?: (assetId: string) => void;
}

export default function ProjectDetailPage(props: Props) {
  const { locale, text, formatProjectStatus, formatVisibility } = useI18n();
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const updateProject = useUpdateProject();
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

  useEffect(() => {
    if (!props.project) return;
    setName(props.project.name);
    setDescription(props.project.description ?? "");
    setStatus(props.project.status);
    setVisibility(props.project.visibility);
  }, [props.project]);

  const totalPages = projectAssets.data
    ? Math.max(1, Math.ceil(projectAssets.data.total / pageSize))
    : 1;

  const isDirty = props.project
    ? name !== props.project.name ||
      description !== (props.project.description ?? "") ||
      status !== props.project.status ||
      visibility !== props.project.visibility
    : false;
  const projectStatusLabel = text.projectStatusLabel ?? (locale === "zh-CN" ? "项目状态" : text.statusLabel);
  const savingLabel = text.saving ?? (locale === "zh-CN" ? "保存中..." : "Saving...");
  const saveChangesLabel = text.saveChanges ?? (locale === "zh-CN" ? "保存更改" : "Save changes");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={props.onBack} className="text-sm text-blue-600 hover:text-blue-700">
        {text.projectDetailBack}
      </button>

      {props.isLoading && <p className="text-sm text-gray-500">{text.loadingProject}</p>}

      {props.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{text.projectLoadFailed}</p>
          <p className="mt-1 text-sm text-red-600">{String(props.error)}</p>
        </div>
      )}

      {!props.isLoading && !props.isError && !props.project && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">{text.projectNotFound}</p>
        </div>
      )}

      {props.project && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{props.project.name}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {props.project.description || text.noDescriptionYet}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    props.project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {formatProjectStatus(props.project.status)}
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  {formatVisibility(props.project.visibility)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{text.name}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{text.visibilityLabel}</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "public" | "private")}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="public">{formatVisibility("public")}</option>
                  <option value="private">{formatVisibility("private")}</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">{text.description}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  {projectStatusLabel}
                </span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as "active" | "archived")}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">{formatProjectStatus("active")}</option>
                  <option value="archived">{formatProjectStatus("archived")}</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    updateProject.mutate({
                      id: props.project!.id,
                      input: {
                        name: name.trim(),
                        description: description.trim() ? description.trim() : null,
                        status,
                        visibility,
                      },
                    });
                  }}
                  disabled={!isDirty || updateProject.isPending || name.trim().length === 0}
                  className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {updateProject.isPending ? savingLabel : saveChangesLabel}
                </button>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">{text.created}</dt>
                <dd className="mt-1 text-gray-900">{new Date(props.project.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">{text.updated}</dt>
                <dd className="mt-1 text-gray-900">{new Date(props.project.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900">{text.projectAssets}</h3>
            <p className="mt-2 text-sm text-gray-500">{text.projectAssetsBody}</p>

            <div className="mt-4">
              {projectAssets.isLoading && <p className="text-sm text-gray-500">{text.loadingProjectAssets}</p>}
              {projectAssets.isError && (
                <p className="text-sm text-red-600">
                  {text.projectAssetsLoadError} {String(projectAssets.error)}
                </p>
              )}
              {projectAssets.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{text.showingAssets(projectAssets.data.items.length, projectAssets.data.total)}</span>
                    <span>{text.pageLabel(page + 1, totalPages)}</span>
                  </div>

                  <AssetList result={projectAssets.data} onOpenAsset={props.onOpenAsset} />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0}
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {text.previous}
                    </button>
                    <button
                      onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                      disabled={page >= totalPages - 1}
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
