import { useMemo, useState } from "react";
import ProjectsPage from "./pages/ProjectsPage.js";
import AssetsPage from "./pages/AssetsPage.js";
import ProjectDetailPage from "./pages/ProjectDetailPage.js";
import AppNav from "./components/AppNav.js";
import { useProjects } from "./hooks/useProjects.js";
import { useProject } from "./hooks/useProject.js";

type RootView = "projects" | "assets" | "project-detail";

export default function App() {
  const [view, setView] = useState<RootView>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const projects = useProjects();
  const selectedProject = useProject(selectedProjectId);

  const activeNavView = useMemo(() => (view === "assets" ? "assets" : "projects"), [view]);

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setView("project-detail");
  }

  function renderCurrentView() {
    if (view === "assets") {
      return <AssetsPage projects={projects.data ?? []} />;
    }

    if (view === "project-detail") {
      return (
        <ProjectDetailPage
          project={selectedProject.data}
          isLoading={selectedProject.isLoading}
          isError={selectedProject.isError}
          error={selectedProject.error}
          onBack={() => setView("projects")}
        />
      );
    }

    return <ProjectsPage onOpenProject={openProject} />;
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
