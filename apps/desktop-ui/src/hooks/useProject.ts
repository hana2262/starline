import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../lib/api.js";

export function useProject(projectId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: enabled && Boolean(projectId),
  });
}
