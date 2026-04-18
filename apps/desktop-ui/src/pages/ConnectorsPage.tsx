import { useEffect, useMemo, useState } from "react";
import type { ConnectorConfigView } from "@starline/shared";
import { useConnectors, useSaveConnector, useTestConnector } from "../hooks/useConnectors.js";

type MinimaxView = Extract<ConnectorConfigView, { connectorId: "minimax" }>;
type StableDiffusionView = Extract<ConnectorConfigView, { connectorId: "stable-diffusion" }>;

type TestState = {
  ok: boolean;
  latencyMs: number;
  error?: string;
} | null;

function cardTone(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50/60"
    : "border-gray-200 bg-white";
}

function sourceTone(source: "db" | "env") {
  return source === "db"
    ? "bg-slate-900 text-white"
    : "bg-amber-100 text-amber-800";
}

function findConnector<TConnectorId extends ConnectorConfigView["connectorId"]>(
  items: ConnectorConfigView[] | undefined,
  connectorId: TConnectorId,
): Extract<ConnectorConfigView, { connectorId: TConnectorId }> | undefined {
  return items?.find((item) => item.connectorId === connectorId) as Extract<ConnectorConfigView, { connectorId: TConnectorId }> | undefined;
}

interface Props {
  apiReady: boolean;
}

export default function ConnectorsPage({ apiReady }: Props) {
  const connectors = useConnectors(apiReady);
  const saveConnector = useSaveConnector();
  const testConnector = useTestConnector();

  const minimax = useMemo(
    () => findConnector(connectors.data?.items, "minimax") as MinimaxView | undefined,
    [connectors.data],
  );
  const stableDiffusion = useMemo(
    () => findConnector(connectors.data?.items, "stable-diffusion") as StableDiffusionView | undefined,
    [connectors.data],
  );

  const [minimaxEnabled, setMinimaxEnabled] = useState(false);
  const [minimaxApiKey, setMinimaxApiKey] = useState("");
  const [stableEnabled, setStableEnabled] = useState(false);
  const [stableBaseUrl, setStableBaseUrl] = useState("http://127.0.0.1:7860");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestState>>({});

  useEffect(() => {
    if (!minimax) return;
    setMinimaxEnabled(minimax.enabled);
  }, [minimax]);

  useEffect(() => {
    if (!stableDiffusion) return;
    setStableEnabled(stableDiffusion.enabled);
    setStableBaseUrl(stableDiffusion.config.baseUrl);
  }, [stableDiffusion]);

  async function saveMinimax() {
    setFeedback(null);
    try {
      await saveConnector.mutateAsync({
        connectorId: "minimax",
        enabled: minimaxEnabled,
        config: minimaxApiKey.trim() ? { apiKey: minimaxApiKey.trim() } : {},
      });
      setMinimaxApiKey("");
      setFeedback("MiniMax settings saved.");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function saveStableDiffusion() {
    setFeedback(null);
    try {
      await saveConnector.mutateAsync({
        connectorId: "stable-diffusion",
        enabled: stableEnabled,
        config: { baseUrl: stableBaseUrl.trim() },
      });
      setFeedback("Stable Diffusion settings saved.");
    } catch (error) {
      setFeedback(String(error));
    }
  }

  async function runTest(connectorId: "minimax" | "stable-diffusion") {
    setFeedback(null);
    try {
      const result = await testConnector.mutateAsync(connectorId);
      setTestResults((current) => ({
        ...current,
        [connectorId]: {
          ok: result.ok,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      }));
    } catch (error) {
      setTestResults((current) => ({
        ...current,
        [connectorId]: {
          ok: false,
          latencyMs: 0,
          error: String(error),
        },
      }));
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Connectors</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage local provider settings, secret state, and live health checks.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Persistence</p>
          <p className="text-sm font-medium text-gray-700">DB config + local secret store</p>
        </div>
      </div>

      {connectors.isLoading && <p className="text-sm text-gray-500">Loading connectors...</p>}
      {connectors.isError && (
        <p className="text-sm text-red-600">Failed to load connectors: {String(connectors.error)}</p>
      )}
      {feedback && <p className="text-sm text-gray-700">{feedback}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`rounded-2xl border p-5 shadow-sm ${cardTone(minimaxEnabled)}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">MiniMax</h3>
                {minimax && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceTone(minimax.source)}`}>
                    {minimax.source === "db" ? "Saved locally" : "Env fallback"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Image connector backed by a locally stored API key.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={minimaxEnabled}
                onChange={(event) => setMinimaxEnabled(event.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-inset ring-gray-200">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-700">API key</p>
                <span className={`text-xs font-medium ${minimax?.hasStoredSecret ? "text-emerald-700" : "text-gray-400"}`}>
                  {minimax?.hasStoredSecret ? "Stored locally" : "Not saved"}
                </span>
              </div>
              <input
                type="password"
                value={minimaxApiKey}
                onChange={(event) => setMinimaxApiKey(event.target.value)}
                placeholder={minimax?.hasStoredSecret ? "Leave blank to keep current key" : "Enter MiniMax API key"}
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-inset ring-gray-200">
              <p className="text-sm font-medium text-gray-700">Runtime note</p>
              <p className="mt-1 text-sm text-gray-500">
                DB secret overrides env fallback. Standard read APIs never return the plaintext key.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void saveMinimax()}
                disabled={saveConnector.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save MiniMax
              </button>
              <button
                onClick={() => void runTest("minimax")}
                disabled={testConnector.isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Test Connector
              </button>
            </div>

            {testResults["minimax"] && (
              <p className={`text-sm ${testResults["minimax"]?.ok ? "text-emerald-700" : "text-red-600"}`}>
                {testResults["minimax"]?.ok
                  ? `Healthy in ${testResults["minimax"]?.latencyMs}ms`
                  : `Test failed: ${testResults["minimax"]?.error}`}
              </p>
            )}
          </div>
        </section>

        <section className={`rounded-2xl border p-5 shadow-sm ${cardTone(stableEnabled)}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Stable Diffusion WebUI</h3>
                {stableDiffusion && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${sourceTone(stableDiffusion.source)}`}>
                    {stableDiffusion.source === "db" ? "Saved locally" : "Env fallback"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Local WebUI endpoint used for health checks and image generation.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={stableEnabled}
                onChange={(event) => setStableEnabled(event.target.checked)}
              />
              Enabled
            </label>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-inset ring-gray-200">
              <p className="text-sm font-medium text-gray-700">Base URL</p>
              <input
                type="url"
                value={stableBaseUrl}
                onChange={(event) => setStableBaseUrl(event.target.value)}
                placeholder="http://127.0.0.1:7860"
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="rounded-xl bg-white/80 px-4 py-3 ring-1 ring-inset ring-gray-200">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-700">Secret state</p>
                <span className="text-xs font-medium text-gray-400">
                  {stableDiffusion?.hasStoredSecret ? "Stored" : "Not used"}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Stable Diffusion only stores endpoint config. No separate secret is required in the current MVP path.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void saveStableDiffusion()}
                disabled={saveConnector.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save Stable Diffusion
              </button>
              <button
                onClick={() => void runTest("stable-diffusion")}
                disabled={testConnector.isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Test Connector
              </button>
            </div>

            {testResults["stable-diffusion"] && (
              <p className={`text-sm ${testResults["stable-diffusion"]?.ok ? "text-emerald-700" : "text-red-600"}`}>
                {testResults["stable-diffusion"]?.ok
                  ? `Healthy in ${testResults["stable-diffusion"]?.latencyMs}ms`
                  : `Test failed: ${testResults["stable-diffusion"]?.error}`}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
