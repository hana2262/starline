import { useState } from "react";
import { useProjects } from "../hooks/useProjects.js";
import ProjectList from "../components/ProjectList.js";
import ProjectCreateModal from "../components/ProjectCreateModal.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  onOpenProject?: (projectId: string) => void;
}

export default function ProjectsPage({ apiReady, onOpenProject }: Props) {
  const { text } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const { data: projects, isLoading, isError, error } = useProjects(apiReady);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{text.projectsTitle}</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {text.newProject}
        </button>
      </div>

      {isLoading && <p className="text-gray-400 text-sm">{text.loading}</p>}
      {isError && (
        <p className="text-red-600 text-sm">Error: {String(error)}</p>
      )}
      {projects && <ProjectList projects={projects} onOpenProject={onOpenProject} />}

      {showCreate && <ProjectCreateModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
