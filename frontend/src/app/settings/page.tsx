/**
 * SettingsPage - 系统设置页面
 *
 * 功能：模型配置（API Key / Base URL / 模型名称）+ 外观主题切换
 * 数据流：GET /api/v1/settings/llm → 填充表单；提交 → PUT /api/v1/settings/llm
 * 交互：选择预设提供商自动填充 base_url + model；保存后显示成功提示
 */

"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, type LLMConfigUpdate, type TestConnectionResult } from "@/lib/api";
import { useTheme } from "@/app/providers";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sun, Moon, Eye, EyeOff, Wifi, WifiOff, Zap } from "lucide-react";

type TabKey = "model" | "appearance";

const TABS: { key: TabKey; label: string }[] = [
  { key: "model", label: "模型配置" },
  { key: "appearance", label: "外观" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("model");

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold">系统设置</h2>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "model" && <ModelConfigTab />}
      {activeTab === "appearance" && <AppearanceTab />}
    </div>
  );
}

// ── 模型配置 Tab ────────────────────────────────────────────────────

function ModelConfigTab() {
  const queryClient = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["settings-llm"],
    queryFn: settingsApi.getLLM,
  });

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [maxConcurrency, setMaxConcurrency] = useState(5);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  // Server state: result from the last "test connection" call
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  useEffect(() => {
    if (cfg) {
      setBaseUrl(cfg.base_url);
      setModel(cfg.model);
      setMaxConcurrency(cfg.max_concurrency);
    }
  }, [cfg]);

  const updateMutation = useMutation({
    mutationFn: (data: LLMConfigUpdate) => settingsApi.updateLLM(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-llm"] });
      setSaved(true);
      setTestResult(null);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const testMutation = useMutation({
    mutationFn: settingsApi.testConnection,
    onSuccess: (data) => setTestResult(data),
  });

  function handlePreset(preset: { base_url: string; model: string }) {
    setBaseUrl(preset.base_url);
    setModel(preset.model);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const update: LLMConfigUpdate = { base_url: baseUrl, model, max_concurrency: maxConcurrency };
    if (apiKey.trim()) update.api_key = apiKey.trim();
    updateMutation.mutate(update);
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">加载中...</div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Provider presets */}
      <div>
        <label className="mb-2 block text-sm font-medium">快速选择提供商</label>
        <div className="flex flex-wrap gap-2">
          {cfg?.presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePreset(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                baseUrl === p.base_url
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          API Key
          <span className="ml-2 text-xs text-muted-foreground">
            （当前：{cfg?.api_key_masked}）
          </span>
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="留空则保持不变"
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className="mb-1 block text-sm font-medium">API Base URL</label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Model name */}
      <div>
        <label className="mb-1 block text-sm font-medium">模型名称</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          required
          placeholder="如 gpt-4o-mini / deepseek-chat / qwen-plus"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Max concurrency */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          最大并发数
          <span className="ml-2 text-xs text-muted-foreground">
            （多 Agent 评估时同时发出的请求数，建议 3-8）
          </span>
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={maxConcurrency}
          onChange={(e) => setMaxConcurrency(Number(e.target.value))}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className={cn(
              "flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors",
              updateMutation.isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90",
            )}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {updateMutation.isPending ? "保存中..." : saved ? "已保存" : "保存配置"}
          </button>

          <button
            type="button"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors",
              testMutation.isPending
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-secondary",
            )}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {testMutation.isPending ? "测试中..." : "测试连接"}
          </button>

          {updateMutation.isError && (
            <span className="text-sm text-destructive">保存失败，请重试</span>
          )}
        </div>

        {/* Connection test result banner */}
        {testResult && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
              testResult.ok
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {testResult.ok ? (
              <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-medium">
                {testResult.ok ? "连接成功" : "连接失败"}
                {testResult.ok && (
                  <span className="ml-2 font-normal opacity-70">
                    {testResult.latency_ms} ms
                  </span>
                )}
              </p>
              <p className="opacity-80">{testResult.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="ml-auto shrink-0 opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

// ── 外观 Tab ─────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  const THEMES = [
    { value: "light" as const, label: "亮色", icon: Sun, desc: "白色背景，适合白天使用" },
    { value: "dark" as const, label: "暗色", icon: Moon, desc: "深色背景，保护眼睛" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-medium">主题</h3>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-colors",
                theme === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    theme === value ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "font-medium",
                    theme === value ? "text-primary" : "text-foreground",
                  )}
                >
                  {label}
                </span>
                {theme === value && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        主题选择会立即生效，并保存在本地浏览器中，刷新页面后自动恢复。
      </div>
    </div>
  );
}
