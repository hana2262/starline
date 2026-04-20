import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";

export type Locale = "zh-CN" | "en";

const STORAGE_KEY = "starline.locale";
type ProjectStatus = ProjectResponse["status"];
type Visibility = ProjectResponse["visibility"];

type Messages = {
  appTitle: string;
  appSubtitle: string;
  language: string;
  languageEnglish: string;
  languageChinese: string;
  navProjects: string;
  navAssets: string;
  navConnectors: string;
  navAgent: string;
  navAnalytics: string;
  bootCheckingTitle: string;
  bootCheckingBody: string;
  bootFailedTitle: string;
  bootFailedBody: string;
  bootFailedHint: string;
  projectsTitle: string;
  newProject: string;
  loading: string;
  projectListEmpty: string;
  projectModalTitle: string;
  name: string;
  description: string;
  optionalDescription: string;
  cancel: string;
  create: string;
  creating: string;
  myProject: string;
  archiveProject: string;
  archive: string;
  archiveConfirm: (projectName: string) => string;
  projectsManageHint?: string;
  cancelSelection?: string;
  selectProjects?: string;
  projectFilterLabel?: string;
  allStatuses?: string;
  selectedProjectsCount?: string;
  deleteProjectsConfirm?: string;
  deletingProjects?: string;
  deleteSelectedProjects?: string;
  projectStatusLabel?: string;
  assetPageTitle: string;
  assetPageSubtitle: string;
  loadingAssets: string;
  assetLoadError: string;
  showingAssets: (count: number, total: number) => string;
  pageLabel: (page: number, total: number) => string;
  previous: string;
  next: string;
  importAssetTitle: string;
  importAssetSubtitle: string;
  filePath: string;
  type: string;
  project: string;
  noProject: string;
  nameOverride: string;
  optionalAssetName: string;
  tags: string;
  importAsset: string;
  importingAsset: string;
  importedAsset: (name: string) => string;
  reusedAsset: (name: string) => string;
  search: string;
  searchPlaceholder: string;
  allTypes: string;
  allProjects: string;
  resetFilters: string;
  assetEmpty: string;
  assetGeneratedFrom: string;
  connectorsTitle: string;
  connectorsSubtitle: string;
  persistence: string;
  persistenceValue: string;
  loadingConnectors: string;
  connectorsLoadError: string;
  savedLocally: string;
  envFallback: string;
  enabled: string;
  apiKey: string;
  storedLocally: string;
  notSaved: string;
  leaveBlankToKeepKey: string;
  enterMiniMaxKey: string;
  runtimeNote: string;
  runtimeNoteBody: string;
  saveMiniMax: string;
  saveStableDiffusion: string;
  testConnector: string;
  healthyIn: (latencyMs: number) => string;
  testFailed: (error: string) => string;
  minimaxSaved: string;
  stableSaved: string;
  stableDiffusionTitle: string;
  stableDiffusionBody: string;
  baseUrl: string;
  secretState: string;
  notUsed: string;
  stableSecretBody: string;
  minimaxBody: string;
  agentTitle: string;
  agentSubtitle: string;
  session: string;
  newSession: string;
  projectScope: string;
  allLocalAssets: string;
  askAgent: string;
  askAgentPlaceholder: string;
  running: string;
  askAgentAction: string;
  agentPrivateAccessLabel: string;
  agentPrivateAccessTitle: string;
  agentPrivateAccessToggle: string;
  agentPrivateAccessDisabledBody: string;
  agentPrivateAccessEnabledBody: string;
  agentPrivateAccessDisabledHint: string;
  agentPrivateAccessEnabledHint: string;
  loadingSession: string;
  noSessionTitle: string;
  noSessionBody: string;
  agentRole: string;
  youRole: string;
  currentContext: string;
  globalLibrary: string;
  globalLibraryBody: string;
  started: string;
  updated: string;
  messages: string;
  relatedAssets: string;
  retrievedLocalContext: string;
  noRelatedAssets: string;
  analyticsTitle: string;
  analyticsSubtitle: string;
  latestEvent: string;
  noEventsYet: string;
  loadingAnalytics: string;
  analyticsLoadError: string;
  statProjects: string;
  statProjectsBody: string;
  statAssets: string;
  statAssetsBody: string;
  statAgentQueries: string;
  statAgentQueriesBody: string;
  statGenerations: string;
  statGenerationsBody: (completed: number, failed: number, cancelled: number) => string;
  usage: string;
  recentLocalActivity: string;
  noAnalyticsRangeEvents: string;
  activitySummary: (projects: number, assets: number, agent: number, submitted: number, completed: number) => string;
  eventsCount: (count: number) => string;
  generationOutcomes: string;
  completed: string;
  failed: string;
  cancelled: string;
  byConnector: string;
  generationMix: string;
  noGenerationActivity: string;
  submitted: string;
  projectDetailBack: string;
  loadingProject: string;
  projectLoadFailed: string;
  projectNotFound: string;
  noDescriptionYet: string;
  created: string;
  projectAssets: string;
  projectAssetsBody: string;
  loadingProjectAssets: string;
  projectAssetsLoadError: string;
  assetStatusNoProject: string;
  visibilityLabel: string;
  publicVisibility: string;
  privateVisibility: string;
  viewAssetDetail: string;
  assetDetailBack: string;
  loadingAssetDetail: string;
  assetDetailLoadFailed: string;
  assetDetailNotFound: string;
  assetDetailPreviewTitle?: string;
  assetDetailMetadataTitle?: string;
  assetDetailSourceTitle?: string;
  assetVisibilityHelp?: string;
  saving?: string;
  saveChanges?: string;
  assetVisibilitySaved?: string;
  assetVisibilitySaveFailed?: string;
  fileSizeLabel: string;
  statusLabel: string;
  mimeTypeLabel: string;
  contentHashLabel: string;
  notAvailable: string;
  loadingPromptPreview: string;
  promptPreviewFailed: string;
  mediaPreviewFailed?: string;
  previewUnavailableTitle: string;
  previewUnavailableBody: (assetType: string) => string;
};

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: Messages;
  formatProjectStatus: (status: ProjectStatus) => string;
  formatAssetType: (type: AssetType) => string;
  formatVisibility: (visibility: Visibility) => string;
};

const MESSAGES: Record<Locale, Messages> = {
  en: {
    appTitle: "StarLine",
    appSubtitle: "Local-first creator workspace with retrieval-backed agent flows",
    language: "Language",
    languageEnglish: "English",
    languageChinese: "简体中文",
    navProjects: "Projects",
    navAssets: "Assets",
    navConnectors: "Connectors",
    navAgent: "Agent",
    navAnalytics: "Analytics",
    bootCheckingTitle: "Starting local API...",
    bootCheckingBody: "The desktop shell is waiting for the local StarLine service to become ready.",
    bootFailedTitle: "Local API did not start",
    bootFailedBody: "Check the local-api runtime log and retry the desktop shell.",
    bootFailedHint: "Release diagnostics are written under `%LOCALAPPDATA%\\com.starline.desktop\\logs\\local-api.log`.",
    projectsTitle: "Projects",
    newProject: "+ New Project",
    loading: "Loading...",
    projectListEmpty: "No projects yet. Create one to get started.",
    projectModalTitle: "New Project",
    name: "Name",
    description: "Description",
    optionalDescription: "Optional description",
    cancel: "Cancel",
    create: "Create",
    creating: "Creating...",
    myProject: "My project",
    archiveProject: "Archive project",
    archive: "Archive",
    archiveConfirm: (projectName) => `Archive "${projectName}"?`,
    projectsManageHint: "Review active and archived projects, edit details, or clean up old work.",
    cancelSelection: "Cancel selection",
    selectProjects: "Select projects",
    projectFilterLabel: "Status filter",
    allStatuses: "All",
    selectedProjectsCount: "{count} selected",
    deleteProjectsConfirm: "Delete {count} selected projects? This cannot be undone.",
    deletingProjects: "Deleting...",
    deleteSelectedProjects: "Delete selected",
    projectStatusLabel: "Project status",
    assetPageTitle: "Assets",
    assetPageSubtitle: "Import, browse, and search your local asset library.",
    loadingAssets: "Loading assets...",
    assetLoadError: "Error loading assets:",
    showingAssets: (count, total) => `Showing ${count} of ${total} assets`,
    pageLabel: (page, total) => `Page ${page} / ${total}`,
    previous: "Previous",
    next: "Next",
    importAssetTitle: "Import Asset",
    importAssetSubtitle: "Sprint-1 uses manual path entry. Native file-picker stays out of scope.",
    filePath: "File path",
    type: "Type",
    project: "Project",
    noProject: "No project",
    nameOverride: "Name override",
    optionalAssetName: "Optional asset name",
    tags: "Tags",
    importAsset: "Import Asset",
    importingAsset: "Importing...",
    importedAsset: (name) => `Imported asset: ${name}`,
    reusedAsset: (name) => `Used existing asset: ${name}`,
    search: "Search",
    searchPlaceholder: "Search by keyword",
    allTypes: "All types",
    allProjects: "All projects",
    resetFilters: "Reset filters",
    assetEmpty: "No assets found. Import a file or adjust your filters.",
    assetGeneratedFrom: "Generated by",
    connectorsTitle: "Connectors",
    connectorsSubtitle: "Manage local provider settings, secret state, and live health checks.",
    persistence: "Persistence",
    persistenceValue: "DB config + local secret store",
    loadingConnectors: "Loading connectors...",
    connectorsLoadError: "Failed to load connectors:",
    savedLocally: "Saved locally",
    envFallback: "Env fallback",
    enabled: "Enabled",
    apiKey: "API key",
    storedLocally: "Stored locally",
    notSaved: "Not saved",
    leaveBlankToKeepKey: "Leave blank to keep current key",
    enterMiniMaxKey: "Enter MiniMax API key",
    runtimeNote: "Runtime note",
    runtimeNoteBody: "DB secret overrides env fallback. Standard read APIs never return the plaintext key.",
    saveMiniMax: "Save MiniMax",
    saveStableDiffusion: "Save Stable Diffusion",
    testConnector: "Test Connector",
    healthyIn: (latencyMs) => `Healthy in ${latencyMs}ms`,
    testFailed: (error) => `Test failed: ${error}`,
    minimaxSaved: "MiniMax settings saved.",
    stableSaved: "Stable Diffusion settings saved.",
    stableDiffusionTitle: "Stable Diffusion WebUI",
    stableDiffusionBody: "Local WebUI endpoint used for health checks and image generation.",
    baseUrl: "Base URL",
    secretState: "Secret state",
    notUsed: "Not used",
    stableSecretBody: "Stable Diffusion only stores endpoint config. No separate secret is required in the current MVP path.",
    minimaxBody: "Image connector backed by a locally stored API key.",
    agentTitle: "Agent",
    agentSubtitle: "Ask for retrieval-backed suggestions using your local projects and asset library.",
    session: "Session",
    newSession: "New Session",
    projectScope: "Project Scope",
    allLocalAssets: "All local assets",
    askAgent: "Ask Agent",
    askAgentPlaceholder: "Ask for a prompt rewrite, asset shortlist, or next-step suggestion...",
    running: "Running...",
    askAgentAction: "Ask Agent",
    agentPrivateAccessLabel: "Private Access",
    agentPrivateAccessTitle: "Allow private content for this query",
    agentPrivateAccessToggle: "Toggle private access for this query",
    agentPrivateAccessDisabledBody: "Default safe mode. The agent will not read private projects or assets.",
    agentPrivateAccessEnabledBody: "Enabled only for this request. The agent may read private projects and assets.",
    agentPrivateAccessDisabledHint: "Private content is currently excluded from retrieval.",
    agentPrivateAccessEnabledHint: "This query will include private content in retrieval.",
    loadingSession: "Loading session...",
    noSessionTitle: "No session started yet.",
    noSessionBody: "Pick a project scope if needed, ask a question, and the agent will persist the conversation locally.",
    agentRole: "Agent",
    youRole: "You",
    currentContext: "Current Context",
    globalLibrary: "Global Library",
    globalLibraryBody: "The current session can search across all imported local assets.",
    started: "Started",
    updated: "Updated",
    messages: "Messages",
    relatedAssets: "Related Assets",
    retrievedLocalContext: "Retrieved Local Context",
    noRelatedAssets: "The current session has no retrieved assets yet.",
    analyticsTitle: "Analytics",
    analyticsSubtitle: "Review local project, asset, generation, and agent activity without sending telemetry anywhere else.",
    latestEvent: "Latest Event",
    noEventsYet: "No events yet",
    loadingAnalytics: "Loading analytics...",
    analyticsLoadError: "Failed to load analytics.",
    statProjects: "Projects",
    statProjectsBody: "Total locally created projects.",
    statAssets: "Assets",
    statAssetsBody: "Imported and indexed local assets.",
    statAgentQueries: "Agent Queries",
    statAgentQueriesBody: "Persisted retrieval-backed agent requests.",
    statGenerations: "Generations",
    statGenerationsBody: (completed, failed, cancelled) => `${completed} completed, ${failed} failed, ${cancelled} cancelled.`,
    usage: "Usage",
    recentLocalActivity: "Recent Local Activity",
    noAnalyticsRangeEvents: "No analytics events available in the selected range.",
    activitySummary: (projects, assets, agent, submitted, completed) =>
      `${projects} projects, ${assets} assets, ${agent} agent, ${submitted} submitted, ${completed} completed`,
    eventsCount: (count) => `${count} events`,
    generationOutcomes: "Generation Outcomes",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    byConnector: "By Connector",
    generationMix: "Generation Mix",
    noGenerationActivity: "No generation activity has been recorded yet.",
    submitted: "submitted",
    projectDetailBack: "Back to projects",
    loadingProject: "Loading project...",
    projectLoadFailed: "Failed to load project",
    projectNotFound: "Project not found",
    noDescriptionYet: "No description yet.",
    created: "Created",
    projectAssets: "Project Assets",
    projectAssetsBody: "Assets linked to this project through existing `projectId` linkage.",
    loadingProjectAssets: "Loading project assets...",
    projectAssetsLoadError: "Failed to load project assets:",
    assetStatusNoProject: "No project",
    visibilityLabel: "Visibility",
    publicVisibility: "Public",
    privateVisibility: "Private",
    viewAssetDetail: "View details",
    assetDetailBack: "Back to assets",
    loadingAssetDetail: "Loading asset...",
    assetDetailLoadFailed: "Failed to load asset",
    assetDetailNotFound: "Asset not found",
    assetDetailPreviewTitle: "Preview",
    assetDetailMetadataTitle: "Metadata",
    assetDetailSourceTitle: "Source",
    assetVisibilityHelp: "Choose whether this asset should be visible to agent retrieval by default.",
    saving: "Saving...",
    saveChanges: "Save changes",
    assetVisibilitySaved: "Asset visibility saved.",
    assetVisibilitySaveFailed: "Failed to save asset visibility.",
    fileSizeLabel: "File size",
    statusLabel: "Status",
    mimeTypeLabel: "MIME type",
    contentHashLabel: "Content hash",
    notAvailable: "Not available",
    loadingPromptPreview: "Loading prompt preview...",
    promptPreviewFailed: "Prompt preview could not be loaded from the local file path.",
    mediaPreviewFailed: "Preview could not be loaded for this local file.",
    previewUnavailableTitle: "Preview unavailable",
    previewUnavailableBody: (assetType) => `${assetType} preview is not supported in the current MVP.`,
  },
  "zh-CN": {
    appTitle: "StarLine",
    appSubtitle: "本地优先创作者工作台，提供基于检索增强的 Agent 协作流",
    language: "语言",
    languageEnglish: "English",
    languageChinese: "简体中文",
    navProjects: "项目",
    navAssets: "资产",
    navConnectors: "连接器",
    navAgent: "Agent",
    navAnalytics: "分析",
    bootCheckingTitle: "正在启动本地 API...",
    bootCheckingBody: "桌面端正在等待本地 StarLine 服务完成启动。",
    bootFailedTitle: "本地 API 启动失败",
    bootFailedBody: "请检查 local-api 运行日志后重试桌面应用。",
    bootFailedHint: "发布版诊断日志位于 `%LOCALAPPDATA%\\com.starline.desktop\\logs\\local-api.log`。",
    projectsTitle: "项目",
    newProject: "+ 新建项目",
    loading: "加载中...",
    projectListEmpty: "还没有项目，先创建一个开始吧。",
    projectModalTitle: "新建项目",
    name: "名称",
    description: "描述",
    optionalDescription: "可选描述",
    cancel: "取消",
    create: "创建",
    creating: "创建中...",
    myProject: "我的项目",
    archiveProject: "归档项目",
    archive: "归档",
    archiveConfirm: (projectName) => `确认归档“${projectName}”吗？`,
    assetPageTitle: "资产",
    assetPageSubtitle: "导入、浏览并检索你的本地资产库。",
    loadingAssets: "正在加载资产...",
    assetLoadError: "加载资产失败：",
    showingAssets: (count, total) => `当前显示 ${count} / ${total} 个资产`,
    pageLabel: (page, total) => `第 ${page} / ${total} 页`,
    previous: "上一页",
    next: "下一页",
    importAssetTitle: "导入资产",
    importAssetSubtitle: "当前 MVP 仍以手动输入文件路径为主，原生文件选择器暂不纳入范围。",
    filePath: "文件路径",
    type: "类型",
    project: "项目",
    noProject: "无项目",
    nameOverride: "自定义名称",
    optionalAssetName: "可选资产名称",
    tags: "标签",
    importAsset: "导入资产",
    importingAsset: "导入中...",
    importedAsset: (name) => `已导入资产：${name}`,
    reusedAsset: (name) => `复用已有资产：${name}`,
    search: "搜索",
    searchPlaceholder: "输入关键词搜索",
    allTypes: "全部类型",
    allProjects: "全部项目",
    resetFilters: "重置筛选",
    assetEmpty: "没有找到资产。你可以先导入文件或调整筛选条件。",
    assetGeneratedFrom: "生成来源",
    connectorsTitle: "连接器",
    connectorsSubtitle: "管理本地 provider 配置、secret 状态和实时健康检查。",
    persistence: "持久化",
    persistenceValue: "数据库配置 + 本地 secret 存储",
    loadingConnectors: "正在加载连接器...",
    connectorsLoadError: "连接器加载失败：",
    savedLocally: "已保存在本地",
    envFallback: "环境变量兜底",
    enabled: "启用",
    apiKey: "API Key",
    storedLocally: "已本地存储",
    notSaved: "未保存",
    leaveBlankToKeepKey: "留空表示保留当前 key",
    enterMiniMaxKey: "输入 MiniMax API Key",
    runtimeNote: "运行说明",
    runtimeNoteBody: "数据库中的 secret 会覆盖环境变量兜底；标准读取 API 不会返回明文 key。",
    saveMiniMax: "保存 MiniMax",
    saveStableDiffusion: "保存 Stable Diffusion",
    testConnector: "测试连接器",
    healthyIn: (latencyMs) => `${latencyMs}ms 内响应正常`,
    testFailed: (error) => `测试失败：${error}`,
    minimaxSaved: "MiniMax 配置已保存。",
    stableSaved: "Stable Diffusion 配置已保存。",
    stableDiffusionTitle: "Stable Diffusion WebUI",
    stableDiffusionBody: "本地 WebUI 端点用于健康检查和图片生成。",
    baseUrl: "基础 URL",
    secretState: "Secret 状态",
    notUsed: "未使用",
    stableSecretBody: "当前 MVP 路径下 Stable Diffusion 只保存 endpoint 配置，不需要单独 secret。",
    minimaxBody: "使用本地保存 API Key 的图像连接器。",
    agentTitle: "Agent",
    agentSubtitle: "基于你的本地项目和资产库发起检索增强式提问。",
    session: "会话",
    newSession: "新建会话",
    projectScope: "项目范围",
    allLocalAssets: "全部本地资产",
    askAgent: "询问 Agent",
    askAgentPlaceholder: "例如：改写 prompt、挑选参考资产、给出下一步建议...",
    running: "运行中...",
    askAgentAction: "发送给 Agent",
    agentPrivateAccessLabel: "私密访问",
    agentPrivateAccessTitle: "仅本次提问允许读取 private 内容",
    agentPrivateAccessToggle: "切换本次提问的 private 访问权限",
    agentPrivateAccessDisabledBody: "默认安全模式。Agent 不会读取 private 项目和资产。",
    agentPrivateAccessEnabledBody: "仅对本次请求生效。Agent 可能读取 private 项目和资产。",
    agentPrivateAccessDisabledHint: "当前检索不会包含 private 内容。",
    agentPrivateAccessEnabledHint: "本次提问会把 private 内容纳入检索范围。",
    loadingSession: "正在加载会话...",
    noSessionTitle: "还没有开始会话。",
    noSessionBody: "如有需要先选择项目范围，然后提出问题，Agent 会把对话持久化到本地。",
    agentRole: "Agent",
    youRole: "你",
    currentContext: "当前上下文",
    globalLibrary: "全局资产库",
    globalLibraryBody: "当前会话可以跨全部已导入本地资产进行检索。",
    started: "开始时间",
    updated: "更新时间",
    messages: "消息",
    relatedAssets: "相关资产",
    retrievedLocalContext: "检索到的本地上下文",
    noRelatedAssets: "当前会话还没有检索到关联资产。",
    analyticsTitle: "分析",
    analyticsSubtitle: "查看本地项目、资产、生成和 Agent 活动，不会把遥测发送到外部。",
    latestEvent: "最近事件",
    noEventsYet: "暂无事件",
    loadingAnalytics: "正在加载分析数据...",
    analyticsLoadError: "分析数据加载失败。",
    statProjects: "项目",
    statProjectsBody: "本地已创建的项目总数。",
    statAssets: "资产",
    statAssetsBody: "已导入并建立索引的本地资产。",
    statAgentQueries: "Agent 查询",
    statAgentQueriesBody: "已持久化的检索增强式 Agent 请求。",
    statGenerations: "生成任务",
    statGenerationsBody: (completed, failed, cancelled) => `${completed} 完成，${failed} 失败，${cancelled} 取消。`,
    usage: "使用情况",
    recentLocalActivity: "最近本地活动",
    noAnalyticsRangeEvents: "当前时间范围内没有分析事件。",
    activitySummary: (projects, assets, agent, submitted, completed) =>
      `${projects} 项目，${assets} 资产，${agent} Agent，${submitted} 提交，${completed} 完成`,
    eventsCount: (count) => `${count} 个事件`,
    generationOutcomes: "生成结果",
    completed: "完成",
    failed: "失败",
    cancelled: "取消",
    byConnector: "按连接器统计",
    generationMix: "生成分布",
    noGenerationActivity: "还没有记录到生成活动。",
    submitted: "已提交",
    projectDetailBack: "返回项目列表",
    loadingProject: "正在加载项目...",
    projectLoadFailed: "项目加载失败",
    projectNotFound: "未找到该项目",
    noDescriptionYet: "暂无描述。",
    created: "创建时间",
    projectAssets: "项目资产",
    projectAssetsBody: "通过现有 `projectId` 关联到该项目的资产。",
    loadingProjectAssets: "正在加载项目资产...",
    projectAssetsLoadError: "项目资产加载失败：",
    assetStatusNoProject: "无项目",
    visibilityLabel: "可见性",
    publicVisibility: "公开",
    privateVisibility: "私密",
    viewAssetDetail: "查看详情",
    assetDetailBack: "返回资产列表",
    loadingAssetDetail: "正在加载资产...",
    assetDetailLoadFailed: "资产加载失败",
    assetDetailNotFound: "未找到该资产",
    fileSizeLabel: "文件大小",
    statusLabel: "状态",
    mimeTypeLabel: "MIME 类型",
    contentHashLabel: "内容 Hash",
    notAvailable: "暂无",
    loadingPromptPreview: "正在加载 prompt 预览...",
    promptPreviewFailed: "无法从本地文件路径加载 prompt 预览。",
    previewUnavailableTitle: "暂不支持预览",
    previewUnavailableBody: (assetType) => `当前 MVP 暂不支持 ${assetType} 内容预览。`,
  },
};

const ASSET_TYPE_LABELS: Record<Locale, Record<AssetType, string>> = {
  en: {
    image: "Image",
    video: "Video",
    audio: "Audio",
    prompt: "Prompt",
    other: "Other",
  },
  "zh-CN": {
    image: "图片",
    video: "视频",
    audio: "音频",
    prompt: "Prompt",
    other: "其他",
  },
};

const PROJECT_STATUS_LABELS: Record<Locale, Record<ProjectStatus, string>> = {
  en: {
    active: "active",
    archived: "archived",
  },
  "zh-CN": {
    active: "进行中",
    archived: "已归档",
  },
};

const VISIBILITY_LABELS: Record<Locale, Record<Visibility, string>> = {
  en: {
    public: "Public",
    private: "Private",
  },
  "zh-CN": {
    public: "公开",
    private: "私密",
  },
};

const I18nContext = createContext<I18nValue | null>(null);

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en") return stored;

  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(resolveInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    text: MESSAGES[locale],
    formatProjectStatus: (status) => PROJECT_STATUS_LABELS[locale][status],
    formatAssetType: (type) => ASSET_TYPE_LABELS[locale][type],
    formatVisibility: (visibility) => VISIBILITY_LABELS[locale][visibility],
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}
