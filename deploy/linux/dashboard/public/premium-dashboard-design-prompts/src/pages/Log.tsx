import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { activity } from "../data";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Panel, PanelHead, Segmented, StatusDot } from "../components/ui";

export type Dispatched = { id: number; label: string; time: string };

const kinds = ["All", "Commands", "System", "Warnings"] as const;
type Kind = (typeof kinds)[number];

export function Log({
  dispatched,
  onTerminal,
  notify,
}: {
  dispatched: Dispatched[];
  onTerminal: () => void;
  notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void;
}) {
  const [filter, setFilter] = useState<Kind>("All");
  const [q, setQ] = useState("");

  const events = useMemo(() => {
    const derived = dispatched.map((d) => ({
      t: d.time,
      kind: "command" as const,
      title: d.label,
      detail: "mc-foreman · locally simulated · acknowledged",
    }));
    const all = [...derived, ...activity];
    return all.filter((e) => {
      const kindOk = filter === "All" || (filter === "Commands" && e.kind === "command") || (filter === "System" && (e.kind === "system" || e.kind === "agent")) || (filter === "Warnings" && e.kind === "warning");
      const qOk = !q || `${e.title} ${e.detail}`.toLowerCase().includes(q.toLowerCase());
      return kindOk && qOk;
    });
  }, [dispatched, filter, q]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Infrastructure / Command log"
        title={<>Every packet, <span className="display italic text-blush">in order.</span></>}
        serif
        description="A permanent local record of supervisor events, dispatched commands, and relay warnings. Nothing leaves this machine."
        actions={
          <>
            <Button
              variant="secondary"
              icon="download"
              onClick={() => {
                const payload = {
                  build: "8f2a1c",
                  exportedAt: new Date().toISOString(),
                  origin: "eni-01.internal",
                  events,
                  dispatches: dispatched,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "eni-01-command-log.json";
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                notify("Log exported", `${events.length} events · eni-01-command-log.json`);
              }}
            >
              Export log
            </Button>
            <Button variant="primary" icon="terminal" onClick={onTerminal}>Open terminal</Button>
          </>
        }
        meta={
          <>
            <Chip tone="ok" dot>Streaming</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">retention · 30 days</span>
            <span className="font-mono text-[9.5px] text-ink-mute">events today · {1284 + dispatched.length}</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="overflow-hidden xl:col-span-8">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <PanelHead eyebrow="Supervisor stream" title="Event history" meta={<span className="font-mono text-[9px] text-ink-mute">{String(events.length).padStart(2, "0")} shown</span>} />
            <Segmented options={kinds.map((k) => ({ id: k, label: k }))} value={filter} onChange={setFilter} />
          </div>
          <div className="border-t border-white/[0.055] p-3">
            <div className="flex h-8 items-center gap-2 rounded-[7px] border border-white/[0.06] bg-white/[0.02] px-2.5">
              <Icon name="search" size={12} className="text-ink-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter events, agents, packets…" className="h-full flex-1 bg-transparent text-[11.5px] text-ink placeholder:text-ink-mute/60 focus:outline-none" aria-label="Filter events" />
              {q && <button onClick={() => setQ("")} aria-label="Clear filter" className="text-ink-mute hover:text-ink"><Icon name="x" size={11} /></button>}
            </div>
          </div>
          <ul className="border-t border-white/[0.055]">
            {events.map((e, i) => (
              <li key={`${e.title}-${i}`} className="group flex items-start gap-3 border-b border-white/[0.045] px-5 py-3 last:border-0 hover:bg-white/[0.018]">
                <span className="mt-0.5 font-mono text-[9.5px] text-ink-mute">{e.t}</span>
                <span className={cn("mt-px flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border", e.kind === "warning" ? "border-amber/25 bg-amber/[0.08] text-amber" : e.kind === "command" ? "border-blush/20 bg-blush/[0.08] text-blush" : e.kind === "agent" ? "border-sage/20 bg-sage/[0.07] text-sage" : "border-white/[0.08] text-ink-mute")}>
                  <Icon name={e.kind === "warning" ? "bell" : e.kind === "command" ? "terminal" : e.kind === "agent" ? "bot" : "database"} size={9.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug text-ink">{e.title}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-ink-mute">{e.detail}</p>
                </div>
                <span className="ml-auto hidden shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-mute/50 sm:block">{e.kind}</span>
              </li>
            ))}
            {events.length === 0 && (
              <li className="px-5 py-14 text-center">
                <p className="text-[12.5px] text-ink-dim">No events match that filter.</p>
                <button onClick={() => { setQ(""); setFilter("All"); }} className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-blush/80 hover:text-blush">clear filters</button>
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-white/[0.055] px-5 py-3">
            <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute"><StatusDot tone="ok" /> tailing · eni-01.internal</span>
            <span className="font-mono text-[9px] text-ink-mute">sha · 4e1a…9c02</span>
          </div>
        </Panel>

        <div className="space-y-4 xl:col-span-4">
          <Panel className="p-5">
            <PanelHead eyebrow="Operator actions" title="Your dispatches" actions={<Chip tone="blush">{String(dispatched.length).padStart(2, "0")}</Chip>} />
            <div className="mt-4 space-y-1.5">
              {dispatched.length === 0 && (
                <p className="rounded-[8px] border border-dashed border-white/[0.08] px-3 py-6 text-center text-[11px] leading-relaxed text-ink-mute">No commands dispatched this session. Try the loadout console.</p>
              )}
              {dispatched.slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-[7px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                  <Icon name="terminal" size={11} className="shrink-0 text-blush" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-ink-dim">{d.label}</span>
                  <span className="font-mono text-[8.5px] text-ink-mute">{d.time}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Integrity" title="Local audit" meta={<Chip tone="ok" dot>Verified</Chip>} />
            <div className="mt-4 space-y-px overflow-hidden rounded-[9px] border border-white/[0.06] bg-white/[0.05]">
              {[
                ["Log hash", "4e1a…9c02"],
                ["Signed by", "eni-01 · owner"],
                ["Last rotation", "00:00 JST"],
                ["Disk used", "412 MB"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-[#110F13] px-3 py-2.5">
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{k}</span>
                  <span className="font-mono text-[9px] text-ink-dim">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10.5px] leading-relaxed text-ink-mute">
              <Icon name="lock" size={12} className="mt-px shrink-0 text-sage" />
              Events are simulated locally in this redesign. Wire them to the coordinator when the API is available.
            </p>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-rose/60" /><span className="h-2 w-2 rounded-full bg-amber/50" /><span className="h-2 w-2 rounded-full bg-sage/50" />
              <span className="ml-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">tail -f</span>
            </div>
            <div className="space-y-1.5 bg-black/20 px-3.5 py-3 font-mono text-[9px] leading-relaxed">
              <p className="text-ink-mute"><span className="text-sage">ok</span> coordinator heartbeat · 21ms</p>
              <p className="text-ink-mute"><span className="text-sage">ok</span> mindserver state synced</p>
              <p className="text-ink-mute"><span className="text-amber">warn</span> relay jitter · 88ms shard 03</p>
              <p className="text-ink-mute"><span className="text-blush">›</span> awaiting operator<span className="ml-0.5 inline-block h-2.5 w-[5px] animate-pulse bg-blush/70 align-middle" /></p>
            </div>
            <button onClick={onTerminal} className="w-full border-t border-white/[0.06] py-2 text-center font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute transition-colors hover:text-blush">attach to session</button>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
