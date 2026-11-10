import { useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Divider, Eyebrow, Panel, PanelHead, StatusDot, Toggle } from "../components/ui";

const initial = {
  host: "jp-osaka.anarchy.pavilion",
  port: "25565",
  version: "1.21.4",
  auth: "device",
  proxy: "",
  mindserver: "8091",
  initMessage: "Yozakura has entered the pavilion.",
  onlyChatWith: "",
  baseProfile: "mc-foreman",
  language: "en",
  autoOpenUi: "true",
  originX: "142",
  originY: "64",
  originZ: "-38",
  loginStagger: "1500",
  startPaused: "false",
  pathfinder: "baritone",
  protectRadius: "32",
  builderAutoStart: "true",
};

type Key = keyof typeof initial;
type Field = { key: Key; label: string; placeholder?: string; hint?: string; mono?: boolean; secret?: boolean };

const groups: { id: string; label: string; hint: string; icon: "globe" | "cpu" | "server"; fields: Field[] }[] = [
  {
    id: "network",
    label: "Minecraft target connection",
    hint: "network & auth",
    icon: "globe",
    fields: [
      { key: "host", label: "Host", placeholder: "e.g. play.server.net", mono: true },
      { key: "port", label: "Port", placeholder: "25565", mono: true },
      { key: "version", label: "Version", hint: "paper · protocol pinned" },
      { key: "auth", label: "Auth mode", hint: "device · offline · microsoft" },
      { key: "proxy", label: "Proxy route", placeholder: "socks5://host:port", hint: "blank = direct", mono: true },
    ],
  },
  {
    id: "engine",
    label: "Mindcraft engine",
    hint: "orchestration",
    icon: "cpu",
    fields: [
      { key: "mindserver", label: "MindServer port", mono: true },
      { key: "initMessage", label: "Init message", hint: "first message on spawn" },
      { key: "onlyChatWith", label: "Only chat with", placeholder: "blank = public", hint: "comma separated" },
      { key: "baseProfile", label: "Base profile", mono: true },
      { key: "language", label: "Language", hint: "ISO 639-1" },
      { key: "autoOpenUi", label: "Auto open UI", hint: "opens the local spectator" },
    ],
  },
  {
    id: "cluster",
    label: "Bot cluster parameters",
    hint: "origin & safeguards",
    icon: "server",
    fields: [
      { key: "originX", label: "Base origin X", mono: true },
      { key: "originY", label: "Base origin Y", mono: true },
      { key: "originZ", label: "Base origin Z", mono: true },
      { key: "loginStagger", label: "Login stagger (ms)", mono: true },
      { key: "startPaused", label: "Start paused", hint: "workers wait for a manual resume" },
      { key: "pathfinder", label: "Pathfinder engine", hint: "baritone · native" },
      { key: "protectRadius", label: "Protect radius (blocks)", mono: true },
      { key: "builderAutoStart", label: "Builder auto start", hint: "resume a paused schematic on boot" },
    ],
  },
];

const selects: Record<string, string[]> = {
  auth: ["device", "offline", "microsoft"],
  pathfinder: ["baritone", "native"],
  autoOpenUi: ["true", "false"],
  startPaused: ["true", "false"],
  builderAutoStart: ["true", "false"],
  language: ["en", "ja", "de", "fr"],
};

export function Runtime({ notify }: { notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [domains, setDomains] = useState<Record<string, boolean>>({ network: true, engine: true, cluster: true });
  const [pending, setPending] = useState<string | null>(null);
  const [replaceOnWrite, setReplaceOnWrite] = useState(true);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const errors: Partial<Record<Key, string>> = {};
  if (!values.host.trim()) errors.host = "Host is required.";
  if (!/^\d{2,5}$/.test(values.port)) errors.port = "Use a valid port (1–65535).";
  if (!/^\d{2,5}$/.test(values.mindserver)) errors.mindserver = "MindServer needs a port.";
  const invalid = Object.keys(errors).length > 0;

  const set = (k: Key, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const commit = (mode: "save" | "restart-one" | "restart-all") => {
    if (invalid) {
      notify("Could not save", Object.values(errors)[0] ?? "Check the highlighted fields", "warn");
      return;
    }
    setPending(mode);
    window.setTimeout(() => {
      setSaved(values);
      setPending(null);
      notify(
        mode === "save" ? "Runtime parameters saved" : mode === "restart-one" ? "ENI restarted" : "All services restarted",
        mode === "save" ? ".bak written before save · applied next tick" : "8 workers reattached · supervisor resumed",
      );
    }, 800);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Infrastructure / Runtime & cluster"
        title={<>Architecture you can <span className="display italic text-blush">read at a glance.</span></>}
        serif
        description="Target connection, engine orchestration, and cluster safeguards. Changes are written to disk only when you ask, with an automatic .bak before every write."
        actions={
          <>
            <Button variant="ghost" icon="download" onClick={() => notify("Parameters exported", "eni-runtime-config.json", "info")}>Export</Button>
            <Button variant="secondary" icon="check" disabled={!dirty || pending !== null} onClick={() => commit("save")}>{pending === "save" ? "Saving…" : "Save only"}</Button>
            <Button variant="primary" icon="refresh" disabled={pending !== null} onClick={() => commit("restart-one")}>
              {pending === "restart-one" ? "Restarting…" : "Save & restart ENI"}
            </Button>
          </>
        }
        meta={
          <>
            <Chip tone="ok" dot>Server configured</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">MindServer :8091</span>
            <span className="font-mono text-[9.5px] text-ink-mute">origin · {values.originX}, {values.originY}, {values.originZ}</span>
            {dirty && <Chip tone="warn">Unsaved changes</Chip>}
          </>
        }
      />

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-[8px] border border-white/[0.06] bg-white/[0.02] p-1">
          {[{ id: "all", label: "All domains" }, { id: "network", label: "Network" }, { id: "engine", label: "Engine" }, { id: "cluster", label: "Cluster" }].map((d) => (
            <button
              key={d.id}
              onClick={() => setDomains(d.id === "all" ? { network: true, engine: true, cluster: true } : { network: d.id === "network", engine: d.id === "engine", cluster: d.id === "cluster" })}
              aria-pressed={d.id === "all" ? Object.values(domains).every(Boolean) : domains[d.id]}
              className={cn(
                "h-7 rounded-[6px] px-2.5 text-[11.5px] transition-colors",
                (d.id === "all" ? Object.values(domains).every(Boolean) : domains[d.id]) ? "bg-white/[0.08] text-ink" : "text-ink-mute hover:text-ink-dim",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.018] px-2.5 py-1.5 font-mono text-[8.5px] text-ink-mute">
          <Icon name="shield" size={11} className="text-sage/70" /> automatic <span className="rounded border border-white/[0.08] px-1 text-ink-dim">.bak</span> before write
          <Toggle checked={replaceOnWrite} onChange={setReplaceOnWrite} label="Write backup before saving" />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {groups.filter((g) => domains[g.id]).map((g) => (
          <Panel key={g.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.025] text-ink-dim"><Icon name={g.icon} size={14} /></span>
                <div>
                  <h2 className="text-[13px] font-medium leading-tight text-ink">{g.label}</h2>
                  <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">{g.hint}</p>
                </div>
              </div>
              <Icon name="dots" size={13} className="text-ink-mute/50" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3.5">
              {g.fields.map((f) => {
                const isSelect = !!selects[f.key];
                const span = g.fields.length === 5 && f.key === "proxy" ? "col-span-2" : "";
                return (
                  <div key={f.key} className={cn("min-w-0", span)}>
                    <label htmlFor={f.key} className="mb-1.5 flex items-baseline justify-between gap-1">
                      <span className="truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-mute">{f.label}</span>
                      {errors[f.key] && <span className="shrink-0 font-mono text-[7.5px] text-rose">required</span>}
                    </label>
                    {isSelect ? (
                      <div className="relative">
                        <select
                          id={f.key}
                          value={values[f.key]}
                          onChange={(e) => set(f.key, e.target.value)}
                          className="h-9 w-full appearance-none rounded-[7px] border border-white/[0.09] bg-white/[0.03] px-2.5 pr-7 text-[11.5px] text-ink transition-colors hover:border-white/[0.15] focus:border-blush/40 focus:outline-none"
                        >
                          {selects[f.key].map((v) => <option key={v} value={v} className="bg-[#151218]">{v}</option>)}
                        </select>
                        <Icon name="chevron-down" size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-mute" />
                      </div>
                    ) : (
                      <input
                        id={f.key}
                        value={values[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder={f.placeholder ?? "auto"}
                        className={cn(
                          "h-9 w-full rounded-[7px] border bg-white/[0.03] px-2.5 text-[11.5px] text-ink transition-colors hover:border-white/[0.15] focus:outline-none",
                          errors[f.key] ? "border-rose/40" : "border-white/[0.09] focus:border-blush/40",
                          f.mono && "font-mono text-[10.5px]",
                        )}
                      />
                    )}
                    {f.hint && <p className="mt-1 truncate font-mono text-[7.5px] text-ink-mute/70">{f.hint}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.055] pt-3">
              <span className="flex items-center gap-1.5 font-mono text-[8px] text-sage"><StatusDot tone="ok" /> valid</span>
              <button onClick={() => setValues(saved)} className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:text-blush">revert group</button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <PanelHead eyebrow="Apply" title="Write and restart" meta={<Chip tone={dirty ? "warn" : "ok"} dot>{dirty ? "Unsaved changes" : "In sync"}</Chip>} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon="check" disabled={!dirty || pending !== null} onClick={() => commit("save")}>Save only</Button>
            <Button variant="secondary" icon="refresh" disabled={pending !== null} onClick={() => commit("restart-all")}>{pending === "restart-all" ? "Restarting…" : "Save & restart all"}</Button>
            <Button variant="primary" icon="power" disabled={pending !== null} onClick={() => commit("restart-one")}>{pending === "restart-one" ? "Restarting ENI…" : "Save & restart ENI"}</Button>
          </div>
        </div>
        <Divider />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[660px] text-[10.5px] leading-relaxed text-ink-mute">
            Restarting all services re-initialises the four cluster workers and briefly interrupts every job. Restarting ENI keeps worker sessions and rejects parameters that fail validation.
          </p>
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[8.5px] text-ink-mute"><Icon name="clock" size={10} /> last write · 2h 14m ago</span>
        </div>
      </Panel>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="p-5 sm:p-6 xl:col-span-7">
          <PanelHead eyebrow="Cluster" title="Nodes & regions" meta={<Chip tone="warn" dot>1 degraded</Chip>} actions={<Button variant="ghost" size="sm" icon="refresh" onClick={() => notify("Node health refreshed", "5 nodes · 4 nominal · relay-03 degraded 88ms", "info")}>Ping all</Button>} />
          <div className="mt-5 space-y-px overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.05]">
            {[
              ["eni-01", "Osaka", "Coordinator", "38%", "ok"],
              ["worker-a", "Osaka", "Bot cluster", "62%", "ok"],
              ["worker-b", "Tokyo", "Bot cluster", "54%", "ok"],
              ["relay-03", "Kanagawa", "Blossom relay", "91%", "warn"],
              ["gateway", "Local", "Model router", "27%", "ok"],
            ].map(([n, region, role, load, tone]) => (
              <div key={n} className="flex items-center gap-3 bg-[#110F13] px-3.5 py-2.5">
                <StatusDot tone={tone === "warn" ? "warn" : "ok"} />
                <span className="w-20 shrink-0 font-mono text-[10px] text-ink">{n}</span>
                <span className="w-20 shrink-0 font-mono text-[8.5px] text-ink-mute">{region}</span>
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-dim">{role}</span>
                <span className={cn("font-mono text-[8.5px]", tone === "warn" ? "text-amber" : "text-sage")}>{load}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6 xl:col-span-5">
          <PanelHead eyebrow="Health" title="Target connection" meta={<Chip tone="ok" dot>Reachable</Chip>} />
          <div className="mt-5 flex items-end justify-between">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">Round trip</div>
              <div className="num mt-1 text-[30px] leading-none text-ink">24<span className="ml-1 font-mono text-[11px] text-ink-mute">ms</span></div>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[8.5px] text-sage"><StatusDot tone="ok" /> handshake · device</span>
          </div>
          <div className="mt-5 space-y-px overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.05]">
            {[["Host", values.host], ["Port", values.port], ["Protocol", `${values.version} · paper`], ["Session", "3h 42m stable"], ["Workers", "4 of 4 attached"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 bg-[#110F13] px-3.5 py-2.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{k}</span>
                <span className="max-w-[62%] truncate font-mono text-[9.5px] text-ink-dim">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" icon="refresh" className="flex-1" onClick={() => notify("Target handshake complete", "24 ms · protocol 1.21.4")}>Test connection</Button>
            <Button variant="quiet" size="sm" icon="terminal" className="flex-1" onClick={() => notify("MindServer logs opened", "tail 200 · eni-01", "info")}>View logs</Button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
            <Eyebrow className="!text-[8px]">mindserver ui · :8091</Eyebrow>
            <span className="font-mono text-[8.5px] text-sage">state streaming</span>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
