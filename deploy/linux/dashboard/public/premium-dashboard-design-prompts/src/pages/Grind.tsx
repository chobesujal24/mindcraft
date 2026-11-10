import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Meter, Panel, PanelHead, ProgressRing, Segmented, Sparkline, StatusDot } from "../components/ui";

type Resource = { id: string; label: string; icon: "box" | "leaf" | "database" | "sword" | "coin" | "shield" };
const resources: Resource[] = [
  { id: "stone", label: "Stone", icon: "box" },
  { id: "oak", label: "Oak logs", icon: "leaf" },
  { id: "debris", label: "Ancient debris", icon: "database" },
  { id: "wheat", label: "Wheat", icon: "leaf" },
  { id: "gunpowder", label: "Gunpowder", icon: "sword" },
  { id: "gold", label: "Gold ingot", icon: "coin" },
];

type QueueJob = { id: number; resource: string; count: number; radius: number; bot: string };
const bots = ["Mt. Fuji", "Crimson Pagoda", "Night Castle", "Kanagawa Wave"];

const recent = [
  { id: "G-1180", resource: "Ancient debris", count: 128, duration: "42m 18s", outcome: "Complete", bot: "Mt. Fuji", at: "22:41" },
  { id: "G-1179", resource: "Oak logs", count: 64, duration: "11m 02s", outcome: "Complete", bot: "Night Castle", at: "21:58" },
  { id: "G-1178", resource: "Wheat", count: 96, duration: "—", outcome: "Cancelled", bot: "Kanagawa Wave", at: "20:14" },
  { id: "G-1177", resource: "Gunpowder", count: 32, duration: "08m 44s", outcome: "Complete", bot: "Crimson Pagoda", at: "19:47" },
];

export function Grind({ notify }: { notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void }) {
  const [resource, setResource] = useState("debris");
  const [count, setCount] = useState(32);
  const [radius, setRadius] = useState(48);
  const [tool, setTool] = useState("pickaxe");
  const [active, setActive] = useState({
    id: "G-1181", resource: "Ancient debris", target: 128, collected: 84, bot: "Mt. Fuji", rate: 1.9,
  });
  const [paused, setPaused] = useState(false);
  const [queue, setQueue] = useState<QueueJob[]>([
    { id: 1, resource: "Stone", count: 64, radius: 32, bot: "Night Castle" },
    { id: 2, resource: "Oak logs", count: 48, radius: 24, bot: "Crimson Pagoda" },
    { id: 3, resource: "Wheat", count: 96, radius: 40, bot: "Kanagawa Wave" },
  ]);
  const [tab, setTab] = useState<"All" | "Mining" | "Farming" | "Combat">("All");

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setActive((a) => (a.collected < a.target ? { ...a, collected: Math.min(a.target, a.collected + 1) } : a));
    }, 2400);
    return () => window.clearInterval(t);
  }, [paused]);

  const pct = Math.round((active.collected / active.target) * 100);
  const eta = useMemo(() => {
    const left = (active.target - active.collected) / active.rate;
    return `${Math.floor(left)}m ${String(Math.round((left % 1) * 60)).padStart(2, "0")}s`;
  }, [active]);

  const addJob = () => {
    const label = resources.find((r) => r.id === resource)?.label ?? "Stone";
    setQueue((q) => [...q, { id: Date.now(), resource: label, count, radius, bot: bots[q.length % bots.length] }]);
    notify("Collection job queued", `${count} × ${label} · ${radius} block radius · position ${queue.length + 2}`);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Grind jobs"
        title={<>Make the quiet hours <span className="display italic text-blush">count.</span></>}
        serif
        description="Give ENI a focused collection task. Progress derives from the start time, so a reconnect never loses the plan."
        actions={
          <>
            <Button variant="secondary" icon="pause" disabled={paused} onClick={() => { setPaused(true); notify("Job paused", `${active.id} · position saved at ${active.collected}/${active.target}`, "info"); }}>Pause job</Button>
            <Button variant="primary" icon="plus" onClick={addJob}>Queue job</Button>
          </>
        }
        meta={
          <>
            <Chip tone="ok" dot>Worker · {active.bot}</Chip>
            <Chip tone="neutral">Up to 5 waiting</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">origin · jp-osaka · overworld</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Planner */}
        <Panel className="p-5 sm:p-6 xl:col-span-5">
          <PanelHead eyebrow="Plan a job" title="Deterministic collection" meta={<Chip tone="neutral">{count} blocks</Chip>} />
          <div className="mt-5">
            <label htmlFor="resource" className="mb-2 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">What should ENI collect?</label>
            <div className="relative">
              <select
                id="resource"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="h-10 w-full appearance-none rounded-[8px] border border-white/[0.09] bg-white/[0.03] px-3 pr-9 text-[12.5px] text-ink transition-colors hover:border-white/[0.15] focus:border-blush/40 focus:outline-none"
              >
                {resources.map((r) => <option key={r.id} value={r.id} className="bg-[#151218]">{r.label}</option>)}
              </select>
              <Icon name="chevron-down" size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">Block count <span className="text-ink-mute/60">1–128</span></label>
              <div className="flex items-center gap-1">
                <button onClick={() => setCount((c) => Math.max(1, c - 8))} aria-label="Decrease block count" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.09] text-ink-dim transition-colors hover:border-white/[0.16] hover:text-ink"><Icon name="minus" size={13} /></button>
                <input
                  type="number"
                  min={1}
                  max={128}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(128, Number(e.target.value) || 1)))}
                  className="h-10 min-w-0 flex-1 rounded-[7px] border border-white/[0.09] bg-white/[0.03] text-center font-mono text-[12px] text-ink focus:border-blush/40 focus:outline-none"
                  aria-label="Block count"
                />
                <button onClick={() => setCount((c) => Math.min(128, c + 8))} aria-label="Increase block count" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.09] text-ink-dim transition-colors hover:border-white/[0.16] hover:text-ink"><Icon name="plus" size={13} /></button>
              </div>
            </div>
            <div>
              <label htmlFor="radius" className="mb-2 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">Search radius</label>
              <div className="flex h-10 items-center gap-2 rounded-[7px] border border-white/[0.09] bg-white/[0.03] px-3">
                <input id="radius" type="range" min={8} max={128} step={8} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="slider" aria-label="Search radius" />
                <span className="w-10 shrink-0 text-right font-mono text-[10px] text-ink-dim">{radius}b</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-2 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">Tool whitelist</span>
            <div className="flex gap-1.5">
              {[["pickaxe", "Pickaxe"], ["axe", "Axe"], ["shovel", "Shovel"], ["hoe", "Hoe"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTool(id)}
                  aria-pressed={tool === id}
                  className={cn("h-8 flex-1 rounded-[6px] border text-[11px] transition-colors", tool === id ? "border-blush/25 bg-blush/[0.1] text-blush-hi" : "border-white/[0.07] bg-white/[0.02] text-ink-mute hover:text-ink-dim")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="primary" className="mt-5 w-full justify-between" onClick={addJob}>
            Queue collection job <Icon name="arrow-right" size={14} />
          </Button>
          <p className="mt-3 flex items-start gap-2 rounded-[8px] border border-white/[0.055] bg-white/[0.015] p-3 text-[10.5px] leading-relaxed text-ink-mute">
            <Icon name="shield" size={12} className="mt-px shrink-0 text-sage/70" />
            Uses the foreman's visible-ore safeguards. Jobs never mine outside the loaded radius or below Y −58.
          </p>
        </Panel>

        {/* Current job */}
        <Panel className="relative overflow-hidden p-5 sm:p-6 xl:col-span-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blush/[0.05] blur-3xl" />
          <div className="relative">
            <PanelHead
              eyebrow="Current job"
              title={`${active.id} · ${active.resource}`}
              meta={<Chip tone={paused ? "warn" : "ok"} dot>{paused ? "Paused" : "Running"}</Chip>}
              actions={<span className="flex items-center gap-1.5 font-mono text-[9px] text-sage"><StatusDot tone="ok" /> {active.bot}</span>}
            />
            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
              <ProgressRing value={pct} size={92} stroke={3} label={`${pct}%`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="num text-[32px] leading-none text-ink">{active.collected}</span>
                  <span className="font-mono text-[11px] text-ink-mute">/ {active.target} blocks</span>
                </div>
                <Meter value={pct} className="mt-3" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[["Elapsed", "24m 06s"], ["ETA", paused ? "—" : eta], ["Yield", `${active.rate.toFixed(1)}/s`]].map(([k, v]) => (
                    <div key={k}>
                      <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">{k}</div>
                      <div className="mt-1 font-mono text-[10.5px] text-ink-dim">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.055] pt-4">
              <Button variant="secondary" size="sm" icon={paused ? "play" : "pause"} onClick={() => { setPaused(!paused); notify(paused ? "Job resumed" : "Job paused", `${active.id} · ${active.collected}/${active.target}`, paused ? "ok" : "info"); }}>
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button variant="quiet" size="sm" icon="x" onClick={() => { notify("Job cancelled", `${active.id} · progress kept in recent`, "warn"); setPaused(true); setActive((a) => ({ ...a, collected: a.collected })); }}>Abort</Button>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[8.5px] text-ink-mute">
                <Icon name="clock" size={10} /> started 23:54 · resumes after reconnect
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[9px] border border-white/[0.06] bg-white/[0.05]">
              {[["Target block", active.resource], ["Dimension", "Overworld · −54"], ["Tool", "Netherite pickaxe"], ["Chest", "Night cache · sealed"]].map(([k, v]) => (
                <div key={k} className="bg-[#110F13] px-3 py-2.5">
                  <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">{k}</div>
                  <div className="mt-1 truncate text-[11px] text-ink-dim">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="overflow-hidden xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <PanelHead eyebrow="Up next" title="Queue" meta={<Chip tone="neutral">{queue.length} waiting</Chip>} />
            <Segmented
              options={[{ id: "All", label: "All" }, { id: "Mining", label: "Mining" }, { id: "Farming", label: "Farming" }, { id: "Combat", label: "Combat" }]}
              value={tab}
              onChange={setTab}
            />
          </div>
          <ul className="border-t border-white/[0.055]">
            {queue
              .map((j, i) => ({ j, i }))
              .filter(({ j }) =>
                tab === "All" ||
                (tab === "Mining" && /Stone|debris/i.test(j.resource)) ||
                (tab === "Farming" && /Wheat|logs/i.test(j.resource)) ||
                (tab === "Combat" && /Gunpowder/i.test(j.resource)),
              )
              .map(({ j, i }) => (
              <li key={j.id} className="group flex items-center gap-3 border-b border-white/[0.045] px-5 py-3 last:border-0 hover:bg-white/[0.018]">
                <span className="w-4 font-mono text-[9px] text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-white/[0.07] bg-white/[0.02] text-ink-mute"><Icon name="box" size={12} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] text-ink">{j.count} × {j.resource}</div>
                  <div className="font-mono text-[8.5px] text-ink-mute">{j.bot} · {j.radius} block radius</div>
                </div>
                <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setQueue((q) => { if (i === 0) return q; const n = [...q]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label={`Move ${j.resource} up`} className="rounded p-1 text-ink-mute hover:text-ink"><Icon name="chevron-down" size={11} className="rotate-180" /></button>
                  <button onClick={() => setQueue((q) => { if (i === q.length - 1) return q; const n = [...q]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} aria-label={`Move ${j.resource} down`} className="rounded p-1 text-ink-mute hover:text-ink"><Icon name="chevron-down" size={11} /></button>
                  <button onClick={() => { setQueue((q) => q.filter((x) => x.id !== j.id)); notify("Job removed from queue", `${j.resource} · ${j.bot}`, "info"); }} aria-label={`Remove ${j.resource}`} className="rounded p-1 text-ink-mute hover:text-rose"><Icon name="x" size={11} /></button>
                </div>
              </li>
            ))}
            {queue.length === 0 && (
              <li className="px-5 py-10 text-center">
                <p className="text-[12px] text-ink-dim">Your queue is clear.</p>
                <p className="mt-1 text-[10.5px] text-ink-mute">Add a collection job on the left when you're ready.</p>
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute"><StatusDot tone="ok" /> progress saved every 15s</span>
            <span className="font-mono text-[9px] text-ink-mute">{queue.length}/5 slots</span>
          </div>
        </Panel>

        <Panel className="p-5 xl:col-span-5">
          <PanelHead eyebrow="Throughput" title="Blocks per minute" meta={<Chip tone="ok">+12%</Chip>} />
          <div className="mt-5"><Sparkline data={[42, 48, 61, 54, 72, 66, 81, 78, 92, 88, 104, 112]} width={430} height={78} className="w-full" /></div>
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[9px] text-ink-mute">last 60 min · all workers</span>
            <span className="font-mono text-[10px] text-ink-dim">112 / min</span>
          </div>
          <div className="mt-4 space-y-px overflow-hidden rounded-[9px] border border-white/[0.06] bg-white/[0.05]">
            {[["Active workers", "2"], ["Queued blocks", String(queue.reduce((s, j) => s + j.count, 0))], ["Completed today", "1,284"], ["Cancelled today", "3"]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between bg-[#110F13] px-3 py-2.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{k}</span>
                <span className="font-mono text-[10px] text-ink-dim">{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <PanelHead eyebrow="History" title="Recent jobs" meta={<Chip tone="neutral">last 10</Chip>} />
          <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => notify("Full history", "412 jobs · 30-day retention", "info")}>View all</Button>
        </div>
        <div className="hidden grid-cols-[80px_1.4fr_80px_1fr_110px_80px] gap-4 border-y border-white/[0.055] bg-white/[0.014] px-5 py-2.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute md:grid">
          <span>Job</span><span>Resource</span><span>Count</span><span>Worker</span><span>Duration</span><span className="text-right">Outcome</span>
        </div>
        <ul>
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.045] px-5 py-3 last:border-0 hover:bg-white/[0.018] md:grid md:grid-cols-[80px_1.4fr_80px_1fr_110px_80px]">
              <span className="font-mono text-[9.5px] text-ink-mute">{r.id}</span>
              <span className="text-[11.5px] text-ink">{r.resource}</span>
              <span className="font-mono text-[10px] text-ink-dim">{r.count}</span>
              <span className="text-[10.5px] text-ink-mute">{r.bot}</span>
              <span className="font-mono text-[9.5px] text-ink-mute">{r.duration}</span>
              <span className={cn("ml-auto flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] md:ml-0 md:justify-end", r.outcome === "Complete" ? "text-sage" : "text-ink-mute")}>
                <StatusDot tone={r.outcome === "Complete" ? "ok" : "idle"} size={5} /> {r.outcome}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <span className="font-mono text-[8.5px] text-ink-mute">times shown in JST · server timezone</span>
          <span className="font-mono text-[8.5px] text-sage">1,284 complete · 3 cancelled today</span>
        </div>
      </Panel>
    </PageShell>
  );
}
