import type { AssetRepository, AssetRow, ProjectRepository } from "@starline/storage";

export interface AgentToolContext {
  projectRepo: ProjectRepository;
  assetRepo: AssetRepository;
  projectId?: string;
  allowPrivate: boolean;
}

export interface AgentToolProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  visibility: "public" | "private";
  createdAt: string;
  updatedAt: string;
}

export interface AgentToolAssetSummary {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "prompt" | "other";
  projectId: string | null;
  visibility: "public" | "private";
  origin: "imported" | "generated";
  sourceConnector: string | null;
  createdAt: string;
}

export interface AgentToolAssetDetail extends AgentToolAssetSummary {
  description: string | null;
  tags: string[];
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  generationPrompt: string | null;
}

export function isVisibleProject(
  project: { visibility: "public" | "private" },
  allowPrivate: boolean,
): boolean {
  return allowPrivate || project.visibility === "public";
}

export function isVisibleAsset(
  asset: Pick<AssetRow, "status" | "visibility" | "projectId">,
  context: AgentToolContext,
): boolean {
  if (asset.status !== "active") return false;
  if (!context.allowPrivate && asset.visibility !== "public") return false;
  if (!asset.projectId) return true;

  const project = context.projectRepo.getById(asset.projectId);
  if (!project) return true;
  return isVisibleProject(project, context.allowPrivate);
}

export function toProjectSummary(project: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  visibility: "public" | "private";
  createdAt: string;
  updatedAt: string;
}): AgentToolProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    visibility: project.visibility,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function toAssetSummary(asset: AssetRow): AgentToolAssetSummary {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    projectId: asset.projectId,
    visibility: asset.visibility,
    origin: asset.origin,
    sourceConnector: asset.sourceConnector,
    createdAt: asset.createdAt,
  };
}

export function toAssetDetail(asset: AssetRow): AgentToolAssetDetail {
  return {
    ...toAssetSummary(asset),
    description: asset.description,
    tags: asset.tags,
    filePath: asset.filePath,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    generationPrompt: asset.generationPrompt,
  };
}
