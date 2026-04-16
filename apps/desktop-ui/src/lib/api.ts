import type {
  ProjectResponse,
  CreateProjectInput,
  UpdateProjectInput,
} from "@starline/shared";

const BASE = "/api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const projectsApi = {
  list: () => request<ProjectResponse[]>("/projects"),
  create: (input: CreateProjectInput) =>
    request<ProjectResponse>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: UpdateProjectInput) =>
    request<ProjectResponse>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archive: (id: string) =>
    request<ProjectResponse>(`/projects/${id}/archive`, { method: "POST" }),
};
