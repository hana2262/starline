import { useEffect, useMemo, useState } from "react";
import ProjectsPage from "./pages/ProjectsPage.js";
import AssetsPage from "./pages/AssetsPage.js";
import ProjectDetailPage from "./pages/ProjectDetailPage.js";
import AssetDetailPage from "./pages/AssetDetailPage.js";
import ConnectorsPage from "./pages/ConnectorsPage.js";
import AgentPage from "./pages/AgentPage.js";
import AnalyticsPage from "./pages/AnalyticsPage.js";
import AppNav from "./components/AppNav.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProject } from "./hooks/useProject.js";
import { useAsset } from "./hooks/useAsset.js";
import { useI18n } from "./lib/i18n.js";
import { HEALTH_URL } from "./lib/runtime.js";

type RootView = "projects" | "assets" | "connectors" | "agent" | "analytics" | "project-detail" | "asset-detail";
type BootStatus = "checking" | "ready" | "failed";
type AssetBackView = "assets" | "project-detail";

export default function App() {
  const { locale, setLocale, text } = useI18n();
  const [view, setView] = useState<RootView>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetBackView, setAssetBackView] = useState<AssetBackView>("assets");
  const [bootStatus, setBootStatus] = useState<BootStatus>("checking");
  const apiReady = bootStatus === "ready";
  const projects = useProjects(apiReady);
  const selectedProject = useProject(selectedProjectId, apiReady);
  const selectedAsset = useAsset(selectedAssetId, apiReady);

  const activeNavView = useMemo(() => {
    if (view === "assets") return "assets";
    if (view === "connectors") return "connectors";
    if (view === "agent") return "agent";
    if (view === "analytics") return "analytics";
    return "projects";
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function checkHealth() {
      try {
        const response = await fetch(HEALTH_URL);
        if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
        if (!cancelled) setBootStatus("ready");
      } catch {
        attempts += 1;
        if (attempts >= 25) {
          if (!cancelled) setBootStatus("failed");
          return;
        }
        window.setTimeout(checkHealth, 1000);
      }
    }

    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setView("project-detail");
  }

  function openAsset(assetId: string, backView: AssetBackView = "assets") {
    setSelectedAssetId(assetId);
    setAssetBackView(backView);
    setView("asset-detail");
  }

  function renderCurrentView() {
    if (bootStatus === "checking") {
      return (
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">{text.bootCheckingTitle}</h2>
          <p className="text-sm text-gray-500 mt-2">
            {text.bootCheckingBody}
          </p>
        </div>
      );
    }

    if (bootStatus === "failed") {
      return (
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-red-700">{text.bootFailedTitle}</h2>
          <p className="text-sm text-red-600 mt-2">
            {text.bootFailedBody}
          </p>
          <p className="text-xs text-red-500 mt-3">
            {text.bootFailedHint}
          </p>
        </div>
      );
    }

    if (view === "assets") {
      return <AssetsPage apiReady={apiReady} projects={projects.data ?? []} onOpenAsset={(assetId) => openAsset(assetId, "assets")} />;
    }

    if (view === "connectors") {
      return <ConnectorsPage apiReady={apiReady} />;
    }

    if (view === "agent") {
      return <AgentPage apiReady={apiReady} projects={projects.data ?? []} />;
    }

    if (view === "analytics") {
      return <AnalyticsPage apiReady={apiReady} />;
    }

    if (view === "project-detail") {
      return (
        <ProjectDetailPage
          apiReady={apiReady}
          project={selectedProject.data}
          isLoading={selectedProject.isLoading}
          isError={selectedProject.isError}
          error={selectedProject.error}
          onBack={() => setView("projects")}
          onOpenAsset={(assetId) => openAsset(assetId, "project-detail")}
        />
      );
    }

    if (view === "asset-detail") {
      return (
        <AssetDetailPage
          asset={selectedAsset.data}
          projects={projects.data ?? []}
          isLoading={selectedAsset.isLoading}
          isError={selectedAsset.isError}
          error={selectedAsset.error}
          onBack={() => setView(assetBackView)}
        />
      );
    }

    return <ProjectsPage apiReady={apiReady} onOpenProject={openProject} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{text.appTitle}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{text.appSubtitle}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span>{text.language}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900"
            >
              <option value="zh-CN">{text.languageChinese}</option>
              <option value="en">{text.languageEnglish}</option>
            </select>
          </label>
          <AppNav
            activeView={activeNavView}
            onNavigate={(nextView) => {
              setView(nextView);
            }}
          />
        </div>
      </header>
      <main className="p-6">{renderCurrentView()}</main>
    </div>
  );
}
