import { useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Eyebrow, Meter, Panel, PanelHead, ProgressRing, StatusDot, Toggle } from "../components/ui";

type Provider = {
  id: number;
  name: string;
  maker: string;
  model: string;
  baseUrl: string;
  key: string;
  enabled: boolean;
  latency: string;
  tps: string;
  context: number;
  caps: string[];
  tested: "ok" | "idle";
  spend: string;
};

const initial: Provider[] = [
  {
    id: 1, name: "Gemini 3.8 Flash High", maker: "Google", model: "gemini-3.8-flash-high",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta", key: "AIza••••••••••••••4f2c", enabled: true,
    latency: "1.2 s", tps: "186 t/s", context: 62, caps: ["Subagents", "Vision", "Long context"], tested: "ok", spend: "$18.40",
  },
  {
    id: 2, name: "DeepSeek v4.1 Flash 1017", maker: "DeepSeek", model: "deepseek-v4.1-flash-1017",
    baseUrl: "https://api.deepseek.com/v1", key: "sk-••••••••••••••7a91", enabled: true,
    latency: "0.7 s", tps: "142 t/s", context: 38, caps: ["Deterministic", "Code", "Fast"], tested: "ok", spend: "$4.12",
  },
  {
    id: 3, name: "ENI local critic", maker: "Rust · local", model: "eni-critic-7b-q4",
    baseUrl: "http://127.0.0.1:4100/v1", key: "local-no-key", enabled: true,
    latency: "210 ms", tps: "64 t/s", context: 12, caps: ["Screenshots", "Accessibility", "Offline"], tested: "ok", spend: "$0.00",
  },
];

const spendBars = [38, 56, 42, 71, 64, 83, 59];

export function Providers({ notify }: { notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void }) {
  const [list, setList] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [testing, setTesting] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", baseUrl: "", model: "", key: "" });
  const [addError, setAddError] = useState("");

  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const enabledList = list.filter((p) => p.enabled);

  const move = (id: number, dir: -1 | 1) => {
    setList((l) => {
      const i = l.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  const toggle = (id: number, value: boolean) => {
    const enabledCount = list.filter((p) => p.enabled).length;
    if (!value && enabledCount <= 1) {
      notify("Keep at least one provider", "ENI needs a reasoner to stay online", "warn");
      return;
    }
    setList((l) => l.map((p) => (p.id === id ? { ...p, enabled: value } : p)));
    const p = list.find((x) => x.id === id);
    notify(`${p?.name} ${value ? "enabled" : "disabled"}`, value ? "Added to the fallback chain" : "Removed from routing", value ? "ok" : "info");
  };

  const test = (id: number) => {
    setTesting(id);
    window.setTimeout(() => {
      setTesting(null);
      setList((l) => l.map((p) => (p.id === id ? { ...p, tested: "ok" } : p)));
      notify("Provider reachable", `${list.find((p) => p.id === id)?.name} · model responded in 0.9s`);
    }, 1100);
  };

  const save = () => {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(list);
      notify("Providers saved · ENI restarted", `${list.filter((p) => p.enabled).length} enabled · Gemini first, DeepSeek fallback`);
    }, 1000);
  };

  const addProvider = () => {
    if (!draft.name.trim() || !draft.baseUrl.trim() || !draft.model.trim()) {
      setAddError("Name, base URL, and model are required.");
      return;
    }
    if (!/^https?:\/\/.+/.test(draft.baseUrl)) {
      setAddError("Base URL must start with http:// or https://.");
      return;
    }
    setAddError("");
    setList((l) => [
      ...l,
      {
        id: Date.now(), name: draft.name.trim(), maker: "Custom provider", model: draft.model.trim(),
        baseUrl: draft.baseUrl.trim(), key: draft.key ? `${draft.key.slice(0, 4)}••••••••${draft.key.slice(-4)}` : "no key saved",
        enabled: false, latency: "—", tps: "—", context: 0, caps: ["OpenAI compatible"], tested: "idle", spend: "$0.00",
      },
    ]);
    setShowAdd(false);
    setDraft({ name: "", baseUrl: "", model: "", key: "" });
    notify("Provider added", "Disabled by default · test it before enabling", "info");
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / AI providers"
        title={<>Two minds, one <span className="display italic text-blush">chain of command.</span></>}
        serif
        description="ENI tries enabled providers top to bottom. Gemini plans, DeepSeek implements, and the local critic checks the screen before anything ships."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => { setList(saved); notify("Providers reloaded", "Live configuration restored"); }}>Reload</Button>
            <Button variant="secondary" icon="plus" onClick={() => setShowAdd((s) => !s)}>Add provider</Button>
            <Button variant="primary" icon="power" onClick={save} disabled={saving}>
              {saving ? "Saving & restarting…" : "Save & restart ENI"}
            </Button>
          </>
        }
        meta={
          <>
            <Chip tone={dirty ? "warn" : "ok"} dot>{dirty ? "Unsaved order" : "In sync"}</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">{enabledList.length} enabled · {list.length - enabledList.length} standby</span>
            <span className="font-mono text-[9.5px] text-ink-mute">top-to-bottom fallback</span>
          </>
        }
      />

      {showAdd && (
        <Panel className="mt-6 p-5 anim-fade-up">
          <PanelHead eyebrow="New provider" title="Any OpenAI-compatible endpoint" meta={<Chip tone="neutral">checked before save</Chip>} actions={<button onClick={() => setShowAdd(false)} aria-label="Close add provider" className="text-ink-mute hover:text-ink"><Icon name="x" size={15} /></button>} />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "name" as const, label: "Display name", ph: "Local Qwen 32B" },
              { k: "baseUrl" as const, label: "Base URL", ph: "https://host/v1" },
              { k: "model" as const, label: "Model id", ph: "qwen3-32b" },
              { k: "key" as const, label: "API key", ph: "blank · keep saved key" },
            ].map((f) => (
              <div key={f.k}>
                <label htmlFor={`add-${f.k}`} className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">{f.label}</label>
                <input
                  id={`add-${f.k}`}
                  type={f.k === "key" ? "password" : "text"}
                  value={draft[f.k]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.k]: e.target.value }))}
                  placeholder={f.ph}
                  className="h-9 w-full rounded-[7px] border border-white/[0.09] bg-white/[0.03] px-2.5 font-mono text-[10.5px] text-ink placeholder:text-ink-mute/50 focus:border-blush/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
          {addError && <p role="alert" className="mt-2 font-mono text-[9px] text-rose">{addError}</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" size="sm" icon="plus" onClick={addProvider}>Add provider</Button>
            <span className="font-mono text-[8.5px] text-ink-mute">keys are stored on eni-01, never in this browser</span>
          </div>
        </Panel>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <div className="flex items-center justify-between px-1">
            <Eyebrow className="flex items-center gap-2"><Icon name="layers" size={11} /> Priority chain</Eyebrow>
            <span className="font-mono text-[8.5px] text-ink-mute">first enabled provider is the primary</span>
          </div>

          {list.map((p, i) => {
            const primary = p.enabled && enabledList[0]?.id === p.id;
            const rank = p.enabled ? enabledList.findIndex((e) => e.id === p.id) + 1 : null;
            return (
              <Panel key={p.id} className={cn("relative overflow-hidden transition-colors", p.enabled ? "border-white/[0.08]" : "opacity-[0.62] hover:opacity-100")}>
                {primary && <span className="absolute inset-y-0 left-0 w-[2px] bg-blush/70" />}
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <button onClick={() => move(p.id, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`} className="rounded p-1 text-ink-mute transition-colors hover:text-ink disabled:opacity-25"><Icon name="chevron-down" size={12} className="rotate-180" /></button>
                      <span className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-white/[0.08] bg-white/[0.03] font-mono text-[9px] text-ink">{p.enabled ? String(rank).padStart(2, "0") : "—"}</span>
                      <button onClick={() => move(p.id, 1)} disabled={i === list.length - 1} aria-label={`Move ${p.name} down`} className="rounded p-1 text-ink-mute transition-colors hover:text-ink disabled:opacity-25"><Icon name="chevron-down" size={12} /></button>
                    </div>

                    <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border", primary ? "border-blush/25 bg-blush/[0.09] text-blush" : "border-white/[0.08] bg-white/[0.025] text-ink-dim")}>
                      <Icon name={i === 0 ? "spark" : i === 1 ? "cpu" : "shield"} size={17} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="text-[14px] font-medium text-ink">{p.name}</h2>
                        {primary && <Chip tone="blush">Primary</Chip>}
                        {!p.enabled && <Chip tone="neutral">Standby</Chip>}
                      </div>
                      <p className="mt-1 truncate font-mono text-[9px] text-ink-mute">{p.maker} · {p.model}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.caps.map((c) => <span key={c} className="rounded-[4px] border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.08em] text-ink-mute">{c}</span>)}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-[8px] uppercase tracking-[0.1em]", p.enabled ? "text-sage" : "text-ink-mute")}>{p.enabled ? "enabled" : "disabled"}</span>
                        <Toggle checked={p.enabled} onChange={(v) => toggle(p.id, v)} label={`Enable ${p.name}`} />
                      </div>
                      <button onClick={() => notify("Provider menu", `${p.name} · remove, duplicate, rotate key`, "info")} aria-label={`Options for ${p.name}`} className="text-ink-mute transition-colors hover:text-ink"><Icon name="dots" size={14} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-white/[0.06] bg-white/[0.05] sm:grid-cols-4">
                    {[["Latency", p.latency], ["Throughput", p.tps], ["Spend", p.spend], ["Context", `${p.context}%`]].map(([k, v], idx) => (
                      <div key={k} className="bg-[#110F13] px-2.5 py-2">
                        <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">{k}</div>
                        <div className={cn("mt-1 font-mono text-[10.5px]", idx === 3 && p.context > 80 ? "text-amber" : "text-ink-dim")}>{v}</div>
                        {idx === 3 && <Meter value={p.context} tone={p.context > 80 ? "amber" : "dim"} className="mt-1.5 !h-[2px]" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-white/[0.055] pt-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[6px] border border-white/[0.06] bg-white/[0.018] px-2 py-1.5">
                      <Icon name="globe" size={11} className="shrink-0 text-ink-mute" />
                      <span className="truncate font-mono text-[9px] text-ink-mute">{p.baseUrl}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1 rounded-[6px] border border-white/[0.06] bg-white/[0.018] px-2 py-1.5 sm:w-[230px]">
                      <Icon name="lock" size={10} className="shrink-0 text-ink-mute" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-ink-dim">{revealed === p.id ? "sk-live-revealed-in-session" : p.key}</span>
                      <button onClick={() => setRevealed(revealed === p.id ? null : p.id)} aria-label={revealed === p.id ? "Hide API key" : "Reveal API key"} className="shrink-0 text-ink-mute hover:text-ink"><Icon name={revealed === p.id ? "x" : "search"} size={10} /></button>
                      <button onClick={() => notify("Key copied", `${p.name} · clipboard cleared in 30s`, "info")} aria-label="Copy API key" className="shrink-0 text-ink-mute hover:text-blush"><Icon name="copy" size={10} /></button>
                    </div>
                    <Button variant="quiet" size="sm" icon="zap" onClick={() => test(p.id)} disabled={testing === p.id}>
                      {testing === p.id ? "Testing…" : "Test"}
                    </Button>
                  </div>
                </div>
              </Panel>
            );
          })}

          <button
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-white/[0.1] py-3.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute transition-colors hover:border-blush/25 hover:text-blush/80"
          >
            <Icon name="plus" size={12} /> add an OpenAI-compatible provider
          </button>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel className="p-5">
            <PanelHead eyebrow="Routing" title="Resolved fallback" meta={<Chip tone={dirty ? "warn" : "ok"} dot>{dirty ? "Draft" : "Live"}</Chip>} />
            <ol className="mt-4 space-y-1.5">
              {enabledList.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2.5 rounded-[8px] border border-white/[0.06] bg-white/[0.018] px-2.5 py-2">
                  <span className="font-mono text-[8px] text-ink-mute">0{i + 1}</span>
                  <span className={cn("flex h-6 w-6 items-center justify-center rounded-[5px] border", i === 0 ? "border-blush/25 bg-blush/[0.08] text-blush" : "border-white/[0.07] text-ink-dim")}><Icon name={i === 0 ? "spark" : i === 1 ? "cpu" : "shield"} size={11} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[10.5px] text-ink">{p.name}</div>
                    <div className="font-mono text-[7.5px] text-ink-mute">{i === 0 ? "answers first" : "on primary failure"}</div>
                  </div>
                  <span className="font-mono text-[8.5px] text-sage"><StatusDot tone="ok" size={5} /></span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-start gap-2 rounded-[7px] border border-blush/15 bg-blush/[0.035] p-2.5">
              <Icon name="shield" size={11} className="mt-0.5 shrink-0 text-blush" />
              <p className="text-[9.5px] leading-relaxed text-ink-dim">Deterministic routing. ENI never silently switches models mid-task; the chain is walked only on a hard failure.</p>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Spend" title="This week" meta={<span className="font-mono text-[9px] text-ink-mute">USD</span>} />
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="num text-[28px] leading-none text-ink">$22.52</div>
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[9px] text-sage"><Icon name="arrow-up-right" size={10} /> 8.2% vs last week</div>
              </div>
              <ProgressRing value={41} size={50} stroke={3} label="41%" />
            </div>
            <div className="mt-5 flex h-[76px] items-end gap-1.5">
              {spendBars.map((v, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div className={cn("w-full rounded-t-[3px] transition-colors", i === 5 ? "bg-blush/80 group-hover:bg-blush" : "bg-white/[0.11] group-hover:bg-white/[0.18]")} style={{ height: `${v}%` }} />
                  </div>
                  <span className="font-mono text-[7.5px] text-ink-mute">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.055] pt-3 font-mono text-[8.5px]">
              <span className="text-ink-mute">budget · $60 / week</span>
              <span className="flex items-center gap-1.5 text-ink-dim"><StatusDot tone="ok" /> under budget</span>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start gap-2.5">
              <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-sage/80" />
              <div>
                <p className="text-[11px] text-ink-dim">Keys stay on eni-01</p>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-mute">This console shows masked values only. Leave a key blank when editing to keep the saved one. Restart with ENI only after testing every enabled provider.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
