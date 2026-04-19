import type { ProjectResponse } from "@starline/shared";
import { useArchiveProject } from "../hooks/useProjects.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  project: ProjectResponse;
  onOpen?: (projectId: string) => void;
}

export default function ProjectCard({ project, onOpen }: Props) {
  const archive = useArchiveProject();
  const { text, formatProjectStatus } = useI18n();

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start justify-between hover:shadow-sm transition-shadow">
      <div>
        <button
          onClick={() => onOpen?.(project.id)}
          className="font-medium text-gray-900 hover:text-blue-600 text-left"
        >
          {project.name}
        </button>
        {project.description && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
            {project.description}
          </p>
        )}
        <span
          className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            project.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {formatProjectStatus(project.status)}
        </span>
      </div>
      {project.status === "active" && (
        <button
          onClick={() => {
            if (confirm(text.archiveConfirm(project.name))) {
              archive.mutate(project.id);
            }
          }}
          className="text-xs text-gray-400 hover:text-red-500 ml-4 shrink-0"
          title={text.archiveProject}
        >
          {text.archive}
        </button>
      )}
    </div>
  );
}
