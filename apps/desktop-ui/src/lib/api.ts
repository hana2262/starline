import type {
  ProjectResponse,
  CreateProjectInput,
  UpdateProjectInput,
  AssetResponse,
  AssetListResponse,
  ImportAssetInput,
  ImportAssetResult,
  ImportAssetFolderInput,
  ImportAssetFolderResult,
  ListAssetsQuery,
  UpdateAssetInput,
  ConnectorConfigListResult,
  ConnectorConfigUpsertInput,
  ConnectorConfigUpsertResult,
  ConnectorHealthResponse,
  AgentQueryInput,
  AgentQueryResult,
  AgentSessionListResult,
  AgentSessionResult,
  AnalyticsOverview,
  AnalyticsUsage,
  AnalyticsUsageQuery,
} from "@starline/shared";
import { API_BASE } from "./runtime.js";

const BASE = API_BASE;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${url}`, {
    headers,
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
  remove: (id: string) =>
    fetch(`${BASE}/projects/${id}`, { method: "DELETE" }).then(async (res) => {
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
      }
    }),
};

function toQueryString(query: ListAssetsQuery): string {
  const params = new URLSearchParams();
  if (query.query) params.set("query", query.query);
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  params.set("limit", String(query.limit));
  params.set("offset", String(query.offset));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const assetsApi = {
  list: (query: ListAssetsQuery) =>
    request<AssetListResponse>(`/assets${toQueryString(query)}`),
  getById: (id: string) => request<AssetResponse>(`/assets/${id}`),
  update: (id: string, input: UpdateAssetInput) =>
    request<AssetResponse>(`/assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  moveToTrash: (id: string) =>
    request<AssetResponse>(`/assets/${id}/trash`, {
      method: "POST",
    }),
  restoreFromTrash: (id: string) =>
    request<AssetResponse>(`/assets/${id}/restore`, {
      method: "POST",
    }),
  removeFromLibrary: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
  },
  permanentlyDelete: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/assets/${id}/permanent`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
  },
  contentUrl: (id: string) => `${BASE}/assets/${id}/content`,
  import: (input: ImportAssetInput) =>
    request<ImportAssetResult>("/assets/import", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  importFolder: (input: ImportAssetFolderInput) =>
    request<ImportAssetFolderResult>("/assets/import-folder", {
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

export const agentApi = {
  listSessions: () => request<AgentSessionListResult>("/agent/sessions"),
  query: (input: AgentQueryInput) =>
    request<AgentQueryResult>("/agent/query", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getSession: (id: string) => request<AgentSessionResult>(`/agent/sessions/${id}`),
};

function toAnalyticsUsageQueryString(query: AnalyticsUsageQuery): string {
  const params = new URLSearchParams();
  params.set("from", query.from);
  params.set("to", query.to);
  return `?${params.toString()}`;
}

export const analyticsApi = {
  getOverview: () => request<AnalyticsOverview>("/analytics/overview"),
  getUsage: (query: AnalyticsUsageQuery) =>
    request<AnalyticsUsage>(`/analytics/usage${toAnalyticsUsageQueryString(query)}`),
};
