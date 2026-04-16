import ProjectsPage from "./pages/ProjectsPage.js";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center">
        <h1 className="text-lg font-semibold text-gray-900">StarLine</h1>
      </header>
      <main className="p-6">
        <ProjectsPage />
      </main>
    </div>
  );
}
