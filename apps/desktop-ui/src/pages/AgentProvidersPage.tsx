import { useEffect, useMemo, useState } from "react";
import type {
  AgentProtocolId,
  AgentProviderConfig,
  AgentProviderUpsertInput,
  AgentVendorId,
} from "@starline/shared";
import {
  useActivateAgentProvider,
  useAgentProviders,
  useRemoveAgentProvider,
  useSaveAgentProvider,
  useTestAgentProvider,
} from "../hooks/useAgentProviders.js";
import { useI18n } from "../lib/i18n.js";

interface Props {
  apiReady: boolean;
  onBack: () => void;
}

interface VendorPreset {
  vendor: AgentVendorId;
  label: string;
  description: string;
  recommendedProtocol: AgentProtocolId;
  defaultBaseUrl: string;
  defaultModel: string;
  accent: string;
}

interface ProviderDraft {
  id?: string;
  slug: string;
  vendor: AgentVendorId;
  protocol: AgentProtocolId;
  label: string;
  note: string;
  website: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: string;
  maxOutputTokens: string;
  isActive: boolean;
}

const VENDOR_PRESETS: VendorPreset[] = [
  {
    vendor: "custom",
    label: "自定义配置",
    description: "手动填写供应商信息和接口格式。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "",
    defaultModel: "",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    vendor: "openai",
    label: "OpenAI",
    description: "官方 OpenAI 服务，默认建议配合 OpenAI Responses。",
    recommendedProtocol: "openai-responses",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    vendor: "anthropic",
    label: "Claude",
    description: "Anthropic 官方接口。",
    recommendedProtocol: "anthropic",
    defaultBaseUrl: "",
    defaultModel: "claude-sonnet-4-20250514",
    accent: "border-violet-200 bg-violet-50 text-violet-700",
  },
  {
    vendor: "gemini",
    label: "Gemini",
    description: "Google Gemini / Vertex AI 风格配置。",
    recommendedProtocol: "gemini",
    defaultBaseUrl: "",
    defaultModel: "gemini-2.5-pro",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    vendor: "deepseek",
    label: "DeepSeek",
    description: "常见走 OpenAI Compatible。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    accent: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  {
    vendor: "kimi",
    label: "Kimi",
    description: "Moonshot / Kimi 常见兼容 OpenAI 协议。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2-0905-preview",
    accent: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    vendor: "minimax",
    label: "MiniMax",
    description: "MiniMax 文本模型配置。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "",
    defaultModel: "MiniMax-Text-01",
    accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
  {
    vendor: "openrouter",
    label: "OpenRouter",
    description: "OpenRouter 聚合路由。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-5.4-mini",
    accent: "border-slate-300 bg-slate-100 text-slate-700",
  },
  {
    vendor: "qwen",
    label: "Qwen",
    description: "通义千问 / 阿里云兼容配置。",
    recommendedProtocol: "openai-compatible",
    defaultBaseUrl: "",
    defaultModel: "qwen-max",
    accent: "border-rose-200 bg-rose-50 text-rose-700",
  },
  {
    vendor: "mock",
    label: "Mock",
    description: "本地开发调试用。",
    recommendedProtocol: "mock",
    defaultBaseUrl: "",
    defaultModel: "mock-agent-v1",
    accent: "border-slate-200 bg-slate-50 text-slate-700",
  },
];

const PROTOCOL_OPTIONS: Array<{ value: AgentProtocolId; label: string }> = [
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "openai-compatible", label: "OpenAI Compatible" },
  { value: "anthropic", label: "Anthropic" },
  { value: "bedrock", label: "Amazon Bedrock" },
  { value: "gemini", label: "Google (Gemini)" },
  { value: "mock", label: "Mock" },
];

const SUPPORTED_PROTOCOLS = new Set<AgentProtocolId>(["mock", "openai-compatible"]);

function presetFor(vendor: AgentVendorId): VendorPreset {
  return VENDOR_PRESETS.find((item) => item.vendor === vendor) ?? VENDOR_PRESETS[0]!;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function defaultDraft(): ProviderDraft {
  const preset = presetFor("custom");
  return {
    slug: "custom-provider",
    vendor: preset.vendor,
    protocol: preset.recommendedProtocol,
    label: preset.label,
    note: "",
    website: "",
    baseUrl: preset.defaultBaseUrl,
    model: preset.defaultModel,
    apiKey: "",
    temperature: "0.2",
    maxOutputTokens: "512",
    isActive: true,
  };
}

function toDraft(item: AgentProviderConfig): ProviderDraft {
  return {
    id: item.id,
    slug: item.slug,
    vendor: item.vendor,
    protocol: item.protocol,
    label: item.label,
    note: item.note ?? "",
    website: item.website ?? "",
    baseUrl: item.baseUrl ?? "",
    model: item.model,
    apiKey: "",
    temperature: item.temperature ?? "",
    maxOutputTokens: item.maxOutputTokens !== null ? String(item.maxOutputTokens) : "",
    isActive: item.isActive,
  };
}

function toUpsertInput(draft: ProviderDraft): AgentProviderUpsertInput {
  return {
    id: draft.id,
    slug: draft.slug.trim(),
    vendor: draft.vendor,
    protocol: draft.protocol,
    label: draft.label.trim(),
    note: draft.note.trim(),
    website: draft.website.trim(),
    baseUrl: draft.baseUrl.trim(),
    model: draft.model.trim(),
    apiKey: draft.apiKey.trim() || undefined,
    temperature: draft.temperature.trim(),
    maxOutputTokens: draft.maxOutputTokens.trim() ? Number(draft.maxOutputTokens.trim()) : undefined,
    isActive: draft.isActive,
  };
}

export default function AgentProvidersPage({ apiReady, onBack }: Props) {
  const { locale } = useI18n();
  const providers = useAgentProviders(apiReady);
  const saveProvider = useSaveAgentProvider();
  const activateProvider = useActivateAgentProvider();
  const removeProvider = useRemoveAgentProvider();
  const testProvider = useTestAgentProvider();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderDraft>(defaultDraft);
  const [feedback, setFeedback] = useState<string | null>(null);

  const items = providers.data?.items ?? [];
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setDraft(toDraft(selected));
      return;
    }

    if (selectedId === null) {
      setDraft(defaultDraft());
    }
  }, [selected, selectedId]);

  const copy = {
    title: locale === "zh-CN" ? "Agent Providers" : "Agent providers",
    subtitle:
      locale === "zh-CN"
        ? "先选择供应商预设，再配置接口格式、模型和密钥。API key 只会保存在本地，不会明文回显。"
        : "Choose a vendor preset first, then configure the protocol, model, and credentials. API keys stay local only.",
    back: locale === "zh-CN" ? "返回 Agent" : "Back to Agent",
    newProvider: locale === "zh-CN" ? "新增配置" : "New profile",
    presetTitle: locale === "zh-CN" ? "供应商预设" : "Vendor presets",
    presetHint:
      locale === "zh-CN"
        ? "当前已实现协议：Mock、OpenAI Compatible。其他接口格式会作为后续扩展位保留。"
        : "Implemented protocols: Mock and OpenAI Compatible. Other protocol options are preserved as future extension slots.",
    profiles: locale === "zh-CN" ? "已保存配置" : "Saved profiles",
    noProviders: locale === "zh-CN" ? "还没有 Provider 配置。" : "No provider profiles yet.",
    active: locale === "zh-CN" ? "当前生效" : "Active",
    activate: locale === "zh-CN" ? "设为当前" : "Set active",
    test: locale === "zh-CN" ? "测试" : "Test",
    edit: locale === "zh-CN" ? "编辑" : "Edit",
    delete: locale === "zh-CN" ? "删除" : "Delete",
    save: locale === "zh-CN" ? "保存配置" : "Save profile",
    saving: locale === "zh-CN" ? "保存中..." : "Saving...",
    saved: locale === "zh-CN" ? "Provider 配置已保存。" : "Provider profile saved.",
    testedOk: locale === "zh-CN" ? "Provider 测试成功。" : "Provider test succeeded.",
    testedFail: locale === "zh-CN" ? "Provider 测试失败。" : "Provider test failed.",
    unsupportedProtocol:
      locale === "zh-CN"
        ? "当前 StarLine 还未实现这个接口格式。你可以先保存配置，但暂时无法立即启用。"
        : "This protocol is not implemented in StarLine yet. You can save it, but it cannot be activated yet.",
    slug: locale === "zh-CN" ? "供应商标识" : "Provider slug",
    slugHint:
      locale === "zh-CN"
        ? "稳定标识，只能使用小写字母、数字和连字符。"
        : "Stable identifier, limited to lowercase letters, numbers, and hyphens.",
    label: locale === "zh-CN" ? "供应商名称" : "Display name",
    note: locale === "zh-CN" ? "备注" : "Note",
    website: locale === "zh-CN" ? "官网链接" : "Website",
    protocol: locale === "zh-CN" ? "接口格式" : "Protocol",
    apiKey: locale === "zh-CN" ? "API Key" : "API Key",
    apiKeyHint:
      locale === "zh-CN"
        ? "只会本地保存，不会通过接口明文返回。"
        : "Stored locally only and never returned in plaintext.",
    apiKeySaved: locale === "zh-CN" ? "已保存 Key" : "API key saved",
    baseUrl: locale === "zh-CN" ? "Base URL" : "Base URL",
    model: locale === "zh-CN" ? "Model" : "Model",
    temperature: locale === "zh-CN" ? "Temperature" : "Temperature",
    maxOutputTokens: locale === "zh-CN" ? "最大输出 Tokens" : "Max output tokens",
    activateAfterSave: locale === "zh-CN" ? "保存后设为当前" : "Set active after save",
    deleteConfirm:
      locale === "zh-CN"
        ? "删除这个 Provider 配置会同时移除本地保存的 API key，是否继续？"
        : "Deleting this provider profile will also remove the locally stored API key. Continue?",
  };

  function handleVendorSelect(vendor: AgentVendorId) {
    const preset = presetFor(vendor);
    setDraft((current) => {
      const nextLabel = current.id ? current.label : preset.label;
      const nextSlug = current.id ? current.slug : slugify(preset.label || `${vendor}-provider`);
      const nextModel = current.id ? current.model : preset.defaultModel;
      const nextBaseUrl = current.id ? current.baseUrl : preset.defaultBaseUrl;

      return {
        ...current,
        vendor,
        protocol: preset.recommendedProtocol,
        label: nextLabel,
        slug: nextSlug || `${vendor}-provider`,
        baseUrl: nextBaseUrl,
        model: nextModel,
      };
    });
  }

  async function handleSave() {
    const result = await saveProvider.mutateAsync(toUpsertInput(draft));
    setSelectedId(result.item.id);
    setDraft(toDraft(result.item));
    setFeedback(copy.saved);
  }

  async function handleActivate(id: string) {
    await activateProvider.mutateAsync(id);
    setSelectedId(id);
    setFeedback(null);
  }

  async function handleTest(id: string) {
    const result = await testProvider.mutateAsync(id);
    setFeedback(result.ok ? copy.testedOk : `${copy.testedFail} ${result.error ?? ""}`.trim());
  }

  async function handleDelete(id: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    await removeProvider.mutateAsync(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDraft(defaultDraft());
    }
    setFeedback(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{copy.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedId(null);
              setDraft(defaultDraft());
              setFeedback(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copy.newProvider}
          </button>
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copy.back}
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{copy.presetTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">{copy.presetHint}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {VENDOR_PRESETS.map((preset) => {
            const active = draft.vendor === preset.vendor;
            return (
              <button
                key={preset.vendor}
                type="button"
                onClick={() => handleVendorSelect(preset.vendor)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? `${preset.accent} shadow-sm`
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <p className="text-sm font-semibold">{preset.label}</p>
                <p className="mt-1 text-xs opacity-80">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{copy.profiles}</h3>
          </div>

          <div className="space-y-3">
            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {copy.noProviders}
              </div>
            )}
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border px-4 py-4 shadow-sm ${
                  selectedId === item.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                      {item.vendor} · {item.protocol}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{item.model}</p>
                  </div>
                  {item.isActive && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      {copy.active}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedId(item.id);
                      setDraft(toDraft(item));
                      setFeedback(null);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copy.edit}
                  </button>
                  {!item.isActive && (
                    <button
                      onClick={() => void handleActivate(item.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copy.activate}
                    </button>
                  )}
                  <button
                    onClick={() => void handleTest(item.id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copy.test}
                  </button>
                  <button
                    onClick={() => void handleDelete(item.id)}
                    disabled={item.isActive || removeProvider.isPending}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copy.delete}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.slug}</span>
              <input
                value={draft.slug}
                onChange={(event) => setDraft((current) => ({ ...current, slug: slugify(event.target.value) }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500">{copy.slugHint}</p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.label}</span>
              <input
                value={draft.label}
                onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.note}</span>
              <input
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.website}</span>
              <input
                value={draft.website}
                onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                placeholder="https://example.com"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{copy.protocol}</span>
              <select
                value={draft.protocol}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, protocol: event.target.value as AgentProtocolId }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                {PROTOCOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!SUPPORTED_PROTOCOLS.has(draft.protocol) && (
                <p className="text-xs text-amber-700">{copy.unsupportedProtocol}</p>
              )}
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{copy.apiKey}</span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                placeholder={draft.protocol === "mock" ? "" : "sk-..."}
              />
              <p className="text-xs text-slate-500">
                {selected?.hasApiKey && !draft.apiKey.trim()
                  ? `${copy.apiKeySaved}. ${copy.apiKeyHint}`
                  : copy.apiKeyHint}
              </p>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{copy.baseUrl}</span>
              <input
                value={draft.baseUrl}
                onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                placeholder="https://api.example.com/v1"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.model}</span>
              <input
                value={draft.model}
                onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.temperature}</span>
              <input
                value={draft.temperature}
                onChange={(event) => setDraft((current) => ({ ...current, temperature: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                placeholder="0.2"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{copy.maxOutputTokens}</span>
              <input
                value={draft.maxOutputTokens}
                onChange={(event) => setDraft((current) => ({ ...current, maxOutputTokens: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                placeholder="512"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">{copy.activateAfterSave}</span>
            </label>
          </div>

          {feedback && (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {feedback}
            </p>
          )}

          {(saveProvider.isError || activateProvider.isError || testProvider.isError || removeProvider.isError) && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {String(saveProvider.error ?? activateProvider.error ?? testProvider.error ?? removeProvider.error)}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saveProvider.isPending}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveProvider.isPending ? copy.saving : copy.save}
            </button>
            {selected && !selected.isActive && (
              <button
                onClick={() => void handleActivate(selected.id)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {copy.activate}
              </button>
            )}
            {selected && (
              <button
                onClick={() => void handleTest(selected.id)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {copy.test}
              </button>
            )}
            {selected && (
              <button
                onClick={() => void handleDelete(selected.id)}
                disabled={selected.isActive || removeProvider.isPending}
                className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.delete}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
