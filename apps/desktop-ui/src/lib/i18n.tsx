import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AssetType, ProjectResponse } from "@starline/shared";

export type Locale = "zh-CN" | "en";

const STORAGE_KEY = "starline.locale";
type ProjectStatus = ProjectResponse["status"];

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
};

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: Messages;
  formatProjectStatus: (status: ProjectStatus) => string;
  formatAssetType: (type: AssetType) => string;
};

const MESSAGES: Record<Locale, Messages> = {
  "en": {
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
    activitySummary: (projects, assets, agent, submitted, completed) => `${projects} projects, ${assets} assets, ${agent} agent, ${submitted} submitted, ${completed} completed`,
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
  },
  "zh-CN": {
    appTitle: "StarLine",
    appSubtitle: "本地优先的创作者工作台，内置检索增强 Agent 流程",
    language: "显示语言",
    languageEnglish: "English",
    languageChinese: "简体中文",
    navProjects: "项目",
    navAssets: "资产",
    navConnectors: "连接器",
    navAgent: "助手",
    navAnalytics: "分析",
    bootCheckingTitle: "正在启动本地 API...",
    bootCheckingBody: "桌面壳正在等待本地 StarLine 服务就绪。",
    bootFailedTitle: "本地 API 启动失败",
    bootFailedBody: "请检查 local-api 运行日志后重试桌面应用。",
    bootFailedHint: "发布版诊断日志位于 `%LOCALAPPDATA%\\com.starline.desktop\\logs\\local-api.log`。",
    projectsTitle: "项目",
    newProject: "+ 新建项目",
    loading: "加载中...",
    projectListEmpty: "还没有项目，先创建一个开始。",
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
    archiveConfirm: (projectName) => `确认归档“${projectName}”？`,
    assetPageTitle: "资产",
    assetPageSubtitle: "导入、浏览并搜索你的本地资产库。",
    loadingAssets: "正在加载资产...",
    assetLoadError: "加载资产失败：",
    showingAssets: (count, total) => `显示 ${count} / ${total} 个资产`,
    pageLabel: (page, total) => `第 ${page} / ${total} 页`,
    previous: "上一页",
    next: "下一页",
    importAssetTitle: "导入资产",
    importAssetSubtitle: "当前版本使用手动路径输入，原生文件选择器暂不在本阶段范围内。",
    filePath: "文件路径",
    type: "类型",
    project: "项目",
    noProject: "无项目",
    nameOverride: "名称覆盖",
    optionalAssetName: "可选资产名称",
    tags: "标签",
    importAsset: "导入资产",
    importingAsset: "导入中...",
    importedAsset: (name) => `已导入资产：${name}`,
    reusedAsset: (name) => `复用已有资产：${name}`,
    search: "搜索",
    searchPlaceholder: "按关键词搜索",
    allTypes: "全部类型",
    allProjects: "全部项目",
    resetFilters: "重置筛选",
    assetEmpty: "没有找到资产。请导入文件或调整筛选条件。",
    assetGeneratedFrom: "生成来源",
    connectorsTitle: "连接器",
    connectorsSubtitle: "管理本地 provider 配置、secret 状态和实时健康检查。",
    persistence: "持久化",
    persistenceValue: "数据库配置 + 本地 secret 存储",
    loadingConnectors: "正在加载连接器...",
    connectorsLoadError: "加载连接器失败：",
    savedLocally: "已本地保存",
    envFallback: "环境变量回退",
    enabled: "启用",
    apiKey: "API Key",
    storedLocally: "已本地保存",
    notSaved: "未保存",
    leaveBlankToKeepKey: "留空以保留当前密钥",
    enterMiniMaxKey: "输入 MiniMax API Key",
    runtimeNote: "运行时说明",
    runtimeNoteBody: "数据库中的 secret 优先于环境变量回退。标准读取接口不会返回明文密钥。",
    saveMiniMax: "保存 MiniMax",
    saveStableDiffusion: "保存 Stable Diffusion",
    testConnector: "测试连接器",
    healthyIn: (latencyMs) => `${latencyMs}ms 内通过健康检查`,
    testFailed: (error) => `测试失败：${error}`,
    minimaxSaved: "MiniMax 设置已保存。",
    stableSaved: "Stable Diffusion 设置已保存。",
    stableDiffusionTitle: "Stable Diffusion WebUI",
    stableDiffusionBody: "用于健康检查和图像生成的本地 WebUI 地址。",
    baseUrl: "基础地址",
    secretState: "Secret 状态",
    notUsed: "未使用",
    stableSecretBody: "当前 MVP 路径下，Stable Diffusion 仅保存 endpoint 配置，不需要单独 secret。",
    minimaxBody: "使用本地保存 API Key 的图像连接器。",
    agentTitle: "助手",
    agentSubtitle: "基于你的本地项目和资产库，获取检索增强建议。",
    session: "会话",
    newSession: "新建会话",
    projectScope: "项目范围",
    allLocalAssets: "全部本地资产",
    askAgent: "提问",
    askAgentPlaceholder: "可以让助手改写提示词、筛选资产或给出下一步建议...",
    running: "处理中...",
    askAgentAction: "发送",
    loadingSession: "正在加载会话...",
    noSessionTitle: "还没有开始会话。",
    noSessionBody: "如有需要先选择项目范围，然后发起问题，助手会把对话持久化到本地。",
    agentRole: "助手",
    youRole: "你",
    currentContext: "当前上下文",
    globalLibrary: "全局资产库",
    globalLibraryBody: "当前会话会在所有已导入的本地资产中检索。",
    started: "开始时间",
    updated: "更新时间",
    messages: "消息数",
    relatedAssets: "相关资产",
    retrievedLocalContext: "检索到的本地上下文",
    noRelatedAssets: "当前会话还没有检索到相关资产。",
    analyticsTitle: "分析",
    analyticsSubtitle: "查看本地项目、资产、生成和 Agent 活动，无需向外发送遥测数据。",
    latestEvent: "最新事件",
    noEventsYet: "暂无事件",
    loadingAnalytics: "正在加载分析数据...",
    analyticsLoadError: "加载分析数据失败。",
    statProjects: "项目",
    statProjectsBody: "本地创建的项目总数。",
    statAssets: "资产",
    statAssetsBody: "已导入并完成索引的本地资产。",
    statAgentQueries: "助手提问",
    statAgentQueriesBody: "已持久化的检索增强助手请求。",
    statGenerations: "生成任务",
    statGenerationsBody: (completed, failed, cancelled) => `${completed} 成功，${failed} 失败，${cancelled} 取消。`,
    usage: "使用情况",
    recentLocalActivity: "近期本地活动",
    noAnalyticsRangeEvents: "所选范围内没有分析事件。",
    activitySummary: (projects, assets, agent, submitted, completed) => `${projects} 个项目，${assets} 个资产，${agent} 次助手提问，${submitted} 次提交，${completed} 次成功`,
    eventsCount: (count) => `${count} 个事件`,
    generationOutcomes: "生成结果",
    completed: "成功",
    failed: "失败",
    cancelled: "取消",
    byConnector: "按连接器",
    generationMix: "生成构成",
    noGenerationActivity: "还没有记录到生成活动。",
    submitted: "已提交",
    projectDetailBack: "返回项目列表",
    loadingProject: "正在加载项目...",
    projectLoadFailed: "加载项目失败",
    projectNotFound: "未找到项目",
    noDescriptionYet: "暂无描述。",
    created: "创建时间",
    projectAssets: "项目资产",
    projectAssetsBody: "通过现有 `projectId` 关联到该项目的资产。",
    loadingProjectAssets: "正在加载项目资产...",
    projectAssetsLoadError: "加载项目资产失败：",
    assetStatusNoProject: "无项目",
  },
};

const ASSET_TYPE_LABELS: Record<Locale, Record<AssetType, string>> = {
  "en": {
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
    prompt: "提示词",
    other: "其他",
  },
};

const PROJECT_STATUS_LABELS: Record<Locale, Record<ProjectStatus, string>> = {
  "en": {
    active: "active",
    archived: "archived",
  },
  "zh-CN": {
    active: "进行中",
    archived: "已归档",
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
  }), [locale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}
