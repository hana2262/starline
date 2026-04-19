type View = "projects" | "assets" | "connectors" | "agent" | "analytics";

interface Props {
  activeView: View;
  onNavigate: (view: View) => void;
}

export default function AppNav({ activeView, onNavigate }: Props) {
  const itemClass = (view: View) =>
    `px-3 py-2 text-sm rounded-md transition-colors ${
      activeView === view
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <nav className="flex items-center gap-2">
      <button className={itemClass("projects")} onClick={() => onNavigate("projects")}>
        Projects
      </button>
      <button className={itemClass("assets")} onClick={() => onNavigate("assets")}>
        Assets
      </button>
      <button className={itemClass("connectors")} onClick={() => onNavigate("connectors")}>
        Connectors
      </button>
      <button className={itemClass("agent")} onClick={() => onNavigate("agent")}>
        Agent
      </button>
      <button className={itemClass("analytics")} onClick={() => onNavigate("analytics")}>
        Analytics
      </button>
    </nav>
  );
}
