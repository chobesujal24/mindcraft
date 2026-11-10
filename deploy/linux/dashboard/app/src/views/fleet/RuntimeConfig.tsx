import { useEffect, useMemo, useState } from "react";
import type { ConfigResponse } from "../../data/types";
import { actions, useDashboard } from "../../state/store";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Panel } from "../../ui/Panel";
import { Toggle } from "../../ui/Toggle";
import { Icon } from "../../ui/icons";
import { PendingInline } from "../shared";

// The agent runtime ships with minecraft-data for 26.1 (protocol 775). This is
// used only for advisory copy; update it when the agent's protocol package does.
const BUNDLED_CLIENT_VERSION = "26.1";

type Draft = {
  host: string;
  port: string;
  version: string;
  auth: string;
  baseProfile: string;
  onlyChat: string;
  loadMemory: boolean;
  narrate: boolean;
  allowCoding: boolean;
  codeTimeout: string;
  spawnTimeout: string;
  autoOpen: boolean;
  viaProxyEnabled: boolean;
  viaProxyHost: string;
  viaProxyPort: string;
  viaProxyClientVersion: string;
};

function textOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function boolOf(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function fromConfig(config: ConfigResponse | null): Draft {
  const settings = config?.settings ?? {};
  const viaProxy = settings.via_proxy && typeof settings.via_proxy === "object" && !Array.isArray(settings.via_proxy)
    ? settings.via_proxy as Record<string, unknown>
    : {};
  return {
    host: textOf(settings.host, config?.effective?.host ?? "127.0.0.1"),
    port: textOf(settings.port, String(config?.effective?.port ?? 56730)),
    version: textOf(settings.minecraft_version, config?.effective?.version ?? "26.1"),
    auth: textOf(settings.auth, config?.effective?.auth ?? "offline"),
    baseProfile: textOf(settings.base_profile, "assistant"),
    onlyChat: Array.isArray(settings.only_chat_with) ? settings.only_chat_with.join(", ") : "",
    loadMemory: boolOf(settings.load_memory),
    narrate: boolOf(settings.narrate_behavior, true),
    allowCoding: boolOf(settings.allow_insecure_coding),
    codeTimeout: textOf(settings.code_timeout_mins, "10"),
    spawnTimeout: textOf(settings.spawn_timeout, "60"),
    autoOpen: boolOf(settings.auto_open_ui, true),
    viaProxyEnabled: boolOf(viaProxy.enabled),
    viaProxyHost: textOf(viaProxy.host, "127.0.0.1"),
    viaProxyPort: textOf(viaProxy.port, "25568"),
    viaProxyClientVersion: textOf(viaProxy.client_version, "26.1"),
  };
}

function buildPatch(draft: Draft, server: Draft): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (draft.host !== server.host) patch.host = draft.host.trim();
  if (draft.port !== server.port) patch.port = Number(draft.port);
  if (draft.version !== server.version) patch.minecraft_version = draft.version.trim();
  if (draft.auth !== server.auth) patch.auth = draft.auth;
  if (draft.baseProfile !== server.baseProfile) patch.base_profile = draft.baseProfile.trim();
  if (draft.onlyChat !== server.onlyChat) {
    patch.only_chat_with = draft.onlyChat
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }
  if (draft.loadMemory !== server.loadMemory) patch.load_memory = draft.loadMemory;
  if (draft.narrate !== server.narrate) patch.narrate_behavior = draft.narrate;
  if (draft.allowCoding !== server.allowCoding) patch.allow_insecure_coding = draft.allowCoding;
  if (draft.codeTimeout !== server.codeTimeout) patch.code_timeout_mins = Number(draft.codeTimeout);
  if (draft.spawnTimeout !== server.spawnTimeout) patch.spawn_timeout = Number(draft.spawnTimeout);
  if (draft.autoOpen !== server.autoOpen) patch.auto_open_ui = draft.autoOpen;
  if (
    draft.viaProxyEnabled !== server.viaProxyEnabled ||
    draft.viaProxyHost !== server.viaProxyHost ||
    draft.viaProxyPort !== server.viaProxyPort ||
    draft.viaProxyClientVersion !== server.viaProxyClientVersion
  ) {
    patch.via_proxy = {
      enabled: draft.viaProxyEnabled,
      host: draft.viaProxyHost.trim(),
      port: Number(draft.viaProxyPort),
      client_version: draft.viaProxyClientVersion.trim(),
    };
  }
  return patch;
}

export function RuntimeConfig() {
  const config = useDashboard((state) => state.config);
  const pending = useDashboard((state) => state.pendingByAction);
  const server = useMemo(() => fromConfig(config), [config]);
  const [draft, setDraft] = useState<Draft>(server);
  const [dirty, setDirty] = useState(false);
  const serverKey = JSON.stringify(server);

  useEffect(() => {
    if (!dirty) setDraft(server);
    // The server key is the sync trigger; dirty is intentionally read fresh so a
    // poll never overwrites local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);
  const patch = useMemo(() => buildPatch(draft, server), [draft, server]);
  const portValid = Number.isInteger(Number(draft.port)) && Number(draft.port) > 0 && Number(draft.port) < 65_536;
  const viaProxyPortValid = Number.isInteger(Number(draft.viaProxyPort)) && Number(draft.viaProxyPort) > 0 && Number(draft.viaProxyPort) < 65_536;
  const timeoutValid = Number(draft.codeTimeout) >= 1 && Number(draft.codeTimeout) <= 120;
  const spawnValid = Number(draft.spawnTimeout) >= 10 && Number(draft.spawnTimeout) <= 600;
  const viaProxyValid = !draft.viaProxyEnabled || (viaProxyPortValid && Boolean(draft.viaProxyHost.trim()) && Boolean(draft.viaProxyClientVersion.trim()));
  const valid = portValid && timeoutValid && spawnValid && viaProxyValid && Boolean(draft.host.trim()) && Boolean(draft.version.trim());
  const savePending = pending["config:save"]?.status === "pending";
  const restartPending = pending["config:restart"]?.status === "pending";

  const saved: Record<string, unknown> = config?.settings ?? {};
  const effective: ConfigResponse["effective"] = config?.effective ?? {};
  const overrides = effective.overrides ?? {};
  const truth = [
    { key: "host", label: "Host", saved: textOf(saved.host, "—"), live: textOf(effective.host, "—"), override: overrides.host === "env" },
    { key: "port", label: "Port", saved: textOf(saved.port, "—"), live: textOf(effective.port, "—"), override: overrides.port === "env" },
    { key: "version", label: "Version", saved: textOf(saved.minecraft_version, "—"), live: textOf(effective.version, "—"), override: overrides.version === "env" },
    { key: "auth", label: "Auth", saved: textOf(saved.auth, "—"), live: textOf(effective.auth, "—"), override: overrides.auth === "env" },
  ];
  const hasEnvOverride = Object.keys(overrides).length > 0;
  const drift = truth.some((row) => row.override || (row.live !== "—" && row.saved !== row.live));
  const truthTone = hasEnvOverride || drift ? "warn" : "ok";
  const savedVersion = textOf(saved.minecraft_version, textOf(effective.version, "—"));
  const liveVersion = textOf(effective.version, "—");
  const draftVersion = draft.version.trim();
  const directVersionUnsupported = !draft.viaProxyEnabled && draftVersion !== BUNDLED_CLIENT_VERSION;
  const bridgeVersionMismatch = draft.viaProxyEnabled && draftVersion !== draft.viaProxyClientVersion.trim();
  const versionNote = (() => {
    if (savedVersion !== liveVersion) {
      return {
        tone: "warn" as const,
        title: `Saved target ${savedVersion} is not the live version`,
        body: `The running process is using ${liveVersion}. ${
          overrides.version === "env"
            ? "MC_VERSION in mc-cluster.env overrides settings.js."
            : "Restart the foreman to apply the saved value."
        } The bundled client protocol data supports ${BUNDLED_CLIENT_VERSION} (protocol 775); a ${savedVersion} target (protocol 777) needs ViaProxy translation or a newer minecraft-data build.`,
      };
    }
    if (bridgeVersionMismatch) {
      return {
        tone: "warn" as const,
        title: "ViaProxy translation required",
        body: `Target ${draftVersion} is bridged to client ${draft.viaProxyClientVersion.trim()}. Keep ViaProxy running and pointed at the same target, or the handshake will fail before ENI1 joins.`,
      };
    }
    if (directVersionUnsupported) {
      return {
        tone: "danger" as const,
        title: `Direct connection to ${draftVersion} is unsupported`,
        body: `The bundled client protocol data is pinned to ${BUNDLED_CLIENT_VERSION} (protocol 775). A direct ${draftVersion} connection (protocol 777) will fail; enable the ViaProxy bridge or install a compatible minecraft-data build.`,
      };
    }
    return null;
  })();

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDirty(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const reset = () => {
    setDraft(server);
    setDirty(false);
  };

  const save = async () => {
    if (!valid || !dirty) return;
    const ok = await actions.saveConfig({ settings: patch, restart: false }, "config:save", "Configuration saved");
    if (ok) setDirty(false);
  };

  const saveAndRestart = async () => {
    if (!valid || !dirty) return;
    const confirmed = await actions.requestConfirm({
      eyebrow: "Runtime configuration",
      title: "Save and restart ENI1?",
      description:
        "Settings are written to disk, then mc-foreman restarts with the new configuration. ENI1 reconnects after the foreman is back.",
      confirmLabel: "Save & restart ENI1",
      danger: true,
    });
    if (!confirmed) return;
    const ok = await actions.saveConfig(
      { settings: patch, restart: "eni" },
      "config:restart",
      "Configuration saved and ENI1 restarted",
    );
    if (ok) setDirty(false);
  };

  return (
    <section className="runtime-panel" aria-label="Runtime configuration">
      <Panel
        eyebrow="Runtime"
        title="Cluster configuration"
        sub="Three operator planes. Changes stay local until you save; restart only bounces the affected services."
        tools={
          <span className="dirty-chip">
            {dirty ? <Chip tone="warn" dot>Unsaved changes</Chip> : <Chip tone="ok">Synced</Chip>}
            <PendingInline entry={pending["config:save"] ?? pending["config:restart"]} compact />
          </span>
        }
        flush
        footer={
          <div className="config-actions">
            <span className="config-actions__status">
              <Icon name={dirty ? "alert" : "check"} size={11} />
              {dirty
                ? `${Object.keys(patch).length} field${Object.keys(patch).length === 1 ? "" : "s"} pending`
                : hasEnvOverride
                  ? "Saved values differ from the live process"
                  : "Saved values match the live process"}
            </span>
            <div className="config-actions__buttons">
              <Button size="sm" variant="quiet" onClick={reset} disabled={!dirty}>
                Reset
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void save()}
                loading={savePending}
                loadingLabel="Saving"
                disabled={!dirty || !valid || restartPending}
                disabledReason={!valid ? "Fix the highlighted fields first." : "No changes to save."}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void saveAndRestart()}
                loading={restartPending}
                loadingLabel="Restarting"
                disabled={!dirty || !valid || savePending}
                disabledReason={!valid ? "Fix the highlighted fields first." : "No changes to save."}
              >
                Save &amp; restart ENI1
              </Button>
            </div>
          </div>
        }
      >
        <div className="config-truth" data-tone={truthTone}>
          <div className="config-truth__head">
            <div>
              <span className="eyebrow">Saved vs running</span>
              <strong>
                {hasEnvOverride
                  ? "The service environment is overriding saved settings"
                  : drift
                    ? "Saved settings differ from the live process"
                    : "Saved settings match the live process"}
              </strong>
            </div>
            <Chip tone={truthTone} dot>
              {hasEnvOverride ? "Env override" : drift ? "Restart pending" : "In sync"}
            </Chip>
          </div>
          <div className="config-truth__grid">
            {truth.map((row) => (
              <div className="config-truth__row" key={row.key}>
                <span className="config-truth__label">{row.label}</span>
                <span className="config-truth__saved" title={row.saved}>{row.saved}</span>
                <Icon name="chevron-right" size={10} />
                <span className="config-truth__live" title={row.live}>
                  {row.live}
                  {row.override && <em>ENV</em>}
                </span>
              </div>
            ))}
          </div>
          <p className="config-truth__legend">
            Saved values come from settings.js. Live values come from the service environment; mc-cluster.env wins.
          </p>
        </div>

        {versionNote && (
          <div className={`config-warning config-warning--${versionNote.tone}`} role="status">
            <Icon name="alert" size={13} />
            <div>
              <strong>{versionNote.title}</strong>
              <span>{versionNote.body}</span>
            </div>
          </div>
        )}

        <div className="config-grid">
          <div className="config-col">
            <div className="config-col__head">
              <span className="config-col__title">Network</span>
              <Chip tone="neutral">Server</Chip>
            </div>
            <div className="config-col__fields">
              <Field
                label={draft.viaProxyEnabled ? "Target server host" : "Host"}
                hint={draft.viaProxyEnabled ? "Keep this in sync with target-address in ViaProxy's viaproxy.yml." : "Minecraft server address"}
              >
                <input className="input input--mono" value={draft.host} onChange={(event) => update("host", event.currentTarget.value)} />
              </Field>
              <Field
                label={draft.viaProxyEnabled ? "Target server port" : "Port"}
                error={portValid ? undefined : "Use a port from 1 to 65535"}
                hint={draft.viaProxyEnabled ? "Keep this in sync with target-address in ViaProxy's viaproxy.yml." : undefined}
              >
                <input
                  className="input input--mono"
                  inputMode="numeric"
                  value={draft.port}
                  onChange={(event) => update("port", event.currentTarget.value.replace(/[^\d]/g, ""))}
                />
              </Field>
              <Field
                label={draft.viaProxyEnabled ? "Target server version" : "Minecraft version"}
                hint={draft.viaProxyEnabled ? "Set this same target-version in ViaProxy's viaproxy.yml." : undefined}
              >
                <input className="input input--mono" value={draft.version} onChange={(event) => update("version", event.currentTarget.value)} />
              </Field>
              <Field
                label="Authentication"
                hint={draft.viaProxyEnabled ? "ViaProxy authenticates to the target; the bot connects to it in offline client mode." : undefined}
              >
                <select className="select" value={draft.auth} disabled={draft.viaProxyEnabled} onChange={(event) => update("auth", event.currentTarget.value)}>
                  <option value="offline">offline</option>
                  <option value="microsoft">microsoft</option>
                </select>
              </Field>
              <Field label="ViaProxy bridge" hint="Off by default. Only enable after starting and configuring ViaProxy.">
                <Toggle
                  label="Connect through ViaProxy"
                  checked={draft.viaProxyEnabled}
                  onChange={(value) => update("viaProxyEnabled", value)}
                  stateLabels={["Direct", "ViaProxy"]}
                />
              </Field>
              {draft.viaProxyEnabled && (
                <>
                  <Field label="ViaProxy host" hint="Host reachable from the Mindcraft process">
                    <input className="input input--mono" value={draft.viaProxyHost} onChange={(event) => update("viaProxyHost", event.currentTarget.value)} />
                  </Field>
                  <Field label="ViaProxy port" error={viaProxyPortValid ? undefined : "Use a port from 1 to 65535"}>
                    <input
                      className="input input--mono"
                      inputMode="numeric"
                      value={draft.viaProxyPort}
                      onChange={(event) => update("viaProxyPort", event.currentTarget.value.replace(/[^\d]/g, ""))}
                    />
                  </Field>
                  <Field label="Bot client version" hint="Use a protocol supported by this Mindcraft install; 26.1 is the configured default.">
                    <input className="input input--mono" value={draft.viaProxyClientVersion} onChange={(event) => update("viaProxyClientVersion", event.currentTarget.value)} />
                  </Field>
                  <p className="config-note">
                    ViaProxy must already be running and pointed at the target above. For online-mode servers, configure the Microsoft account in ViaProxy; these credentials are not sent by Mindcraft in bridge mode.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="config-col">
            <div className="config-col__head">
              <span className="config-col__title">Agent</span>
              <Chip tone="accent">ENI1</Chip>
            </div>
            <div className="config-col__fields">
              <Field label="Base profile">
                <input
                  className="input input--mono"
                  value={draft.baseProfile}
                  onChange={(event) => update("baseProfile", event.currentTarget.value)}
                />
              </Field>
              <Field label="Chat allow-list" hint="Comma-separated player names">
                <input
                  className="input input--mono"
                  value={draft.onlyChat}
                  placeholder="sujal24, 52hx, ADMIN"
                  onChange={(event) => update("onlyChat", event.currentTarget.value)}
                />
              </Field>
              <div className="field">
                <span className="field__label">Load memory</span>
                <Toggle
                  label="Load memory at boot"
                  checked={draft.loadMemory}
                  onChange={(value) => update("loadMemory", value)}
                  stateLabels={["Off", "On"]}
                />
              </div>
              <div className="field">
                <span className="field__label">Narrate behaviour</span>
                <Toggle
                  label="Narrate behaviour in chat"
                  checked={draft.narrate}
                  onChange={(value) => update("narrate", value)}
                  stateLabels={["Off", "On"]}
                />
              </div>
            </div>
          </div>

          <div className="config-col">
            <div className="config-col__head">
              <span className="config-col__title">Safety</span>
              <Chip tone={draft.allowCoding ? "warn" : "ok"}>{draft.allowCoding ? "Elevated" : "Guarded"}</Chip>
            </div>
            <div className="config-col__fields">
              <div className="field">
                <span className="field__label">Insecure coding</span>
                <Toggle
                  label="Allow insecure coding"
                  checked={draft.allowCoding}
                  onChange={(value) => update("allowCoding", value)}
                  stateLabels={["Guarded", "Elevated"]}
                />
              </div>
              <Field label="Code timeout (minutes)" error={timeoutValid ? undefined : "1–120 minutes"}>
                <input
                  className="input input--mono"
                  inputMode="numeric"
                  value={draft.codeTimeout}
                  onChange={(event) => update("codeTimeout", event.currentTarget.value.replace(/[^\d]/g, ""))}
                />
              </Field>
              <Field label="Spawn timeout (seconds)" error={spawnValid ? undefined : "10–600 seconds"}>
                <input
                  className="input input--mono"
                  inputMode="numeric"
                  value={draft.spawnTimeout}
                  onChange={(event) => update("spawnTimeout", event.currentTarget.value.replace(/[^\d]/g, ""))}
                />
              </Field>
              <div className="field">
                <span className="field__label">Open dashboard at spawn</span>
                <Toggle
                  label="Open dashboard automatically"
                  checked={draft.autoOpen}
                  onChange={(value) => update("autoOpen", value)}
                  stateLabels={["Manual", "Auto"]}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
