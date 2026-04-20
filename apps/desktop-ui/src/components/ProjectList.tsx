import type { ProjectResponse } from "@starline/shared";
import ProjectCard from "./ProjectCard.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  projects: ProjectResponse[];
  onOpenProject?: (projectId: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelected?: (projectId: string, checked: boolean) => void;
}

export default function ProjectList({
  projects,
  onOpenProject,
  selectable = false,
  selectedIds = [],
  onToggleSelected,
}: Props) {
  const { text } = useI18n();

  if (projects.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-12">
        {text.projectListEmpty}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          onOpen={onOpenProject}
          selectable={selectable}
          selected={selectedIds.includes(p.id)}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </div>
  );
}
