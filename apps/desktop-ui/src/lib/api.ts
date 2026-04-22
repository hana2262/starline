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
  AgentMessage,
  AgentRuntime,
  AgentProviderActivateResult,
  AgentProviderListResult,
  AgentProviderTestResult,
  AgentProviderUpsertInput,
  AgentProviderUpsertResult,
  AgentSessionListResult,
  AgentSessionResult,
  AnalyticsOverview,
  AnalyticsUsage,
  AnalyticsUsageQuery,
} from "@starline/shared";
import { API_BASE } from "./runtime.js";

const BASE = API_BASE;

export interface AgentQueryStreamHandlers {
  onAck?: () => void;
  onMetadata?: (payload: {
    session: AgentQueryResult["session"];
    userMessage: AgentMessage;
    relatedAssets: AgentQueryResult["relatedAssets"];
    project: AgentQueryResult["project"];
    agentRuntime: AgentQueryResult["agentRuntime"];
    toolUsage: AgentQueryResult["toolUsage"];
  }) => void;
  onAssistantDelta?: (delta: string) => void;
  onDone?: (payload: AgentQueryResult) => void;
  onError?: (message: string) => void;
}

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
  getRuntime: () => request<AgentRuntime>("/agent/runtime"),
  listProviders: () => request<AgentProviderListResult>("/agent/providers"),
  saveProvider: (input: AgentProviderUpsertInput) =>
    request<AgentProviderUpsertResult>("/agent/providers", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  activateProvider: (id: string) =>
    request<AgentProviderActivateResult>(`/agent/providers/${id}/activate`, {
      method: "POST",
    }),
  removeProvider: async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/agent/providers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }
  },
  testProvider: (id: string) =>
    request<AgentProviderTestResult>(`/agent/providers/${id}/test`, {
      method: "POST",
    }),
  query: (input: AgentQueryInput) =>
    request<AgentQueryResult>("/agent/query", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  queryStream: async (input: AgentQueryInput, handlers: AgentQueryStreamHandlers): Promise<void> => {
    const res = await fetch(`${BASE}/agent/query/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status}: ${body}`);
    }

    if (!res.body) {
      throw new Error("Streaming response body is unavailable");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex >= 0) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const lines = rawEvent.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        const dataText = dataLines.join("\n");
        if (!dataText) {
          separatorIndex = buffer.indexOf("\n\n");
          continue;
        }

        switch (eventName) {
          case "ack":
            handlers.onAck?.();
            break;
          case "metadata":
            handlers.onMetadata?.(JSON.parse(dataText) as Parameters<NonNullable<AgentQueryStreamHandlers["onMetadata"]>>[0]);
            break;
          case "assistant_delta":
            handlers.onAssistantDelta?.(JSON.parse(dataText).delta as string);
            break;
          case "done":
            handlers.onDone?.(JSON.parse(dataText) as AgentQueryResult);
            break;
          case "error":
            handlers.onError?.(JSON.parse(dataText).message as string);
            break;
          default:
            break;
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  },
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
