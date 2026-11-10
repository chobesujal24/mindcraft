import { useEffect, useRef, useState } from "react";
import type { Provider, ProviderTest } from "../../data/types";
import { actions, useDashboard } from "../../state/store";
import { milliseconds, number } from "../../utils/format";
import { Button, IconButton } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/icons";
import { Progress } from "../../ui/Progress";
import { Toggle } from "../../ui/Toggle";
import { detectProviderType, ProviderLogo } from "./ProviderLogo";

type Props = {
  provider: Provider;
  index: number;
  total: number;
  draftKey: string;
  clearKey: boolean;
  reorderDisabled: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onPatch: (patch: Partial<Provider>) => void;
  onKeyChange: (value: string) => void;
  onClearKey: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
};

export function ProviderRow({
  provider,
  index,
  total,
  draftKey,
  clearKey,
  reorderDisabled,
  dragging,
  dropTarget,
  onPatch,
  onKeyChange,
  onClearKey,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTest | null>(null);
  const [removing, setRemoving] = useState(false);
  const [inlineKeyInput, setInlineKeyInput] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  const pending = useDashboard((state) => state.pendingByAction[`provider:test:${provider.id}`]);
  const testing = pending?.status === "pending";

  const contextPct =
    typeof provider.contextWindow === "number" && provider.contextWindow > 0 && typeof provider.contextUsed === "number"
      ? Math.min(100, Math.round((provider.contextUsed / provider.contextWindow) * 100))
      : null;

  const providerType = detectProviderType(provider.name, provider.baseURL, provider.model);
  const hasKey = provider.keyConfigured || Boolean(draftKey);
  const isPrimary = index === 0 && provider.enabled;

  const test = async () => {
    setTestResult(null);
    const keyToTest = draftKey || "";
    const result = await actions.testProvider(provider, keyToTest);
    setTestResult(result);
    if (result?.ok) {
      actions.notify(`${provider.name} answered`, `${result.statusCode ?? 200} · ${result.latencyMs ?? "—"} ms`, "ok");
    }
  };

  const remove = async () => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Provider routing table",
      title: `Remove ${provider.name}?`,
      description: "The provider is removed from the local order. Nothing is written until you save and restart.",
      confirmLabel: "Remove provider",
      danger: true,
    });
    if (!confirmed) return;
    setRemoving(true);
    onRemove();
  };

  const copyUrl = async () => {
    if (!provider.baseURL) return;
    try {
      await navigator.clipboard.writeText(provider.baseURL);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
      actions.notify("Endpoint copied", provider.baseURL, "ok");
    } catch {
      // fallback
    }
  };

  const handleApplyInlineKey = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inlineKeyInput.trim()) return;
    onKeyChange(inlineKeyInput.trim());
    setInlineKeyInput("");
    actions.notify("Key Staged", `API key staged for ${provider.name}. Click 'Save & restart' to commit.`, "ok");
  };

  return (
    <article
      className="provider-row"
      draggable={!reorderDisabled}
      data-dragging={dragging || undefined}
      data-drop={dropTarget || undefined}
      data-primary={isPrimary || undefined}
      data-bypassed={!provider.enabled || undefined}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      aria-label={`${provider.name}, priority #${index + 1}`}
    >
      {/* 1. Drag handle & Priority Badge */}
      <div className="provider-handle">
        <button
          type="button"
          className="provider-grip"
          aria-label={`Drag to reorder ${provider.name}`}
          disabled={reorderDisabled}
          title={reorderDisabled ? "Clear filters to reorder routes" : "Drag up or down to change priority routing order"}
        >
          <Icon name="grip" size={13} />
        </button>
        <div className="provider-order-stack">
          <span className="provider-order-pill" data-primary={isPrimary || undefined}>
            {isPrimary ? "P1" : `P${index + 1}`}
          </span>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="provider-main">
        {/* Top Header Row: Logo, Name, Tier, Status Pills, & Toggle Switch */}
        <div className="provider-header-row">
          <div className="provider-brand">
            <div className="provider-brand__logo">
              <ProviderLogo type={providerType} size={24} />
            </div>
            <div className="provider-brand__info">
              <div className="provider-title-line">
                <span className="provider-name">{provider.name}</span>
                <span className="provider-role-badge" data-primary={isPrimary || undefined}>
                  {isPrimary ? "Primary Route" : index === 0 ? "Primary · bypassed" : `Fallback ${index}`}
                </span>
              </div>
            </div>
          </div>

          <div className="provider-header-status">
            <Chip tone={provider.enabled ? "ok" : "neutral"} dot size="sm">
              {provider.enabled ? "Active" : "Bypassed"}
            </Chip>

            {draftKey ? (
              <Chip tone="accent" dot size="sm">Key staged</Chip>
            ) : provider.keyConfigured ? (
              <Chip tone="ok" dot size="sm">
                Key ready
              </Chip>
            ) : (
              <Chip tone="warn" dot size="sm">Key missing</Chip>
            )}

            <div className="provider-toggle-wrap">
              <Toggle
                label={`${provider.name} routing`}
                checked={provider.enabled}
                onChange={(enabled) => onPatch({ enabled })}
                stateLabels={["Bypassed", "Active"]}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Meta Bar: Model Tag + URL Copy Pill + Timeout */}
        <div className="provider-meta-row">
          <div className="provider-model-tag">
            <Icon name="cpu" size={12} />
            <span className="provider-model-name">{provider.model || "Default Model"}</span>
            <span className="provider-model-sep">·</span>
            <span className="provider-timeout">{provider.timeoutMs} ms timeout</span>
          </div>

          <button
            type="button"
            className="provider-url-pill"
            onClick={() => void copyUrl()}
            title="Click to copy endpoint URL to clipboard"
          >
            <span className="provider-url-text">{provider.baseURL}</span>
            <Icon name={copied ? "check" : "copy"} size={11} className="provider-url-copy" />
          </button>
        </div>

        {/* Instant Inline Key Setup (Solves user frustration when key is missing) */}
        {!hasKey && !editing && (
          <form className="provider-inline-key-strip" onSubmit={handleApplyInlineKey}>
            <div className="provider-inline-key-label">
              <Icon name="key" size={12} />
              <span>Needs key for <strong className="mono">{provider.keyName}</strong>:</span>
            </div>
            <input
              type="password"
              className="input input--mono provider-inline-key-input"
              placeholder="Paste API key here (sk-…)"
              value={inlineKeyInput}
              onChange={(e) => setInlineKeyInput(e.currentTarget.value)}
            />
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!inlineKeyInput.trim()}
              leading={<Icon name="check" size={11} />}
            >
              Stage Key
            </Button>
          </form>
        )}

        {/* 4-Quadrant Metric Well */}
        <div className="provider-metrics">
          <div className="provider-metric">
            <div className="provider-metric__label">P95 Latency</div>
            <div className="provider-metric__value">
              {typeof testResult?.latencyMs === "number"
                ? milliseconds(testResult.latencyMs)
                : milliseconds(provider.lastLatencyMs)}
            </div>
          </div>

          <div className="provider-metric">
            <div className="provider-metric__label">Throughput</div>
            <div className="provider-metric__value">
              {provider.tokensPerSec ? `${number(provider.tokensPerSec)} tok/s` : "—"}
            </div>
          </div>

          <div className="provider-metric">
            <div className="provider-metric__label">Context Window</div>
            <div className="provider-metric__value">
              {contextPct === null ? "—" : `${contextPct}%`}
              {provider.contextWindow ? <span className="mute"> ({number(provider.contextWindow)})</span> : null}
            </div>
            {contextPct !== null && (
              <div className="provider-context">
                <Progress value={contextPct} max={100} label={`${provider.name} context usage`} tone={contextPct > 85 ? "warn" : "accent"} />
              </div>
            )}
          </div>

          <div className="provider-metric provider-metric--status">
            <div className="provider-metric__label">Endpoint Health</div>
            <div className="provider-test" data-tone={testResult ? (testResult.ok ? "ok" : "danger") : undefined}>
              {testing ? (
                <span className="provider-test-probing">
                  <span className="spin">
                    <Icon name="rotate" size={11} />
                  </span>
                  Probing…
                </span>
              ) : testResult ? (
                testResult.ok ? (
                  <span className="provider-test-ok">
                    <Icon name="check-circle" size={11} /> {testResult.statusCode ?? 200} OK
                    {typeof testResult.latencyMs === "number" ? ` (${testResult.latencyMs} ms)` : ""}
                  </span>
                ) : (
                  <span className="provider-test-fail">
                    <Icon name="alert" size={11} /> {testResult.error || "Probe failed"}
                  </span>
                )
              ) : (
                <span className="provider-test-ready">Not yet probed</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Configuration Drawer */}
        {editing && (
          <div className="provider-form mt-3">
            <div className="field-row">
              <Field label="Display Name">
                <input
                  className="input"
                  maxLength={80}
                  value={provider.name}
                  onChange={(event) => onPatch({ name: event.currentTarget.value })}
                />
              </Field>
              <Field label="Env Key Name" mono hint="Variable name stored on Linux host">
                <input
                  className="input input--mono"
                  maxLength={64}
                  value={provider.keyName}
                  onChange={(event) =>
                    onPatch({ keyName: event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })
                  }
                />
              </Field>
            </div>
            <div className="field-row">
              <Field label="OpenAI-compatible Base URL" mono>
                <input
                  className="input input--mono"
                  value={provider.baseURL}
                  onChange={(event) => onPatch({ baseURL: event.currentTarget.value })}
                  onBlur={(event) =>
                    onPatch({
                      baseURL: event.currentTarget.value
                        .trim()
                        .replace(/\/+$/, "")
                        .replace(/\/chat\/completions\/?$/i, "")
                        .replace(/\/completions\/?$/i, ""),
                    })
                  }
                />
              </Field>
              <Field label="Model Identifier" mono>
                <input className="input input--mono" value={provider.model} onChange={(event) => onPatch({ model: event.currentTarget.value })} />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Timeout (ms)">
                <input
                  className="input input--mono"
                  inputMode="numeric"
                  value={String(provider.timeoutMs)}
                  onChange={(event) =>
                    onPatch({
                      timeoutMs: Math.min(120_000, Number(event.currentTarget.value.replace(/[^\d]/g, "")) || 0),
                    })
                  }
                  onBlur={() => {
                    if (provider.timeoutMs < 1_000) onPatch({ timeoutMs: 1_000 });
                  }}
                />
              </Field>
              <Field label="API Secret Key" mono hint={provider.keyConfigured ? "Key is set on server. Enter new value to replace." : "Paste provider secret"}>
                <input
                  type="password"
                  className="input input--mono"
                  maxLength={4096}
                  placeholder={provider.keyConfigured ? "••••••••••••••••" : "Paste API key"}
                  value={draftKey}
                  onChange={(e) => onKeyChange(e.currentTarget.value)}
                />
              </Field>
            </div>

            <div className="row mt-2" style={{ justifyContent: "space-between" }}>
              <div className="row" style={{ gap: 6 }}>
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Close Settings
                </Button>
                {(provider.keyConfigured || clearKey) && (
                  <Button size="sm" variant={clearKey ? "secondary" : "danger"} onClick={onClearKey}>
                    {clearKey ? "Undo clear key" : "Clear saved key"}
                  </Button>
                )}
              </div>
              <span className="mono mute" style={{ fontSize: "10px" }}>Changes take effect on Save & Restart.</span>
            </div>
          </div>
        )}

        {/* Failed Test Diagnostic Notice */}
        {testResult && !testResult.ok && (
          <div className="provider-alert-box" role="alert">
            <div className="provider-alert-box__content">
              <Icon name="alert" size={13} />
              <span>{testResult.error || "The provider endpoint did not return an HTTP 200 response."}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {!hasKey && (
                <Button size="xs" variant="secondary" onClick={() => setEditing(true)}>
                  Set API Key
                </Button>
              )}
              <Button size="xs" variant="quiet" onClick={() => void test()} loading={testing}>
                Retry Probe
              </Button>
            </div>
          </div>
        )}

        {/* Card Footer Toolbar */}
        <div className="provider-card-footer">
          <div className="provider-card-footer__left">
            <span className="provider-priority-meta">
              Priority #{String(index + 1).padStart(2, "0")} · {provider.enabled ? "Active in fallback chain" : "Bypassed by router"}
            </span>
          </div>

          <div className="provider-card-footer__actions">
            <Button
              size="xs"
              variant="secondary"
              leading={<Icon name="zap" size={12} />}
              onClick={() => void test()}
              loading={testing}
            >
              Test Route
            </Button>

            <Button
              size="xs"
              variant={editing ? "primary" : "secondary"}
              leading={<Icon name="settings" size={12} />}
              onClick={() => setEditing((c) => !c)}
            >
              {editing ? "Done" : "Configure"}
            </Button>

            <div className="provider-reorder-group">
              <IconButton
                size="xs"
                label={`Move ${provider.name} up in priority`}
                onClick={() => onMove(-1)}
                disabled={reorderDisabled || index === 0}
              >
                <Icon name="chevron-up" size={12} />
              </IconButton>
              <IconButton
                size="xs"
                label={`Move ${provider.name} down in priority`}
                onClick={() => onMove(1)}
                disabled={reorderDisabled || index === total - 1}
              >
                <Icon name="chevron-down" size={12} />
              </IconButton>
            </div>

            <IconButton
              size="xs"
              label={`Remove ${provider.name}`}
              onClick={() => void remove()}
              disabled={removing}
              tone="danger"
            >
              <Icon name="trash" size={12} />
            </IconButton>
          </div>
        </div>
      </div>
    </article>
  );
}
