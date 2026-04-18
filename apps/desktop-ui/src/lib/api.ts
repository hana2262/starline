import type {
  ProjectResponse,
  CreateProjectInput,
  UpdateProjectInput,
  AssetResponse,
  AssetListResponse,
  ImportAssetInput,
  ImportAssetResult,
  ListAssetsQuery,
  ConnectorConfigListResult,
  ConnectorConfigUpsertInput,
  ConnectorConfigUpsertResult,
  ConnectorHealthResponse,
} from "@starline/shared";
import { API_BASE } from "./runtime.js";

const BASE = API_BASE;

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
  getById: (id: string) => request<ProjectResponse>(`/projects/${id}`),
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

function toQueryString(query: ListAssetsQuery): string {
  const params = new URLSearchParams();
  if (query.query) params.set("query", query.query);
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.type) params.set("type", query.type);
  params.set("limit", String(query.limit));
  params.set("offset", String(query.offset));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const assetsApi = {
  list: (query: ListAssetsQuery) =>
    request<AssetListResponse>(`/assets${toQueryString(query)}`),
  getById: (id: string) => request<AssetResponse>(`/assets/${id}`),
  import: (input: ImportAssetInput) =>
    request<ImportAssetResult>("/assets/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

export const connectorsApi = {
  list: () => request<ConnectorConfigListResult>("/connectors"),
  save: (input: ConnectorConfigUpsertInput) =>
    request<ConnectorConfigUpsertResult>("/connectors", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  test: (connectorId: string) =>
    request<ConnectorHealthResponse>(`/connectors/${connectorId}/test`, {
      method: "POST",
    }),
};
