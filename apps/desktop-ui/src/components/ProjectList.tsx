import type { ProjectResponse } from "@starline/shared";
import ProjectCard from "./ProjectCard.js";

interface Props {
  projects: ProjectResponse[];
}

export default function ProjectList({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-12">
        No projects yet. Create one to get started.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}
