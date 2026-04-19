import { useI18n } from "../lib/i18n.js";

type View = "projects" | "assets" | "connectors" | "agent" | "analytics";

interface Props {
  activeView: View;
  onNavigate: (view: View) => void;
}

export default function AppNav({ activeView, onNavigate }: Props) {
  const { text } = useI18n();

  const itemClass = (view: View) =>
    `px-3 py-2 text-sm rounded-md transition-colors ${
      activeView === view
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <nav className="flex items-center gap-2">
      <button className={itemClass("projects")} onClick={() => onNavigate("projects")}>
        {text.navProjects}
      </button>
      <button className={itemClass("assets")} onClick={() => onNavigate("assets")}>
        {text.navAssets}
      </button>
      <button className={itemClass("connectors")} onClick={() => onNavigate("connectors")}>
        {text.navConnectors}
      </button>
      <button className={itemClass("agent")} onClick={() => onNavigate("agent")}>
        {text.navAgent}
      </button>
      <button className={itemClass("analytics")} onClick={() => onNavigate("analytics")}>
        {text.navAnalytics}
      </button>
    </nav>
  );
}
