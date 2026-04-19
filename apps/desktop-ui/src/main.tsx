import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.js";
import "./index.css";
import { LanguageProvider } from "./lib/i18n.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
