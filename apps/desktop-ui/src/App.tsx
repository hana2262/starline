import { useEffect, useMemo, useState } from "react";
import ProjectsPage from "./pages/ProjectsPage.js";
import AssetsPage from "./pages/AssetsPage.js";
import ProjectDetailPage from "./pages/ProjectDetailPage.js";
import ConnectorsPage from "./pages/ConnectorsPage.js";
import AppNav from "./components/AppNav.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProject } from "./hooks/useProject.js";
import { HEALTH_URL } from "./lib/runtime.js";

type RootView = "projects" | "assets" | "connectors" | "project-detail";
type BootStatus = "checking" | "ready" | "failed";

export default function App() {
  const [view, setView] = useState<RootView>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [bootStatus, setBootStatus] = useState<BootStatus>("checking");
  const apiReady = bootStatus === "ready";
  const projects = useProjects(apiReady);
  const selectedProject = useProject(selectedProjectId, apiReady);

  const activeNavView = useMemo(() => {
    if (view === "assets") return "assets";
    if (view === "connectors") return "connectors";
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

  function renderCurrentView() {
    if (bootStatus === "checking") {
      return (
        <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Starting local API...</h2>
          <p className="text-sm text-gray-500 mt-2">
            The desktop shell is waiting for the local StarLine service to become ready.
          </p>
        </div>
      );
    }

    if (bootStatus === "failed") {
      return (
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold text-red-700">Local API did not start</h2>
          <p className="text-sm text-red-600 mt-2">
            Check the local-api runtime log and retry the desktop shell.
          </p>
          <p className="text-xs text-red-500 mt-3">
            Release diagnostics are written under `%LOCALAPPDATA%\com.starline.desktop\logs\local-api.log`.
          </p>
        </div>
      );
    }

    if (view === "assets") {
      return <AssetsPage apiReady={apiReady} projects={projects.data ?? []} />;
    }

    if (view === "connectors") {
      return <ConnectorsPage apiReady={apiReady} />;
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
        />
      );
    }

    return <ProjectsPage apiReady={apiReady} onOpenProject={openProject} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">StarLine</h1>
          <p className="text-xs text-gray-500 mt-0.5">Sprint-1 desktop usability slice</p>
        </div>
        <AppNav
          activeView={activeNavView}
          onNavigate={(nextView) => {
            setView(nextView);
          }}
        />
      </header>
      <main className="p-6">{renderCurrentView()}</main>
    </div>
  );
}
