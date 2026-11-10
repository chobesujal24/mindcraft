import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { addons, dispatchGroups, profiles, telemetry } from "../data";
import { Icon, type IconName } from "../components/icons";
import { photos, profilePhoto } from "../images";
import { Photo } from "../components/Photo";
import { PageHeader, PageShell } from "../components/Shell";
import { Avatar, Button, Chip, Divider, Eyebrow, IconButton, Meter, Panel, PanelHead, StatusDot, Toggle } from "../components/ui";

type Category = "All" | "Combat" | "Survival" | "Economy" | "Recon";

const toneMap = {
  rose: { text: "text-blush", bg: "bg-blush", border: "border-blush/20", icon: "bg-blush/[0.08] text-blush" },
  amber: { text: "text-amber", bg: "bg-amber", border: "border-amber/20", icon: "bg-amber/[0.07] text-amber" },
  sage: { text: "text-sage", bg: "bg-sage", border: "border-sage/20", icon: "bg-sage/[0.07] text-sage" },
} as const;

export function AddOns({
  enabled,
  onToggle,
  onBulk,
  onDispatch,
  notify,
  onTerminal,
  onArtwork,
}: {
  enabled: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  onBulk: (value: boolean) => void;
  onDispatch: (label: string) => void;
  notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void;
  onTerminal: () => void;
  onArtwork: () => void;
}) {
  const [category, setCategory] = useState<Category>("All");
  const [profileIdx, setProfileIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [settings, setSettings] = useState<Record<string, number>>(Object.fromEntries(addons.map((a) => [a.id, a.config?.value ?? 0])));

  const counts = useMemo(() => {
    const c: Record<Category, number> = { All: addons.length, Combat: 0, Survival: 0, Economy: 0, Recon: 0 };
    addons.forEach((a) => {
      if (a.category !== "System" && c[a.category] !== undefined) c[a.category] += 1;
    });
    return c;
  }, []);

  const enabledCount = Object.values(enabled).filter(Boolean).length;
  const filtered = showAll ? addons : addons.filter((a) => category === "All" || a.category === category);
  const profile = profiles[profileIdx];

  const armSuite = () => {
    ["auto-totem", "cps-booster", "sakura-guard", "gapple-ration"].forEach((id) => onToggle(id, true));
    notify("Combat suite armed", "4 modules enabled · Mt. Fuji · combat readiness green");
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Agents / Mt. Fuji"
        title={<>The Valkyrie, <span className="display italic text-blush">in full bloom.</span></>}
        serif
        description="Review the mounted add-ons, tune live telemetry, and dispatch server commands directly to the foreman."
        actions={
          <>
            <Button variant="ghost" icon="pause" onClick={() => onBulk(false)}>Standby all</Button>
            <Button variant="secondary" icon="check" onClick={() => { onBulk(true); notify("All modules enabled", `${addons.length} of ${addons.length} add-ons armed`); }}>Enable all</Button>
            <Button variant="primary" icon="shield" onClick={armSuite}>Arm combat suite</Button>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] py-1 pl-2 pr-2.5">
              <Avatar size={18} />
              <span className="text-[11.5px] text-ink-dim">Mt. Fuji</span>
              <Icon name="chevron-down" size={11} className="text-ink-mute" />
            </span>
            <Chip tone="ok" dot>Live · 3h 42m</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">anarchy 1.21.4 · osaka · mc-foreman</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left — pilot */}
        <div className="space-y-4">
          <Panel className="overflow-hidden !p-0">
            <div className="group relative h-[356px] overflow-hidden">
              <img
                src={photos.pilot}
                alt="Mt. Fuji in a red floral kimono, photographed beside a lit stone lantern"
                className="h-full w-full object-cover object-[46%_32%] saturate-[0.84] contrast-[1.02] brightness-[0.9] transition-transform duration-[1.4s] ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0A10] via-[#0D0A10]/20 to-[#0D0A10]/25" />
              <div className="absolute left-3.5 top-3.5 flex flex-wrap gap-1.5">
                <Chip tone="neutral" className="!bg-black/40 !backdrop-blur-md">夜桜 · editorial portrait</Chip>
              </div>

              <div className="absolute right-3.5 top-3.5"><Chip tone="ok" dot className="!bg-black/40 !backdrop-blur-md">Live state</Chip></div>
              <div className="absolute inset-x-4 bottom-4">
                <Eyebrow className="!text-[8px] !text-white/45">Pilot · foreman of the fleet</Eyebrow>
                <h2 className="display mt-1.5 text-[30px] leading-none text-white">Mt. Fuji</h2>
                <p className="mt-1.5 text-[11.5px] text-white/60">Crimson Pagoda · Sakura Valkyrie</p>
                <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5">
                  <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-white/45"><StatusDot tone="ok" size={5} /> photo · Yi Ren / Pexels</span>
                  <button onClick={onArtwork} className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-white/60 transition-colors hover:text-white">
                    <Icon name="external" size={9} /> inspect
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">Mounted profile</span>
                <span className="font-mono text-[8.5px] text-ink-mute">{String(profileIdx + 1).padStart(2, "0")} / {String(profiles.length).padStart(2, "0")}</span>
              </div>
              <div className="mt-2 flex items-center gap-2.5 rounded-[9px] border border-white/[0.07] bg-white/[0.02] p-2">
                <Photo src={profilePhoto[profile.id] ?? photos.garden} alt={profile.name} className="h-9 w-9 shrink-0 rounded-[6px]" grade="night" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] text-ink">{profile.name} · {profile.sub}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-ink-mute">{profile.note}</div>
                </div>
                <IconButton icon="chevron-left" label="Previous profile" onClick={() => setProfileIdx((i) => (i - 1 + profiles.length) % profiles.length)} />
                <IconButton icon="chevron-right" label="Next profile" onClick={() => setProfileIdx((i) => (i + 1) % profiles.length)} />
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <Button variant="secondary" icon="spark" onClick={() => notify("Profile mounted", `${profile.name} · ${profile.sub} · hot-swapped in 1.8s`)}>Activate profile</Button>
                <Button variant="quiet" size="md" onClick={onArtwork} aria-label="Inspect artwork" icon="external" />
              </div>
              <Divider className="my-3.5" />
              <div className="flex items-start gap-2.5">
                <Avatar size={30} />
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">Sentinel telemetry · 00:11</div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-dim">“Inventory and radar details surface here as soon as the bot reports them. Currently everything is accounted for.”</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow className="!text-[8px]">Readiness</Eyebrow>
                <p className="mt-1.5 text-[12.5px] text-ink">Combat loadout</p>
              </div>
              <span className="font-mono text-[18px] text-blush">{enabledCount}<span className="text-[10px] text-ink-mute">/{addons.length}</span></span>
            </div>
            <Meter value={(enabledCount / addons.length) * 100} className="mt-3" />
            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-[8px] border border-white/[0.06] bg-white/[0.05]">
              {[["Armor", "Netherite"], ["Totems", "04"], ["Gapples", "18"]].map(([k, v]) => (
                <div key={k} className="bg-[#110F13] px-2 py-2">
                  <div className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-ink-mute">{k}</div>
                  <div className="mt-1 truncate text-[10.5px] text-ink-dim">{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right */}
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {telemetry.map((t) => {
              const isActive = t.label === "Active seals";
              const value = isActive ? enabledCount : t.value;
              const max = isActive ? addons.length : t.max;
              const tone = toneMap[t.tone as keyof typeof toneMap];
              return (
                <Panel key={t.label} className="p-4 transition-colors hover:border-white/[0.11]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">{t.label}</span>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-[5px]", tone.icon)}><Icon name={t.icon as IconName} size={12} /></span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="num text-[24px] leading-none text-ink">{isActive ? String(value).padStart(2, "0") : value}</span>
                    <span className="font-mono text-[9px] text-ink-mute">/ {max} {t.unit}</span>
                  </div>
                  <Meter value={value} max={max} tone={t.tone === "rose" ? "blush" : t.tone === "amber" ? "amber" : "sage"} className="mt-3" />
                  <p className="mt-2 truncate font-mono text-[8.5px] text-ink-mute">{isActive ? `${value} of ${max} add-ons currently armed` : t.note}</p>
                </Panel>
              );
            })}
          </div>

          {/* Dispatch console */}
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <PanelHead
                eyebrow="Direct packet dispatch"
                title={<span className="flex items-center gap-2">Command console</span>}
                meta={<Chip tone="ok" dot>foreman online</Chip>}
              />
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[9px] text-ink-mute sm:inline">queue · 0 packets</span>
                <IconButton icon="terminal" label="Open terminal" onClick={onTerminal} />
              </div>
            </div>
            <div className="grid gap-px border-t border-white/[0.055] bg-white/[0.05] md:grid-cols-3">
              {dispatchGroups.map((g) => (
                <div key={g.id} className="bg-[#100E12] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-mute">{g.id} / {g.label}</span>
                    <span className="font-mono text-[8px] text-ink-mute/50">→ foreman</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.actions.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onDispatch(a.label)}
                        className={cn(
                          "flex h-[34px] w-full items-center justify-between gap-2 rounded-[7px] border px-2.5 text-[11.5px] transition-all duration-200 active:translate-y-px",
                          a.tone === "primary"
                            ? "border-blush/25 bg-blush/[0.12] text-blush-hi hover:bg-blush/[0.18]"
                            : a.tone === "sage"
                              ? "border-sage/20 bg-sage/[0.08] text-sage hover:bg-sage/[0.14]"
                              : "border-white/[0.08] bg-white/[0.025] text-ink-dim hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-ink",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon
                            name={a.id === "shop" ? "box" : a.id === "sell" ? "coin" : a.id === "check" ? "database" : a.id === "totem" ? "shield" : a.id === "gapple" ? "heart" : a.id === "armor" ? "lock" : a.id === "scan" ? "compass" : a.id === "warpserv" ? "sword" : a.id === "randomtp" ? "zap" : a.id === "sethome" ? "map-pin" : "home" as IconName}
                            size={12}
                            className="shrink-0 opacity-70"
                          />
                          <span className="truncate">{a.label}</span>
                        </span>
                        <Icon name="arrow-up-right" size={10} className="shrink-0 opacity-40" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.055] px-5 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute"><Icon name="lock" size={10} /> actions apply only to the mounted foreman</span>
              <span className="font-mono text-[9px] text-ink-mute">last packet 00:18 · ack 42ms</span>
            </div>
          </Panel>

          {/* Subsystems */}
          <Panel className="overflow-hidden">
            <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <PanelHead
                eyebrow="Sakura seals"
                title="Subsystems"
                meta={<span className="font-mono text-[9.5px] text-ink-mute"><span className="text-blush">{String(enabledCount).padStart(2, "0")}</span>/{String(addons.length).padStart(2, "0")} active</span>}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {(["All", "Combat", "Survival", "Economy", "Recon"] as Category[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[11.5px] transition-all",
                      category === c || (c === "All" && category === "All")
                        ? "border-blush/25 bg-blush/[0.1] text-blush-hi"
                        : "border-white/[0.07] bg-white/[0.02] text-ink-mute hover:border-white/[0.12] hover:text-ink-dim",
                    )}
                  >
                    {c === "All" ? "All subsystems" : c}
                    <span className="font-mono text-[8.5px] opacity-60">{String(c === "All" ? addons.length : counts[c]).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-white/[0.055]">
              {(showAll ? filtered : filtered.slice(0, 6)).map((a) => (
                <div key={a.id} className="group flex items-start gap-3 border-b border-white/[0.045] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.018] sm:items-center">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border sm:mt-0", enabled[a.id] ? "border-blush/20 bg-blush/[0.07] text-blush" : "border-white/[0.07] bg-white/[0.02] text-ink-mute")}>
                    <Icon name={a.icon} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] text-ink">{a.name}</span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{a.category}</span>
                      {a.risk !== "low" && (
                        <span className={cn("rounded-[4px] border px-1.5 py-px font-mono text-[7.5px] uppercase tracking-[0.1em]", a.risk === "guarded" ? "border-amber/20 text-amber/80" : "border-white/[0.08] text-ink-mute")}>
                          {a.risk}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 max-w-[560px] text-[11px] leading-relaxed text-ink-mute">{a.description}</p>
                    {a.config && (
                      <div className={cn("mt-2 flex max-w-[330px] items-center gap-2.5 transition-opacity", enabled[a.id] ? "opacity-100" : "opacity-45")}>
                        <span className="w-[86px] shrink-0 font-mono text-[7.5px] uppercase tracking-[0.1em] text-ink-mute">{a.config.label}</span>
                        <input
                          type="range"
                          min={a.config.min}
                          max={a.config.max}
                          step={a.config.step}
                          value={settings[a.id]}
                          onChange={(e) => setSettings((s) => ({ ...s, [a.id]: Number(e.target.value) }))}
                          className="slider"
                          aria-label={`${a.name}: ${a.config.label}`}
                          aria-valuetext={`${settings[a.id]} ${a.config.unit}`}
                        />
                        <span className="w-[54px] shrink-0 text-right font-mono text-[9px] text-blush/90">{settings[a.id]} {a.config.unit}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className={cn("hidden font-mono text-[8px] uppercase tracking-[0.12em] sm:inline", enabled[a.id] ? "text-sage" : "text-ink-mute/60")}>
                      {enabled[a.id] ? "armed" : "standby"}
                    </span>
                    <Toggle
                      checked={!!enabled[a.id]}
                      onChange={(v) => {
                        onToggle(a.id, v);
                        notify(`${a.name} ${v ? "armed" : "standby"}`, `${a.category} · ${profile.name}`, v ? "ok" : "info");
                      }}
                      label={`Toggle ${a.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.014] px-5 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute"><StatusDot tone="ok" /> Changes apply on next supervisor tick · up to 2s</span>
              <div className="flex items-center gap-3">
                <button onClick={() => onBulk(true)} className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-blush">arm all</button>
                <button onClick={() => onBulk(false)} className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim transition-colors hover:text-blush">standby all</button>
                <button onClick={() => setShowAll((s) => !s)} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:text-ink">
                  {showAll ? "show less" : "all modules"} <Icon name="chevron-down" size={10} className={cn("transition-transform", showAll && "rotate-180")} />
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <PanelHead
                eyebrow="Recon & magnet"
                title="Nearby players & threat radar"
                meta={<Chip tone="warn" dot>1 hostile</Chip>}
              />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8.5px] text-ink-mute">52 block radius</span>
                <Button variant="quiet" size="sm" icon="refresh" onClick={() => notify("Radar refreshed", "4 entities in range · last sweep 0.4s ago")}>Refresh</Button>
              </div>
            </div>
            <div className="grid gap-px border-t border-white/[0.055] bg-white/[0.05] md:grid-cols-[220px_1fr]">
              <div className="bg-[#100E12] p-4">
                <svg viewBox="0 0 180 180" className="w-full" role="img" aria-label="Threat radar showing four nearby players">
                  <defs>
                    <linearGradient id="threat-sweep" x1="0" y1="0" x2="1" y2="0.5">
                      <stop offset="0%" stopColor="#F0AEC0" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#F0AEC0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[26, 48, 70].map((r) => <circle key={r} cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" strokeDasharray="2 4" />)}
                  <circle cx="90" cy="90" r="78" fill="none" stroke="rgba(255,255,255,.09)" />
                  <line x1="12" y1="90" x2="168" y2="90" stroke="rgba(255,255,255,.05)" />
                  <line x1="90" y1="12" x2="90" y2="168" stroke="rgba(255,255,255,.05)" />
                  <g style={{ transformOrigin: "90px 90px" }} className="motion-safe:animate-[sweep_8s_linear_infinite]">
                    <path d="M90 90 L90 12 A78 78 0 0 1 158 50 Z" fill="url(#threat-sweep)" />
                  </g>
                  <circle cx="90" cy="90" r="3" fill="#F0AEC0" />
                  {[
                    [124, 64, "#E38B95", "K"],
                    [58, 112, "#A9C9B4", "R"],
                    [110, 132, "#837B86", "S"],
                    [72, 58, "#A9C9B4", "M"],
                  ].map(([x, y, color, label], i) => (
                    <g key={i}>
                      <circle cx={Number(x)} cy={Number(y)} r="8" fill={String(color)} fillOpacity="0.1" stroke={String(color)} strokeOpacity="0.45" strokeWidth="0.8" />
                      <text x={Number(x)} y={Number(y) + 2.6} textAnchor="middle" fill={String(color)} fontSize="7" fontFamily="JetBrains Mono, monospace">{String(label)}</text>
                    </g>
                  ))}
                  <text x="90" y="176" textAnchor="middle" fill="rgba(255,255,255,.28)" fontSize="6.5" fontFamily="JetBrains Mono, monospace">ORIGIN · MT. FUJI</text>
                </svg>
              </div>
              <div className="overflow-x-auto bg-[#100E12]">
                <table className="w-full min-w-[440px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.055] font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">
                      <th className="px-3 py-2 font-normal">Player</th>
                      <th className="px-3 py-2 font-normal">Dist</th>
                      <th className="px-3 py-2 font-normal">XYZ</th>
                      <th className="px-3 py-2 font-normal">Held</th>
                      <th className="px-3 py-2 font-normal">Stance</th>
                      <th className="px-3 py-2 text-right font-normal">Threat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Kaze_88", "18", "124 · 66 · 82", "Netherite sword", "Sprinting", "Hostile", "down"],
                      ["Rin_tsuki", "31", "64 · 68 · 119", "Bow", "Sneaking", "Watching", "warn"],
                      ["SoraBuilds", "44", "148 · 71 · −6", "Oak planks", "Walking", "Neutral", "ok"],
                      ["Momo_", "47", "22 · 64 · 96", "Empty", "Idle", "Neutral", "ok"],
                    ].map(([name, dist, xyz, held, stance, threat, tone]) => (
                      <tr key={name} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-[10.5px] text-ink">{name}</td>
                        <td className="px-3 py-2.5 font-mono text-[9px] text-ink-dim">{dist}b</td>
                        <td className="px-3 py-2.5 font-mono text-[8.5px] text-ink-mute">{xyz}</td>
                        <td className="px-3 py-2.5 text-[10px] text-ink-dim">{held}</td>
                        <td className="px-3 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-ink-mute">{stance}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn("inline-flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.1em]", tone === "down" ? "text-rose" : tone === "warn" ? "text-amber" : "text-sage")}>
                            <StatusDot tone={tone === "down" ? "down" : tone === "warn" ? "warn" : "ok"} size={5} /> {threat}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[8.5px] text-ink-mute"><Icon name="lock" size={10} /> scan results are informational; auto-defence stays off unless Killaura is armed</span>
              <span className="font-mono text-[8.5px] text-ink-mute">last sweep · 0.4s ago</span>
            </div>
          </Panel>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute/50">
            <span>rules apply to this agent only</span>
            <span>sakura border beam marks the mounted persona</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
