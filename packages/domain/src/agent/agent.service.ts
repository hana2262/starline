import type { AgentRepository, AgentMessageRow, AgentSession, AssetRepository, EventRepository, ProjectRepository } from "@starline/storage";
import type {
  AgentAssetReference,
  AgentMessage,
  AgentQueryInput,
  AgentQueryResult,
  AgentSessionResult,
  ProjectResponse,
} from "@starline/shared";

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: "SESSION_NOT_FOUND" | "PROJECT_NOT_FOUND" | "SESSION_PROJECT_MISMATCH",
    public readonly details?: { sessionId?: string; projectId?: string },
  ) {
    super(message);
    this.name = "AgentError";
  }
}

function toProjectResponse(row: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  visibility: "public" | "private";
  createdAt: string;
  updatedAt: string;
}): ProjectResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    relatedAssetIds: row.relatedAssetIds,
    createdAt: row.createdAt,
  };
}

function buildSessionTitle(query: string): string {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (normalized.length <= 60) return normalized;
  return `${normalized.slice(0, 57)}...`;
}

function buildAssetReason(query: string, asset: {
  name: string;
  type: "image" | "video" | "audio" | "prompt" | "other";
  tags: string[];
}, fallbackUsed: boolean): string {
  if (fallbackUsed) {
    return `No direct search match; using recent ${asset.type} context from the local library.`;
  }

  const normalizedQuery = query.toLowerCase();
  const matchingTags = asset.tags.filter((tag) => normalizedQuery.includes(tag.toLowerCase()));
  if (matchingTags.length > 0) {
    return `Matched query terms through tags: ${matchingTags.slice(0, 3).join(", ")}`;
  }

  return `Relevant ${asset.type} asset matched by local search: ${asset.name}`;
}

function formatAssetLine(asset: AgentAssetReference): string {
  return `- ${asset.name} (${asset.type})${asset.reason ? `: ${asset.reason}` : ""}`;
}

function isAgentVisibleAsset(
  asset: {
    projectId: string | null;
    status: "active" | "trashed";
    visibility: "public" | "private";
  },
  projectRepo: ProjectRepository,
): boolean {
  if (asset.status !== "active") return false;
  if (asset.visibility !== "public") return false;
  if (!asset.projectId) return true;
  const project = projectRepo.getById(asset.projectId);
  if (!project) return true;
  return project.visibility === "public";
}

function listAgentAssets(input: {
  assetRepo: AssetRepository;
  projectRepo: ProjectRepository;
  query?: string;
  projectId?: string;
  allowPrivateForThisQuery: boolean;
}): ReturnType<AssetRepository["list"]>["items"] {
  const items = input.assetRepo.list({
    query: input.query,
    projectId: input.projectId,
    type: undefined,
    visibility: input.allowPrivateForThisQuery ? undefined : "public",
    limit: 5,
    offset: 0,
  }).items;

  if (input.allowPrivateForThisQuery) {
    return items;
  }

  return items.filter((asset) => isAgentVisibleAsset(asset, input.projectRepo));
}

function buildAssistantResponse(input: {
  query: string;
  projectName: string | null;
  projectDescription: string | null;
  relatedAssets: AgentAssetReference[];
  previousAssistantReplyCount: number;
}): string {
  const scopeLine = input.projectName
    ? `Project context: ${input.projectName}${input.projectDescription ? ` - ${input.projectDescription}` : ""}.`
    : "Project context: using the full local asset library.";
  const iterationLine = input.previousAssistantReplyCount > 0
    ? "This session already has prior agent replies, so the guidance below builds on existing context."
    : "This is the first reply in the session, so the guidance below is based on the current query and local retrieval only.";

  if (input.relatedAssets.length === 0) {
    return [
      `Query: ${input.query}`,
      scopeLine,
      iterationLine,
      "No directly related local assets were found.",
      "Suggested next steps:",
      "- Narrow the query with a subject, style, or platform keyword.",
      "- Import a representative prompt/image/audio sample into the project if you want retrieval-backed suggestions.",
      "- If this request is project-specific, resend it with the relevant project selected.",
    ].join("\n");
  }

  const assetLines = input.relatedAssets.map(formatAssetLine);
  return [
    `Query: ${input.query}`,
    scopeLine,
    iterationLine,
    `Found ${input.relatedAssets.length} related local asset(s) that can anchor the next step:`,
    ...assetLines,
    "Suggested next steps:",
    "- Reuse the closest matching asset as the style or structure reference.",
    "- Keep the same project scope while iterating so future retrieval stays coherent.",
    "- If you want more specific guidance, ask for a prompt rewrite, asset shortlist, or connector-specific execution plan.",
  ].join("\n");
}

export function createAgentService(
  agentRepo: AgentRepository,
  projectRepo: ProjectRepository,
  assetRepo: AssetRepository,
  eventRepo?: EventRepository,
) {
  return {
    query(input: AgentQueryInput): AgentQueryResult {
      const existingSession = input.sessionId ? agentRepo.getSessionById(input.sessionId) : undefined;
      if (input.sessionId && !existingSession) {
        throw new AgentError("Agent session not found", "SESSION_NOT_FOUND", { sessionId: input.sessionId });
      }

      const effectiveProjectId = existingSession?.projectId ?? input.projectId ?? null;
      if (existingSession?.projectId && input.projectId && existingSession.projectId !== input.projectId) {
        throw new AgentError("Session project does not match requested project", "SESSION_PROJECT_MISMATCH", {
          sessionId: existingSession.id,
          projectId: input.projectId,
        });
      }

      const projectRow = effectiveProjectId ? projectRepo.getById(effectiveProjectId) : undefined;
      if (effectiveProjectId && !projectRow) {
        throw new AgentError("Project not found", "PROJECT_NOT_FOUND", { projectId: effectiveProjectId });
      }
      const allowPrivateForThisQuery = input.allowPrivateForThisQuery === true;
      const agentVisibleProject = allowPrivateForThisQuery
        ? projectRow
        : projectRow?.visibility === "public" ? projectRow : undefined;

      const session = existingSession ?? agentRepo.createSession({
        projectId: effectiveProjectId,
        title: buildSessionTitle(input.query),
      });

      const previousAssistantReplyCount = agentRepo.listMessagesBySessionAndRole(session.id, "assistant").length;
      let matchedAssets = listAgentAssets({
        assetRepo,
        projectRepo,
        query: input.query,
        projectId: agentVisibleProject ? effectiveProjectId ?? undefined : undefined,
        allowPrivateForThisQuery,
      });
      let fallbackUsed = false;

      if (matchedAssets.length === 0) {
        matchedAssets = listAgentAssets({
          assetRepo,
          projectRepo,
          query: undefined,
          projectId: agentVisibleProject ? effectiveProjectId ?? undefined : undefined,
          allowPrivateForThisQuery,
        });
        fallbackUsed = matchedAssets.length > 0;
      }

      const relatedAssets: AgentAssetReference[] = matchedAssets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        projectId: asset.projectId,
        reason: buildAssetReason(input.query, asset, fallbackUsed),
        sourceConnector: asset.sourceConnector ?? null,
        createdAt: asset.createdAt,
      }));

      const userMessageRow = agentRepo.createMessage({
        sessionId: session.id,
        role: "user",
        content: input.query.trim(),
      });
      const assistantContent = buildAssistantResponse({
        query: input.query.trim(),
        projectName: agentVisibleProject?.name ?? null,
        projectDescription: agentVisibleProject?.description ?? null,
        relatedAssets,
        previousAssistantReplyCount,
      });
      const assistantMessageRow = agentRepo.createMessage({
        sessionId: session.id,
        role: "assistant",
        content: assistantContent,
        relatedAssetIds: relatedAssets.map((asset) => asset.id),
      });
      eventRepo?.create({
        eventType: "agent.queried",
        entityType: "agent_session",
        entityId: session.id,
        projectId: effectiveProjectId,
        payload: {
          relatedAssetCount: relatedAssets.length,
          queryLength: input.query.trim().length,
        },
      });

      const refreshedSession = agentRepo.getSessionById(session.id);
      if (!refreshedSession) {
        throw new AgentError("Agent session not found after write", "SESSION_NOT_FOUND", { sessionId: session.id });
      }

      return {
        session: refreshedSession,
        userMessage: toMessage(userMessageRow),
        assistantMessage: toMessage(assistantMessageRow),
        relatedAssets,
        project: agentVisibleProject ? toProjectResponse(agentVisibleProject) : null,
      };
    },

    getSession(sessionId: string): AgentSessionResult | null {
      const session = agentRepo.getSessionById(sessionId);
      if (!session) return null;

      const messages = agentRepo.listMessagesBySession(sessionId).map(toMessage);
      const relatedAssetIds = Array.from(new Set(messages.flatMap((message) => message.relatedAssetIds)));
      const relatedAssets = relatedAssetIds
        .map((assetId) => assetRepo.getById(assetId))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
        .filter((asset) => isAgentVisibleAsset(asset, projectRepo))
        .map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          projectId: asset.projectId,
          reason: "Referenced by a prior assistant reply in this session.",
          sourceConnector: asset.sourceConnector ?? null,
          createdAt: asset.createdAt,
        }));

      const projectRow = session.projectId ? projectRepo.getById(session.projectId) : undefined;
      const agentVisibleProject = projectRow?.visibility === "public" ? projectRow : undefined;

      return {
        session,
        messages,
        relatedAssets,
        project: agentVisibleProject ? toProjectResponse(agentVisibleProject) : null,
      };
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;
