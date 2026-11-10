import { useState } from "react";
import { cn } from "../utils/cn";
import { activity, agents, profiles, services, stats, type PageId } from "../data";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { AvatarPhoto, Credit, Photo } from "../components/Photo";
import { photos, profilePhoto, agentPhoto } from "../images";
import { Button, Chip, Divider, Eyebrow, IconButton, Meter, Panel, PanelHead, Sparkline, StatusDot } from "../components/ui";

/* ------------------------------------------------------------------ */
/* Radar                                                               */
/* ------------------------------------------------------------------ */
const blips = [
  { id: "MC-FOREMAN", name: "Mt. Fuji", x: 196, y: 122, a: true, latency: 21, load: 62, coords: "142 · −38" },
  { id: "MC-CLUSTER-01", name: "Crimson Pagoda", x: 148, y: 176, latency: 24, load: 48, coords: "−14 · 62" },
  { id: "MC-CLUSTER-02", name: "Night Castle", x: 236, y: 168, latency: 29, load: 37, coords: "78 · 41" },
  { id: "MC-CLUSTER-03", name: "Kanagawa Wave", x: 118, y: 118, latency: 88, load: 91, coords: "−96 · −54" },
  { id: "MC-CLUSTER-04", name: "Ukiyo-e", x: 214, y: 208, latency: 33, load: 22, coords: "52 · 94" },
];

function Radar() {
  const [selected, setSelected] = useState(blips[0]);
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      <div className="relative flex-1 overflow-hidden rounded-[12px] border border-white/[0.055] bg-[#0C0A0E]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-3.5 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
            <StatusDot tone="ok" /> sakura perimeter · 32m
          </span>
          <span className="font-mono text-[9px] text-ink-mute">origin 0,0</span>
        </div>
        <svg viewBox="0 0 360 290" className="block w-full" role="img" aria-label="Spatial radar of eight agents within a 32 block perimeter">
          <defs>
            <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F0AEC0" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#F0AEC0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sweep-fill" x1="0" y1="0" x2="1" y2="0.4">
              <stop offset="0%" stopColor="#F0AEC0" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#F0AEC0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="180" cy="145" r="132" fill="url(#radar-glow)" />
          {[44, 80, 116].map((r) => (
            <circle key={r} cx="180" cy="145" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" strokeDasharray={r === 116 ? "none" : "2 4"} />
          ))}
          <circle cx="180" cy="145" r="132" fill="none" stroke="rgba(255,255,255,.055)" />
          <line x1="48" y1="145" x2="312" y2="145" stroke="rgba(255,255,255,.045)" />
          <line x1="180" y1="13" x2="180" y2="277" stroke="rgba(255,255,255,.045)" />
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i / 36) * Math.PI * 2;
            const major = i % 9 === 0;
            const r1 = 132;
            const r2 = major ? 122 : 127;
            return (
              <line
                key={i}
                x1={180 + Math.cos(angle) * r1}
                y1={145 + Math.sin(angle) * r1}
                x2={180 + Math.cos(angle) * r2}
                y2={145 + Math.sin(angle) * r2}
                stroke={major ? "rgba(240,174,192,.3)" : "rgba(255,255,255,.1)"}
                strokeWidth="1"
              />
            );
          })}
          <g style={{ transformOrigin: "180px 145px" }} className="motion-safe:animate-[sweep_9s_linear_infinite]">
            <path d="M180 145 L180 13 A132 132 0 0 1 293 79 Z" fill="url(#sweep-fill)" />
            <line x1="180" y1="145" x2="180" y2="13" stroke="#F0AEC0" strokeOpacity="0.35" strokeWidth="1" />
          </g>
          {[["N", 180, 26], ["E", 302, 149], ["S", 180, 272], ["W", 58, 149]].map(([t, x, y]) => (
            <text key={String(t)} x={Number(x)} y={Number(y)} textAnchor="middle" fill="rgba(255,255,255,.28)" fontSize="7" fontFamily="JetBrains Mono, monospace" letterSpacing="1">
              {t}
            </text>
          ))}
          <circle cx="180" cy="145" r="4" fill="#F0AEC0" />
          <circle cx="180" cy="145" r="10" fill="none" stroke="#F0AEC0" strokeOpacity=".25" />
          {blips.map((b) => {
            const active = selected.id === b.id;
            return (
              <g
                key={b.id}
                onClick={() => setSelected(b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(b);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:opacity-80"
                tabIndex={0}
                role="button"
                aria-label={`Select ${b.name}, ${b.load} percent load, ${b.latency} milliseconds`}
              >
                {active && <circle cx={b.x} cy={b.y} r="14" fill="#F0AEC0" fillOpacity=".09" stroke="#F0AEC0" strokeOpacity=".3" strokeWidth=".8" />}
                <circle cx={b.x} cy={b.y} r="3.2" fill={b.id === "MC-CLUSTER-03" ? "#E4C690" : "#F0AEC0"} />
                <circle cx={b.x} cy={b.y} r="7.5" fill="none" stroke={active ? "#F0AEC0" : "rgba(240,174,192,.3)"} strokeWidth=".7" />
                <text x={b.x + 10} y={b.y + 3} fill={active ? "#F3EDE8" : "rgba(243,237,232,.5)"} fontSize="7.5" fontFamily="JetBrains Mono, monospace">
                  {b.name.split(" ")[0]}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] px-3.5 py-2.5">
          <span className="truncate font-mono text-[9.5px] text-ink-mute">
            selected · <span className="text-ink-dim">{selected.name}</span>
          </span>
          <span className="shrink-0 font-mono text-[9.5px] text-ink-mute">
            {selected.coords} · <span className={selected.latency > 60 ? "text-amber" : "text-sage"}>{selected.latency}ms</span>
          </span>
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-[188px]">
        <Eyebrow className="mb-2 !text-[8.5px]">Within perimeter</Eyebrow>
        <ul className="space-y-px">
          {blips.map((b) => {
            const active = selected.id === b.id;
            return (
              <li key={b.id}>
                <button
                  onClick={() => setSelected(b)}
                  className={cn("group flex w-full items-center gap-2 rounded-[7px] px-1.5 py-[7px] text-left transition-colors", active ? "bg-white/[0.05]" : "hover:bg-white/[0.025]")}
                >
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", b.id === "MC-CLUSTER-03" ? "bg-amber" : active ? "bg-blush" : "bg-blush/40")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[11.5px]", active ? "text-ink" : "text-ink-dim")}>{b.name}</span>
                    <Meter value={b.load} tone={b.load > 80 ? "amber" : "blush"} className="mt-1.5 !h-[2px]" />
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-ink-mute">{b.load}%</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 rounded-[8px] border border-white/[0.055] bg-white/[0.02] px-2.5 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">Blips</span>
            <span className="font-mono text-[9px] text-ink-dim">08 / 08</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">Cluster load</span>
            <span className="font-mono text-[9px] text-sage">46%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fleet page                                                          */
/* ------------------------------------------------------------------ */
export function Fleet({
  onNavigate,
  onTerminal,
  notify,
  ambience,
  onArtwork,
}: {
  onNavigate: (p: PageId) => void;
  onTerminal: () => void;
  notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void;
  ambience: boolean;
  onArtwork: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");

  const sync = () => {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      notify("Fleet synced", "8 agents · 3 shards · 23 ms median latency");
    }, 900);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Fleet overview"
        title={<>Every agent, <span className="display italic text-blush">accounted for.</span></>}
        serif
        description="A live view of the ENI supervisor, eight workers, and Minecraft telemetry across three shards. Quiet until it isn't."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={sync} disabled={syncing}>
              {syncing ? "Syncing…" : "Refresh"}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => notify("Deploy queued", "Night Castle · new worker provisioning", "info")}>
              Deploy agent
            </Button>
          </>
        }
        meta={
          <>
            <span className="flex items-center gap-2 text-[11.5px] text-ink-mute"><StatusDot tone="ok" /> Last sync 12s ago</span>
            <span className="h-3 w-px bg-white/[0.08]" />
            <span className="font-mono text-[10px] text-ink-mute">00:21:04 JST</span>
            <span className="h-3 w-px bg-white/[0.08]" />
            <span className="font-mono text-[10px] text-ink-mute">origin · eni-01.internal</span>
          </>
        }
      />

      {/* Hero */}
      <section className="relative mt-7 overflow-hidden rounded-[18px] border border-white/[0.08] bg-panel anim-fade-up">
        <img
          src={photos.heroNight}
          alt="Illuminated cherry blossoms reflected in still water after dark"
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-cover object-center saturate-[0.72] contrast-[1.05] brightness-[0.8] transition-opacity duration-700",
            ambience ? "opacity-[0.55]" : "opacity-[0.28]",
          )}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0D0B0F] via-[#0D0B0F]/92 to-[#0D0B0F]/45" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D0B0F] via-transparent to-transparent" />
        <Credit className="absolute bottom-2.5 right-3.5 !text-white/25">Photo · Guohua Song / Pexels</Credit>

        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_300px] lg:p-9">
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="ok" dot>All systems nominal</Chip>
                <Chip tone="neutral">Night pavilion</Chip>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">Yozakura · shard 01</span>
              </div>
              <h2 className="display mt-6 max-w-[520px] text-[32px] leading-[1.06] text-ink sm:text-[42px]">
                The night is quiet.
                <br />
                <span className="text-blush/90">Everything is holding.</span>
              </h2>
              <p className="mt-4 max-w-[440px] text-[13px] leading-relaxed text-ink-dim">
                Mt. Fuji is on duty, seven workers are responding, and the blossom relay is carrying a little jitter. Nothing requires you yet.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              {[
                ["Agents", "8 / 8"],
                ["Median latency", "23 ms"],
                ["Open incidents", "0"],
                ["Uptime", "14d 06h"],
              ].map(([label, value], i) => (
                <div key={label} className="flex items-center gap-7">
                  <div>
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">{label}</div>
                    <div className="num mt-1 text-[19px] text-ink">{value}</div>
                  </div>
                  {i < 3 && <span className="h-7 w-px bg-white/[0.09]" />}
                </div>
              ))}
            </div>
          </div>

          {/* Pilot card */}
          <div className="relative overflow-hidden rounded-[13px] border border-white/[0.1] bg-black/30 backdrop-blur-sm">
            <div className="group relative h-[178px] overflow-hidden">
              <img src={photos.fuji} alt="Mount Fuji and Chureito Pagoda framed by cherry blossoms" className="h-full w-full object-cover object-[52%_42%] saturate-[0.78] contrast-[1.05] brightness-[0.82] transition-transform duration-[1400ms] group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-[#160F16]/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F0C11] via-[#0F0C11]/15 to-transparent" />
              <Credit className="absolute bottom-1.5 right-2.5 !text-white/30">Tamanaha / Pexels</Credit>
              <div className="absolute left-3 top-3"><Chip tone="blush" dot>On duty</Chip></div>
              <button onClick={onArtwork} className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/70 backdrop-blur transition-colors hover:border-white/30 hover:text-white">
                <Icon name="external" size={9} /> 4K
              </button>
            </div>
            <div className="px-4 pb-4 pt-3">
              <Eyebrow className="!text-[8px]">Pilot · mc-foreman</Eyebrow>
              <p className="display mt-1.5 text-[23px] leading-tight text-ink">Mt. Fuji</p>
              <p className="mt-0.5 text-[11.5px] text-ink-dim">Sakura Valkyrie · Osaka</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3">
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-sage"><StatusDot tone="ok" /> responding</span>
                <button onClick={() => onNavigate("addons")} className="flex items-center gap-1 text-[10.5px] text-ink-dim transition-colors hover:text-blush">
                  Loadout <Icon name="arrow-up-right" size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <Panel
            key={s.label}
            style={{ animationDelay: `${i * 55}ms` }}
            className={cn("group p-5 anim-fade-up transition-colors duration-300 hover:border-white/[0.11]", i === 0 && "bg-gradient-to-br from-blush/[0.055] to-transparent")}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Eyebrow className="!text-[8.5px]">{s.label}</Eyebrow>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="num text-[28px] leading-none text-ink">{s.value}</span>
                  <span className="font-mono text-[10px] text-ink-mute">{s.suffix}</span>
                </div>
              </div>
              <Sparkline data={s.series} width={84} height={34} color={i === 0 ? "#F0AEC0" : i === 1 ? "#A9C9B4" : i === 2 ? "#C9B8D8" : "#8C8590"} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className={cn("inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em]", s.label === "Fleet latency" || s.label === "Incidents" ? "text-sage" : "text-ink-mute")}>
                <Icon name={s.label === "Fleet latency" ? "activity" : s.label === "Incidents" ? "shield" : "arrow-up-right"} size={10} />
                {s.delta} <span className="text-ink-mute/70">this week</span>
              </span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute/60">{s.trend}</span>
            </div>
          </Panel>
        ))}
      </div>

      {/* Profiles rail + bot cluster */}
      <Panel className="mt-4 p-5 sm:p-6">
        <PanelHead
          eyebrow="Commander profile"
          title="Agent profiles"
          meta={<Chip tone="blush" dot>Mt. Fuji mounted</Chip>}
          actions={<Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNavigate("profiles")}>Manage profiles</Button>}
        />
        <div className="hide-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => onNavigate("profiles")}
              className={cn(
                "group relative h-[116px] w-[212px] shrink-0 snap-start overflow-hidden rounded-[10px] border text-left transition-all duration-300 hover:-translate-y-px",
                p.mounted ? "border-blush/35" : "border-white/[0.08] hover:border-white/[0.2]",
              )}
            >
              <Photo src={profilePhoto[p.id] ?? photos.garden} alt={`${p.name} — ${p.sub}`} className="absolute inset-0 h-full w-full" grade="night" />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A080C] via-[#0A080C]/40 to-transparent" />
              <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                {p.mounted ? <Chip tone="blush" dot>Mounted</Chip> : <span className="rounded-full border border-white/15 bg-black/35 px-2 py-[3px] font-mono text-[8px] uppercase tracking-[0.1em] text-white/60 backdrop-blur">Standby</span>}
              </span>
              <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur">
                <Icon name="arrow-up-right" size={10} />
              </span>
              <span className="absolute inset-x-2.5 bottom-2">
                <span className="block truncate text-[12px] text-white">{p.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/50">{p.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.055] pt-3">
          <span className="font-mono text-[8.5px] text-ink-mute">Activating a profile restarts mc-foreman · swap cost 1.8s</span>
          <button onClick={onArtwork} className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-blush">
            <Icon name="external" size={10} /> inspect artwork
          </button>
        </div>
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
          <PanelHead
            eyebrow="Bot cluster"
            title="Workers in the pavilion"
            meta={<Chip tone="ok" dot>{agents.length} responding</Chip>}
          />
          <div className="flex items-center gap-2">
            <Button variant="quiet" size="sm" icon="server" onClick={() => onNavigate("runtime")}>Runtime config</Button>
            <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNavigate("profiles")}>Registry</Button>
          </div>
        </div>
        <div className="grid gap-px border-t border-white/[0.055] bg-white/[0.05] sm:grid-cols-2 xl:grid-cols-4">
          {agents.slice(0, 4).map((a) => (
            <div key={a.id} className="bg-[#100E12] p-4 transition-colors hover:bg-[#141117]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AvatarPhoto src={agentPhoto[a.id]} alt={`${a.name}, ${a.role}`} size={34} />
                  <div className="min-w-0">
                    <div className="truncate text-[11.5px] text-ink">{a.name}</div>
                    <div className="font-mono text-[8px] text-ink-mute">{a.id}</div>
                  </div>
                </div>
                <Chip tone={a.status === "warn" ? "warn" : a.status === "idle" ? "idle" : "ok"} dot>{a.state}</Chip>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Icon name="heart" size={10} className="text-rose/80" />
                <Meter value={a.load > 80 ? 62 : 96} tone={a.load > 80 ? "amber" : "sage"} className="flex-1 !h-[2px]" />
                <span className="font-mono text-[8px] text-ink-mute">20 / 20</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[8.5px] text-ink-mute">
                <span>Overworld · {a.load > 80 ? "−54" : "64"}</span>
                <span className={a.latency > 60 ? "text-amber" : "text-sage"}>{a.latency} ms</span>
              </div>
              <p className="mt-2 truncate border-t border-white/[0.05] pt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-mute">{a.status === "warn" ? "mining · route 03 · high load" : `${a.role.toLowerCase()} · nominal`}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Radar + activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="p-5 sm:p-6 xl:col-span-7">
          <PanelHead
            eyebrow="Spatial telemetry"
            title="Live fleet radar"
            meta={<Chip tone="neutral">32m</Chip>}
            actions={
              <>
                <div className="flex items-center gap-0.5 rounded-[7px] border border-white/[0.06] bg-white/[0.02] p-0.5">
                  {(["Radar", "Bots"] as const).map((m) => (
                    <button key={m} className={cn("rounded-[5px] px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors", m === "Radar" ? "bg-white/[0.07] text-ink" : "text-ink-mute hover:text-ink-dim")}>{m}</button>
                  ))}
                </div>
                <IconButton icon="dots" label="Radar options" />
              </>
            }
          />
          <div className="mt-5"><Radar /></div>
        </Panel>

        <Panel className="flex flex-col p-5 sm:p-6 xl:col-span-5">
          <PanelHead
            eyebrow="Supervisor stream"
            title="Live activity"
            meta={<span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-sage"><StatusDot tone="ok" /> Live</span>}
            actions={<IconButton icon="filter" label="Filter activity" />}
          />
          <ul className="mt-5 flex-1">
            {activity.slice(0, 5).map((a, i) => (
              <li key={i} className="group relative flex gap-3.5 pb-4 last:pb-0">
                {i < 4 && <span className="absolute left-[9px] top-6 h-full w-px bg-white/[0.06]" />}
                <span
                  className={cn(
                    "relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border",
                    a.kind === "warning"
                      ? "border-amber/25 bg-amber/[0.1] text-amber"
                      : a.kind === "command"
                        ? "border-blush/20 bg-blush/[0.09] text-blush"
                        : a.kind === "agent"
                          ? "border-sage/20 bg-sage/[0.08] text-sage"
                          : "border-white/[0.08] bg-white/[0.03] text-ink-mute",
                  )}
                >
                  <Icon name={a.kind === "warning" ? "bell" : a.kind === "command" ? "terminal" : a.kind === "agent" ? "bot" : "database"} size={9.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[12px] leading-snug text-ink">{a.title}</p>
                    <span className="mt-px shrink-0 font-mono text-[9px] text-ink-mute">{a.t}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-ink-mute">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <Divider className="mt-4 mb-3" />
          <div className="flex items-center justify-between">
            <button onClick={() => onNavigate("log")} className="group flex items-center gap-1.5 text-[11.5px] text-ink-dim transition-colors hover:text-blush">
              Open command log <Icon name="arrow-right" size={12} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <span className="font-mono text-[9px] text-ink-mute">1,284 events today</span>
          </div>
        </Panel>
      </div>

      {/* Services */}
      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6">
          <PanelHead
            eyebrow="Control plane"
            title="System services"
            meta={<Chip tone="ok" dot>4 nominal · 1 warning</Chip>}
          />
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-0.5 rounded-[7px] border border-white/[0.06] p-0.5 sm:flex">
              {(["24h", "7d", "30d"] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={cn("rounded-[5px] px-2 py-1 font-mono text-[9px] transition-colors", range === r ? "bg-white/[0.07] text-ink" : "text-ink-mute hover:text-ink-dim")}>{r}</button>
              ))}
            </div>
            <Button variant="quiet" size="sm" icon="external" onClick={() => notify("Service directory opened", "eni-01.internal · 5 endpoints", "info")}>Directory</Button>
          </div>
        </div>
        <div className="hidden grid-cols-[1.4fr_1fr_110px_90px_80px] gap-4 border-y border-white/[0.055] bg-white/[0.014] px-6 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute md:grid">
          <span>Service</span><span>Endpoint</span><span>Status</span><span>Uptime</span><span className="text-right">Latency</span>
        </div>
        <ul>
          {services.map((s) => (
            <li key={s.name} className="group grid grid-cols-2 items-center gap-x-4 gap-y-2 border-b border-white/[0.045] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.018] sm:px-6 md:grid-cols-[1.4fr_1fr_110px_90px_80px]">
              <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border", s.status === "warn" ? "border-amber/20 bg-amber/[0.06] text-amber" : "border-white/[0.07] bg-white/[0.025] text-ink-dim")}>
                  <Icon name={s.name === "Minecraft target" ? "globe" : s.name === "Model gateway" ? "cpu" : s.name === "Blossom relay" ? "radio" : "server"} size={13} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-ink">{s.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-ink-mute md:hidden">{s.note}</div>
                </div>
              </div>
              <div className="hidden min-w-0 font-mono text-[10px] text-ink-mute md:block">
                <span className="truncate text-ink-dim">{s.host}</span><span className="text-ink-mute">:{s.port}</span>
              </div>
              <div>
                <Chip tone={s.status === "ok" ? "ok" : "warn"} dot>{s.status === "ok" ? "Nominal" : "Degraded"}</Chip>
              </div>
              <span className="hidden font-mono text-[10px] text-ink-dim md:block">{s.uptime}</span>
              <div className="flex items-center justify-end gap-3">
                <span className={cn("font-mono text-[10.5px]", s.status === "warn" ? "text-amber" : "text-ink-dim")}>{s.latency}</span>
                <Icon name="chevron-right" size={12} className="text-ink-mute/50 transition-colors group-hover:text-ink-mute" />
              </div>
              <p className="col-span-2 -mt-1 hidden text-[10.5px] text-ink-mute md:col-span-5 md:block md:pl-10">{s.note}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.055] px-5 py-3 sm:px-6">
          <span className="font-mono text-[9px] text-ink-mute">Coordinator :8090 · MindServer UI :8091</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[9px] text-ink-mute">
            <span>Updated 12s ago</span>
            <span className="h-3 w-px bg-white/[0.09]" aria-hidden="true" />
            <button onClick={sync} className="uppercase tracking-[0.1em] text-ink-dim transition-colors hover:text-blush">resync</button>
            <button onClick={() => notify("Workers started", "8 workers attached · supervisor tick complete")} className="uppercase tracking-[0.1em] text-ink-dim transition-colors hover:text-blush">start workers</button>
            <button onClick={() => notify("ENI restarted", "Supervisor resumed in 4.2s · 8 agents reattached", "warn")} className="uppercase tracking-[0.1em] text-ink-dim transition-colors hover:text-amber">restart eni</button>
          </div>
        </div>
      </Panel>

      {/* Topology + operator notes */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="p-5 sm:p-6 xl:col-span-8">
          <PanelHead eyebrow="Runtime" title="Cluster topology" meta={<Chip tone="neutral">3 regions</Chip>} actions={<Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNavigate("brief")}>Upgrade brief</Button>} />
          <div className="mt-5 grid gap-px overflow-hidden rounded-[11px] border border-white/[0.06] bg-white/[0.055] sm:grid-cols-3">
            {[
              { title: "Control plane", nodes: [{ n: "Coordinator", d: ":8090", t: "ok" }, { n: "MindServer", d: ":8091", t: "ok" }, { n: "Model gateway", d: ":4100", t: "ok" }] },
              { title: "Workers", nodes: agents.slice(0, 4).map((a) => ({ n: a.name, d: a.region, t: a.status === "warn" ? "warn" : "ok" })) },
              { title: "Targets", nodes: [{ n: "Minecraft JP", d: "24 ms", t: "ok" }, { n: "Blossom relay", d: "88 ms", t: "warn" }, { n: "Night cache", d: "sealed", t: "idle" }] },
            ].map((col) => (
              <div key={col.title} className="bg-[#100E12] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">{col.title}</span>
                  <span className="font-mono text-[8.5px] text-ink-mute/60">{String(col.nodes.length).padStart(2, "0")}</span>
                </div>
                <ul className="space-y-1.5">
                  {col.nodes.map((n) => (
                    <li key={n.n} className="flex items-center gap-2 rounded-[6px] border border-white/[0.055] bg-white/[0.02] px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      <StatusDot tone={n.t === "warn" ? "warn" : n.t === "idle" ? "idle" : "ok"} size={5} />
                      <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-dim">{n.n}</span>
                      <span className="shrink-0 font-mono text-[8.5px] text-ink-mute">{n.d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {["All domains", "Network", "Engine", "Cluster"].map((d, i) => (
                <span key={d} className={cn("rounded-[6px] border px-2 py-1 font-mono text-[8.5px] uppercase tracking-wider", i === 0 ? "border-white/[0.1] bg-white/[0.05] text-ink-dim" : "border-white/[0.05] text-ink-mute")}>{d}</span>
              ))}
            </div>
            <button onClick={onTerminal} className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute transition-colors hover:text-blush">
              <Icon name="terminal" size={11} /> open terminal
            </button>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between p-5 sm:p-6 xl:col-span-4">
          <div>
            <PanelHead eyebrow="Pilot channel" title="Sentinel note" actions={<Chip tone="blush">Mt. Fuji</Chip>} />
            <div className="mt-5 flex gap-3">
              <AvatarPhoto src={photos.fuji} alt="Mount Fuji" size={38} ring />
              <div className="min-w-0">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">00:19 JST · relay</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">
                  “Nether route 07 is clear. I kept Kanagawa Wave close to the portal and shelved the surplus in the night cache. No players within forty blocks.”
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[9px] border border-white/[0.06] bg-white/[0.05]">
              {[["Route", "Nether · 07"], ["Cache", "Sealed"], ["Players seen", "0"], ["Session", "3h 42m"]].map(([k, v]) => (
                <div key={k} className="bg-[#110F13] px-3 py-2.5">
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{k}</div>
                  <div className="mt-1 text-[11.5px] text-ink-dim">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" icon="terminal" onClick={onTerminal} className="w-full justify-between">
              Ask the supervisor <Kbd />
            </Button>
            <button onClick={() => onNavigate("addons")} className="link-underline mx-auto mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute transition-colors hover:text-ink">
              View loadout
            </button>
          </div>
        </Panel>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.055] pt-5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute/60">Yozakura · blossom control · production</span>
        <div className="flex flex-wrap items-center gap-4 font-mono text-[9px] text-ink-mute/60">
          <span>build 8f2a1c</span>
          <span>⌘K palette</span>
          <span>last deploy 2h ago</span>
          <span className="text-ink-mute/45">photography · Pexels · Guohua Song, Yi Ren</span>
        </div>
      </footer>
    </PageShell>
  );
}

function Kbd() {
  return <span className="font-mono text-[9px] text-ink-mute">↵</span>;
}
