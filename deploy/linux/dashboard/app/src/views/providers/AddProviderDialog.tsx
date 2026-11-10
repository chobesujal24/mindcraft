import { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../../data/api";
import type { Provider, ProviderTest } from "../../data/types";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Dialog } from "../../ui/Dialog";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/icons";
import { ProviderLogo, type ProviderType } from "./ProviderLogo";

export type Preset = {
  id: string;
  type: ProviderType;
  label: string;
  note: string;
  tag: string;
  provider: Omit<Provider, "enabled">;
};

export const PRESETS: Preset[] = [
  {
    id: "intern-ai",
    type: "intern",
    label: "Intern AI",
    note: "InternVL multimodal · OpenAI-compatible",
    tag: "internvl3.5-latest",
    provider: {
      id: "intern-ai",
      name: "Intern AI",
      baseURL: "https://chat.intern-ai.org.cn/api/v1",
      keyName: "INTERN_API_KEY",
      model: "internvl3.5-latest",
      timeoutMs: 45_000,
      keyConfigured: false,
    },
  },
  {
    id: "deepseek-preset",
    type: "deepseek",
    label: "DeepSeek",
    note: "DeepSeek V3 / R1 reasoning gateway",
    tag: "deepseek-chat",
    provider: {
      id: "deepseek",
      name: "DeepSeek",
      baseURL: "https://api.deepseek.com/v1",
      keyName: "DEEPSEEK_API_KEY",
      model: "deepseek-chat",
      timeoutMs: 60_000,
      keyConfigured: false,
    },
  },
  {
    id: "groq-preset",
    type: "groq",
    label: "Groq Cloud",
    note: "Ultra-fast LPUs · 300+ tok/s",
    tag: "llama-3.3-70b-versatile",
    provider: {
      id: "groq-llama",
      name: "Groq Llama 3.3",
      baseURL: "https://api.groq.com/openai/v1",
      keyName: "GROQ_API_KEY",
      model: "llama-3.3-70b-versatile",
      timeoutMs: 30_000,
      keyConfigured: false,
    },
  },
  {
    id: "gemini-preset",
    type: "gemini",
    label: "Google Gemini",
    note: "OpenAI-compatible endpoint · 1M context",
    tag: "gemini-2.5-flash",
    provider: {
      id: "gemini",
      name: "Google Gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      keyName: "GEMINI_API_KEY",
      model: "gemini-2.5-flash",
      timeoutMs: 45_000,
      keyConfigured: false,
    },
  },
  {
    id: "openai-preset",
    type: "openai",
    label: "OpenAI",
    note: "Standard OpenAI endpoint",
    tag: "gpt-4o-mini",
    provider: {
      id: "openai",
      name: "OpenAI",
      baseURL: "https://api.openai.com/v1",
      keyName: "OPENAI_API_KEY",
      model: "gpt-4o-mini",
      timeoutMs: 30_000,
      keyConfigured: false,
    },
  },
  {
    id: "nvidia-preset",
    type: "nvidia",
    label: "NVIDIA NIM",
    note: "NVIDIA-hosted open models · OpenAI-compatible",
    tag: "nemotron-3.5-lightning",
    provider: {
      id: "nvidia-nim",
      name: "NVIDIA NIM",
      baseURL: "https://integrate.api.nvidia.com/v1",
      keyName: "NVIDIA_API_KEY",
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      timeoutMs: 30_000,
      keyConfigured: false,
    },
  },
  {
    id: "river-preset",
    type: "river",
    label: "River.ai",
    note: "DeepSeek reasoning routes · fast failover",
    tag: "deepseek-v4.1-flash",
    provider: {
      id: "river-ai",
      name: "River.ai",
      baseURL: "https://api.river.ai/v1",
      keyName: "RIVER_API_KEY",
      model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
      timeoutMs: 60_000,
      keyConfigured: false,
    },
  },
  {
    id: "openrouter-preset",
    type: "openrouter",
    label: "OpenRouter",
    note: "Unified gateway across 100+ open models",
    tag: "auto-route",
    provider: {
      id: "openrouter",
      name: "OpenRouter",
      baseURL: "https://openrouter.ai/api/v1",
      keyName: "OPENROUTER_API_KEY",
      model: "nvidia/nemotron-3.5-super-vl:free",
      timeoutMs: 60_000,
      keyConfigured: false,
    },
  },
  {
    id: "local-ollama",
    type: "ollama",
    label: "Local Ollama / vLLM",
    note: "Local inference loopback · zero cloud egress",
    tag: "localhost:11434",
    provider: {
      id: "ollama-local",
      name: "Local Ollama",
      baseURL: "http://127.0.0.1:11434/v1",
      keyName: "LOCAL_OLLAMA_KEY",
      model: "llama3:latest",
      timeoutMs: 45_000,
      keyConfigured: false,
    },
  },
];

type Draft = {
  name: string;
  baseURL: string;
  keyName: string;
  model: string;
  timeoutMs: string;
  key: string;
};

const EMPTY: Draft = {
  name: "",
  baseURL: "",
  keyName: "",
  model: "",
  timeoutMs: "30000",
  key: "",
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `provider-${Date.now().toString(36)}`
  );
}

function generateUniqueId(name: string, existingIDs: string[]): string {
  const base = slug(name);
  if (!existingIDs.includes(base)) return base;
  let count = 2;
  while (existingIDs.includes(`${base}-${count}`)) {
    count++;
  }
  return `${base}-${count}`;
}

function deriveKeyName(name: string): string {
  const clean = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!clean) return "API_KEY";
  // The server requires a leading letter and 2–64 characters.
  const base = (/^[A-Z]/.test(clean) ? clean : `P_${clean}`).slice(0, 56).replace(/_+$/, "");
  return `${base || "P"}_API_KEY`;
}

function normalizeBaseURL(value: string): string {
  let u = value.trim().replace(/\/+$/, "");
  u = u.replace(/\/chat\/completions\/?$/i, "").replace(/\/completions\/?$/i, "");
  return u;
}

function httpURL(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function AddProviderDialog({
  open,
  existingIDs,
  onClose,
  onAdd,
}: {
  open: boolean;
  existingIDs: string[];
  onClose: () => void;
  onAdd: (provider: Provider, key: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTest | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY);
    setSelectedPreset(null);
    setShowAdvanced(false);
    setShowKeyPassword(false);
    setSubmitted(false);
    setTesting(false);
    setTestResult(null);
  }, [open]);

  const cleanURL = normalizeBaseURL(draft.baseURL);

  const errors = useMemo(() => {
    const next: Partial<Record<keyof Draft, string>> = {};
    const name = draft.name.trim();
    if (!name) next.name = "Provider name is required.";
    else if (name.length > 80) next.name = "Provider name must be 80 characters or fewer.";
    if (!httpURL(cleanURL)) next.baseURL = "Must be a valid http:// or https:// URL.";
    if (!draft.model.trim()) next.model = "Model identifier is required.";
    const keyName = draft.keyName.trim() || deriveKeyName(draft.name);
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(keyName)) {
      next.keyName = "Start with a letter; use 2–64 uppercase letters, digits, or underscores.";
    }
    if (draft.key.length > 4096) next.key = "API keys are limited to 4,096 characters.";
    const timeout = Number(draft.timeoutMs);
    if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
      next.timeoutMs = "Timeout must be between 1,000 and 120,000 ms.";
    }
    return next;
  }, [draft.name, cleanURL, draft.model, draft.keyName, draft.key, draft.timeoutMs]);

  const valid = Object.keys(errors).length === 0;

  const onNameChange = (name: string) => {
    setDraft((current) => {
      const prevAuto = deriveKeyName(current.name);
      const shouldUpdateKey = !current.keyName || current.keyName === prevAuto;
      return {
        ...current,
        name,
        keyName: shouldUpdateKey ? deriveKeyName(name) : current.keyName,
      };
    });
  };

  const applyPreset = (entry: Preset) => {
    setSelectedPreset(entry.id);
    setTestResult(null);
    setDraft({
      name: entry.provider.name,
      baseURL: entry.provider.baseURL,
      keyName: entry.provider.keyName,
      model: entry.provider.model,
      timeoutMs: String(entry.provider.timeoutMs),
      key: "",
    });
  };

  const testConnection = async () => {
    if (!cleanURL) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testProvider(
        {
          id: slug(draft.name || "test"),
          baseURL: cleanURL,
          keyName: draft.keyName.trim() || deriveKeyName(draft.name || "API"),
          model: draft.model.trim() || "test",
        },
        draft.key.trim(),
      );
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        latencyMs: null,
        statusCode: null,
        modelCount: null,
        error: apiErrorMessage(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;

    const uniqueId = generateUniqueId(draft.name, existingIDs);
    const keyName = draft.keyName.trim() || deriveKeyName(draft.name);

    onAdd(
      {
        id: uniqueId,
        name: draft.name.trim(),
        baseURL: cleanURL,
        keyName,
        model: draft.model.trim(),
        timeoutMs: Number(draft.timeoutMs) || 30_000,
        enabled: true,
        keyConfigured: Boolean(draft.key.trim()),
      },
      draft.key.trim(),
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Provider routing"
      title="Add provider"
      description="Connect any OpenAI-compatible API to the worker fleet. Test credentials before staging."
      footer={
        <div className="add-provider-dialog__footer">
          <Button
            variant="secondary"
            leading={<Icon name="zap" size={12} />}
            loading={testing}
            loadingLabel="Testing endpoint…"
            disabled={!cleanURL || testing}
            onClick={() => void testConnection()}
          >
            Test Connection
          </Button>
          <div className="row" style={{ gap: 8 }}>
            <Button variant="quiet" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={submitted && !valid}>
              Add to chain
            </Button>
          </div>
        </div>
      }
    >
      <div className="add-provider-dialog">
        {/* Presets Grid */}
        <div className="add-provider-dialog__presets">
          <div className="add-provider-dialog__section-title">
            <span>Quick Presets</span>
            <span className="mute">Click any provider to autofill recommended configurations</span>
          </div>
          <div className="add-provider-dialog__preset-grid">
            {PRESETS.map((entry) => {
              const isSelected = selectedPreset === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="add-provider-preset-card"
                  data-selected={isSelected || undefined}
                  onClick={() => applyPreset(entry)}
                >
                  <div className="add-provider-preset-card__top">
                    <div className="add-provider-preset-card__logo">
                      <ProviderLogo type={entry.type} size={19} />
                    </div>
                    <span className="add-provider-preset-card__name">{entry.label}</span>
                  </div>
                  <div className="add-provider-preset-card__tag">{entry.tag}</div>
                  <div className="add-provider-preset-card__note">{entry.note}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <div className="add-provider-dialog__fields">
          <div className="field-row">
            <Field
              label="Provider Display Name"
              required
              error={submitted ? errors.name : undefined}
            >
              <input
                className="input"
                maxLength={80}
                value={draft.name}
                placeholder="e.g. Intern AI, DeepSeek R1, Groq"
                onChange={(event) => onNameChange(event.currentTarget.value)}
              />
            </Field>

            <Field
              label="Model Identifier"
              mono
              required
              error={submitted ? errors.model : undefined}
            >
              <input
                className="input input--mono"
                value={draft.model}
                placeholder="e.g. internvl3.5-latest or gpt-4o"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, model: value }));
                }}
              />
            </Field>
          </div>

          <Field
            label="OpenAI-compatible Base URL"
            mono
            required
            hint="Trailing /chat/completions is automatically removed."
            error={submitted ? errors.baseURL : undefined}
          >
            <input
              className="input input--mono"
              value={draft.baseURL}
              placeholder="https://chat.intern-ai.org.cn/api/v1"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  baseURL: value,
                }));
              }}
              onBlur={() =>
                setDraft((current) => ({
                  ...current,
                  baseURL: normalizeBaseURL(current.baseURL),
                }))
              }
            />
          </Field>

          {/* API Key field */}
          <Field
            label="API Secret Key"
            mono
            hint="Key is staged securely and verified against the endpoint before persisting."
            error={submitted ? errors.key : undefined}
          >
            <div className="add-provider-key-wrap">
              <input
                className="input input--mono"
                type={showKeyPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={4096}
                value={draft.key}
                placeholder="sk-… (paste secret key)"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, key: value }));
                }}
              />
              <button
                type="button"
                className="add-provider-key-toggle"
                aria-label={showKeyPassword ? "Hide secret key" : "Reveal secret key"}
                onClick={() => setShowKeyPassword((v) => !v)}
                title={showKeyPassword ? "Hide secret" : "Reveal secret"}
              >
                <Icon name={showKeyPassword ? "lock" : "spark"} size={12} />
              </button>
            </div>
          </Field>

          {/* Advanced Accordion for Key Name and Timeout */}
          <div className="add-provider-advanced">
            <button
              type="button"
              className="add-provider-advanced__toggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <Icon name={showAdvanced ? "chevron-up" : "chevron-down"} size={12} />
              <span>{showAdvanced ? "Hide Advanced Settings" : "Show Advanced (Environment Key Name & Timeout)"}</span>
            </button>

            {showAdvanced && (
              <div className="field-row mt-2">
                <Field
                  label="Environment Key Variable"
                  mono
                  hint="Stored in host keys.json and injected into agent runtime."
                  error={submitted ? errors.keyName : undefined}
                >
                  <input
                    className="input input--mono"
                    maxLength={64}
                    value={draft.keyName || deriveKeyName(draft.name)}
                    placeholder="e.g. INTERN_API_KEY"
                    onChange={(event) => {
                      const value = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
                      setDraft((current) => ({
                        ...current,
                        keyName: value,
                      }));
                    }}
                  />
                </Field>

                <Field label="Request Timeout (ms)" error={submitted ? errors.timeoutMs : undefined}>
                  <input
                    className="input input--mono"
                    inputMode="numeric"
                    value={draft.timeoutMs}
                    onChange={(event) => {
                      const value = event.currentTarget.value.replace(/[^\d]/g, "");
                      setDraft((current) => ({
                        ...current,
                        timeoutMs: value,
                      }));
                    }}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Live Test Status Banner */}
          {testResult && (
            <div
              className={`add-provider-test-result ${testResult.ok ? "add-provider-test-result--ok" : "add-provider-test-result--fail"}`}
              role="status"
            >
              <div className="add-provider-test-result__icon">
                <Icon name={testResult.ok ? "check-circle" : "alert"} size={14} />
              </div>
              <div className="add-provider-test-result__body">
                {testResult.ok ? (
                  <div>
                    <strong>Connection Verified:</strong> Endpoint responded with HTTP {testResult.statusCode ?? 200}{" "}
                    in <span className="mono">{testResult.latencyMs ?? "—"}ms</span>.
                  </div>
                ) : (
                  <div>
                    <strong>Verification Failed:</strong> {testResult.error || "Endpoint did not return an HTTP 200 OK."}
                  </div>
                )}
              </div>
            </div>
          )}

          {submitted && !valid && (
            <div className="error-inline" role="alert">
              <Icon name="alert" size={13} />
              <span>Please resolve the highlighted fields before adding this provider.</span>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
