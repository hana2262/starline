import type { ProjectResponse } from "@starline/shared";

interface Props {
  project: ProjectResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onBack: () => void;
}

export default function ProjectDetailPage(props: Props) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={props.onBack}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        ← Back to projects
      </button>

      {props.isLoading && <p className="text-sm text-gray-500">Loading project...</p>}

      {props.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-700">Failed to load project</p>
          <p className="text-sm text-red-600 mt-1">{String(props.error)}</p>
        </div>
      )}

      {!props.isLoading && !props.isError && !props.project && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-800">Project not found</p>
        </div>
      )}

      {props.project && (
        <>
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{props.project.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {props.project.description || "No description yet."}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  props.project.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {props.project.status}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900 mt-1">{new Date(props.project.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd className="text-gray-900 mt-1">{new Date(props.project.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white border border-dashed border-gray-300 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900">Project Assets</h3>
            <p className="text-sm text-gray-500 mt-2">
              Sprint-1 adds the project workspace entry point. Linked asset rendering stays for the next slice.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
