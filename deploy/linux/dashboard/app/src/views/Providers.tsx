import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Copy, Cpu, Pencil, Plus, Search, X, Zap } from "lucide-react";
import type { Provider } from "../data/model";
import { useConsole } from "../state/store";
import { Button, EmptyState, Field, IconButton, Metric, Panel, Switch, TextInput } from "../ui/kit";
import { Dialog } from "../ui/overlay";
import { cn } from "../utils/cn";

/** `POST /api/providers` accepts at most 20 routes. */
const MAX_PROVIDERS = 20;
const KEY_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

/* ── KPIs ──────────────────────────────────────────────── */

function ProviderKPIs() {
  const providers = useConsole((s) => s.providers);
  const enabled = providers.filter((p) => p.enabled);
  const configured = providers.filter((p) => p.keyConfigured);
  const latencies = providers.map((p) => p.latencyMs).filter((v): v is number => v !== null);
  const average = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const modelCounts = providers.map((p) => p.modelCount).filter((v): v is number => v !== null);
  const models = modelCounts.length > 0 ? modelCounts.reduce((a, b) => a + b, 0) : null;
  const missing = providers.filter((p) => !p.keyConfigured);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric
        className="panel p-4 lg:p-5"
        label="Providers enabled"
        value={enabled.length}
        unit={`of ${providers.length}`}
        hint={enabled.length === 0 ? "agents cannot think" : `first choice: ${enabled[0].name}`}
        tone={enabled.length === 0 ? "danger" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Keys configured"
        value={configured.length}
        unit={`of ${providers.length}`}
        hint={missing.length === 0 ? "every route has a stored key" : `missing: ${missing.map((p) => p.keyName).join(", ")}`}
        tone={missing.length > 0 ? "warn" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Average handshake"
        value={average ?? "—"}
        unit={average === null ? undefined : "ms"}
        hint={latencies.length === 0 ? "run a test to measure" : `${latencies.length} endpoint${latencies.length === 1 ? "" : "s"} tested this session`}
        tone={average !== null && average > 500 ? "warn" : "default"}
      />
      <Metric
        className="panel p-4 lg:p-5"
        label="Models reachable"
        value={models ?? "—"}
        hint={models === null ? "tests report the model count" : `summed across ${modelCounts.length} tested endpoint${modelCounts.length === 1 ? "" : "s"}`}
      />
    </div>
  );
}

/* ── Row ───────────────────────────────────────────────── */

function monogram(name: string) {
  const letters = name.replace(/[^A-Za-z0-9]/g, " ").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function ProviderRow({ p, index, total, sortable, onEdit }: { p: Provider; index: number; total: number; sortable: boolean; onEdit: () => void }) {
  const toggle = useConsole((s) => s.providerToggle);
  const test = useConsole((s) => s.providerTest);
  const move = useConsole((s) => s.providerMove);
  const toast = useConsole((s) => s.toast);
  const testing = useConsole((s) => Boolean(s.pending[`provider:test:${p.id}`]));
  const busy = useConsole((s) => Boolean(s.pending["providers:save"]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.baseURL);
      toast({ title: "Endpoint copied", detail: p.baseURL, tone: "ok" });
    } catch {
      toast({ title: "Clipboard is blocked", detail: p.baseURL, tone: "info" });
    }
  };

  const keyState = p.keyConfigured
    ? { text: `${p.keyName} set`, tone: "text-faint" }
    : { text: `${p.keyName} missing`, tone: "text-warn" };

  return (
    <motion.li
      layout="position"
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn("flex flex-col gap-3 px-3 py-3.5 sm:px-4 xl:flex-row xl:items-center xl:gap-4", !p.enabled && "bg-panel-2/20")}
    >
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-2.5 xl:flex-1">
        <div className="flex shrink-0 flex-col">
          <IconButton size="sm" icon={ArrowUp} label={`Move ${p.name} up`} className="h-[17px]" disabled={!sortable || busy || index === 0} onClick={() => move(p.id, -1)} />
          <IconButton size="sm" icon={ArrowDown} label={`Move ${p.name} down`} className="h-[17px]" disabled={!sortable || busy || index === total - 1} onClick={() => move(p.id, 1)} />
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px] border font-display text-[11px] font-semibold",
            p.enabled ? "border-line-2 bg-panel-2 text-mute" : "border-line text-faint",
          )}
        >
          {monogram(p.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="num text-[10.5px] text-faint">#{index + 1}</span>
            <span className={cn("truncate text-[13.5px] font-semibold", p.enabled ? "text-ink" : "text-mute")} title={p.name}>
              {p.name}
            </span>
          </p>
          <button
            type="button"
            onClick={copy}
            title={p.baseURL}
            className="group flex max-w-full items-center gap-1.5 rounded text-left font-mono text-[10.5px] text-faint transition-colors hover:text-mute"
          >
            <span className="truncate">{p.baseURL.replace(/^https?:\/\//, "")}</span>
            <Copy size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
          <p className={cn("mt-0.5 truncate font-mono text-[10px]", keyState.tone)}>{keyState.text}</p>
        </div>
        <div className="shrink-0 xl:hidden">
          <Switch checked={p.enabled} onChange={() => toggle(p.id)} label={`${p.name}, ${p.enabled ? "enabled" : "disabled"}`} />
        </div>
      </div>

      {/* Numbers */}
      <dl className="grid min-w-0 grid-cols-3 gap-3 xl:w-[286px] xl:shrink-0 xl:gap-4">
        <div className="min-w-0">
          <dt className="eyebrow !text-[10px]">Model</dt>
          <dd className="mt-0.5 truncate font-mono text-[11px] text-mute" title={p.model || "not reported"}>
            {p.model || "—"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Models</dt>
          <dd className="num mt-0.5 text-[12px] font-medium text-ink">{p.modelCount === null ? "—" : p.modelCount.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt className="eyebrow !text-[10px]">Latency</dt>
          <dd className={cn("num mt-0.5 text-[12px] font-medium", p.latencyMs === null ? "text-faint" : p.latencyMs > 500 ? "text-warn" : "text-ink")}>
            {p.latencyMs === null ? "—" : `${p.latencyMs} ms`}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 xl:contents">
        <p className="min-w-0 text-[10.5px] leading-snug text-faint xl:w-[146px] xl:shrink-0">
          {p.timeoutMs.toLocaleString("en-US")} ms timeout
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="quiet"
            icon={Zap}
            loading={testing}
            loadingLabel="Testing"
            disabled={!p.keyConfigured}
            disabledReason={`Add a value for ${p.keyName} first.`}
            onClick={() => test(p.id)}
          >
            <span className="sm:hidden">Test</span>
            <span className="max-sm:hidden">Test endpoint</span>
          </Button>
          <IconButton icon={Pencil} label={`Edit ${p.name}`} onClick={onEdit} />
          <span className="hidden xl:inline-flex">
            <Switch checked={p.enabled} onChange={() => toggle(p.id)} label={`${p.name}, ${p.enabled ? "enabled" : "disabled"}`} />
          </span>
        </div>
      </div>
    </motion.li>
  );
}

/* ── Add / edit dialog ─────────────────────────────────── */

function ProviderDialog({ provider, onClose }: { provider: Provider | null; onClose: () => void }) {
  const save = useConsole((s) => s.providerSave);
  const remove = useConsole((s) => s.providerRemove);
  const askConfirm = useConsole((s) => s.askConfirm);
  const [name, setName] = useState(provider?.name ?? "");
  const [baseURL, setBaseURL] = useState(provider?.baseURL ?? "");
  const [model, setModel] = useState(provider?.model ?? "");
  const [keyName, setKeyName] = useState(provider?.keyName ?? "");
  const [timeoutMs, setTimeoutMs] = useState(String(provider?.timeoutMs ?? 30_000));
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const errors = {
    name: name.trim() ? "" : "Give the provider a name.",
    baseURL: /^https?:\/\/\S+$/i.test(baseURL.trim()) ? "" : "Enter a full URL starting with http:// or https://.",
    keyName: KEY_NAME.test(keyName.trim())
      ? ""
      : "Use an uppercase key variable such as OPENAI_API_KEY.",
    model: model.trim() || provider?.id === "nvidia-1" ? "" : "Enter the model identifier.",
    timeoutMs:
      Number.isInteger(Number(timeoutMs)) && Number(timeoutMs) >= 1_000 && Number(timeoutMs) <= 120_000
        ? ""
        : "Between 1,000 and 120,000 ms.",
  };
  const valid = Object.values(errors).every((message) => !message);
  const shown = (key: keyof typeof errors) => (attempted && errors[key] ? errors[key] : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!valid) return;
    save(
      { id: provider?.id, name, baseURL, keyName, model, timeoutMs: Number(timeoutMs) },
      { apiKey: apiKey.trim() || undefined, clear: clearKey && !apiKey.trim() },
    );
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow="Provider routing"
      title={provider ? `Edit ${provider.name}` : "Add provider"}
      width="md"
      footer={
        <>
          {provider && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                onClose();
                askConfirm({
                  eyebrow: "Provider routing",
                  title: `Remove ${provider.name}?`,
                  description: "The route leaves the fallback chain and ENI1 restarts. Its stored key is not deleted.",
                  confirmLabel: "Remove provider",
                  danger: true,
                  action: () => remove(provider.id),
                });
              }}
            >
              Remove
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="provider-form">
            {provider ? "Save provider" : "Add provider"}
          </Button>
        </>
      }
    >
      <form id="provider-form" className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Display name" htmlFor="pv-name" error={shown("name")}>
          <TextInput id="pv-name" data-autofocus="" placeholder="e.g. Intern AI, DeepSeek R1, Groq" value={name} invalid={Boolean(shown("name"))} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="OpenAI-compatible base URL" htmlFor="pv-url" error={shown("baseURL")}>
          <TextInput id="pv-url" className="font-mono" placeholder="https://chat.intern-ai.org.cn/api/v1" value={baseURL} invalid={Boolean(shown("baseURL"))} onChange={(e) => setBaseURL(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
          <Field label="Model identifier" htmlFor="pv-model" error={shown("model")}>
            <TextInput id="pv-model" className="font-mono" placeholder="e.g. internvl3.5-latest or gpt-4o" value={model} invalid={Boolean(shown("model"))} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Timeout (ms)" htmlFor="pv-timeout" error={shown("timeoutMs")}>
            <TextInput id="pv-timeout" inputMode="numeric" value={timeoutMs} invalid={Boolean(shown("timeoutMs"))} onChange={(e) => setTimeoutMs(e.target.value.replace(/[^0-9]/g, ""))} />
          </Field>
        </div>

        <div className="space-y-4 border-t border-line pt-4">
          <Field label="Environment key variable" htmlFor="pv-keyname" error={shown("keyName")} hint="Required by the server. The key value is stored in keys.json by the supervisor.">
            <TextInput
              id="pv-keyname"
              className="font-mono"
              placeholder="e.g. INTERN_API_KEY"
              value={keyName}
              invalid={Boolean(shown("keyName"))}
              onChange={(e) => {
                setKeyName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
                setClearKey(false);
              }}
            />
          </Field>

          <Field
            label="API key value"
            htmlFor="pv-apikey"
            hint={
              provider?.keyConfigured
                ? `${provider.keyName} is already stored. Leave empty to keep it, or paste a new value to replace it.`
                : "Paste the secret once. It is sent to the supervisor and never returned to this console."
            }
          >
            <TextInput
              id="pv-apikey"
              type="password"
              autoComplete="new-password"
              className="font-mono"
              placeholder={provider?.keyConfigured ? "••••••••  (stored)" : "Paste the API key"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                if (e.target.value) setClearKey(false);
              }}
            />
          </Field>

          {provider?.keyConfigured && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-panel-2/60 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink">Remove the stored key</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-mute">
                  The provider stays configured, but testing and routing will fail until a new key is saved.
                </p>
              </div>
              <Switch checked={clearKey} onChange={setClearKey} disabled={Boolean(apiKey.trim())} label={`Remove the stored key for ${provider.keyName}`} />
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}

/* ── View ──────────────────────────────────────────────── */

export function Providers() {
  const providers = useConsole((s) => s.providers);
  const saving = useConsole((s) => Boolean(s.pending["providers:save"]));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const visible = term ? providers.filter((p) => `${p.name} ${p.model} ${p.baseURL}`.toLowerCase().includes(term)) : providers;
  const target = editing && editing !== "new" ? (providers.find((p) => p.id === editing) ?? null) : null;
  const atLimit = providers.length >= MAX_PROVIDERS;

  return (
    <div className="view-in space-y-4">
      <ProviderKPIs />

      <Panel
        eyebrow="Routing order"
        title="Provider fallback chain"
        sub="The router tries enabled endpoints from the top down."
        pad={false}
        tools={
          <Button
            size="sm"
            variant="primary"
            icon={Plus}
            disabled={atLimit || saving}
            disabledReason={atLimit ? `The server accepts at most ${MAX_PROVIDERS} routes.` : "A routing change is being saved."}
            onClick={() => setEditing("new")}
          >
            Add provider
          </Button>
        }
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 lg:px-5">
          <Search size={13} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, model, endpoint…"
            aria-label="Filter providers"
            className="h-6 min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none"
          />
          {query && <IconButton size="sm" icon={X} label="Clear search" onClick={() => setQuery("")} />}
          <span className="num shrink-0 text-[11px] text-faint">
            {visible.length} of {providers.length}
          </span>
        </div>

        {providers.length === 0 ? (
          <EmptyState icon={Cpu} title="No inference providers configured" action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setEditing("new")}>Add provider</Button>}>
            Agents need at least one model endpoint before they can decide anything.
          </EmptyState>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-mute">No provider matches “{query}”.</p>
        ) : (
          <ol className="divide-y divide-line">
            {visible.map((p) => (
              <ProviderRow key={p.id} p={p} index={providers.indexOf(p)} total={providers.length} sortable={!term} onEdit={() => setEditing(p.id)} />
            ))}
          </ol>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel eyebrow="Routing" title="Fallback behavior">
          <p className="text-[12.5px] leading-relaxed text-mute">
            Order the list from preferred to last resort. The router sends each request to the first enabled provider. If
            that call times out or fails, it retries on the next one down, so a single outage never stalls the fleet.
            Reordering or toggling a route restarts ENI1 so the new table is live.
          </p>
        </Panel>
        <Panel eyebrow="Credentials" title="Where keys live">
          <p className="text-[12.5px] leading-relaxed text-mute">
            Key values are written to the supervisor's <span className="font-mono text-[11.5px]">keys.json</span> and are
            never returned by the API. This console shows only the variable name and whether a value is stored. The Test
            button measures a real request; its result lasts for this session only.
          </p>
        </Panel>
      </div>

      {editing && <ProviderDialog key={editing} provider={target} onClose={() => setEditing(null)} />}
    </div>
  );
}
