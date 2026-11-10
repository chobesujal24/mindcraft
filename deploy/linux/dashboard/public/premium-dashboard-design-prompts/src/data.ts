export type PageId = "fleet" | "grind" | "build" | "addons" | "providers" | "profiles" | "runtime" | "log" | "brief";

export type IconKey =
  | "fleet"
  | "user"
  | "sliders"
  | "layers"
  | "cpu"
  | "terminal"
  | "database"
  | "zap"
  | "shield"
  | "leaf"
  | "globe"
  | "bot"
  | "spark"
  | "activity"
  | "box"
  | "server"
  | "compass";

export type NavItem = { id: PageId; label: string; icon: IconKey; hint?: string };

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { id: "fleet", label: "Fleet", icon: "fleet", hint: "01" },
      { id: "grind", label: "Grind", icon: "activity", hint: "02" },
      { id: "build", label: "Build", icon: "box", hint: "03" },
      { id: "addons", label: "Add-ons", icon: "sliders", hint: "04" },
      { id: "providers", label: "AI providers", icon: "cpu", hint: "05" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { id: "profiles", label: "Agent profiles", icon: "user" },
      { id: "runtime", label: "Runtime & cluster", icon: "server" },
      { id: "log", label: "Command log", icon: "terminal" },
    ],
  },
  {
    label: "Workspace",
    items: [{ id: "brief", label: "Upgrade brief", icon: "spark" }],
  },
];

export const pageMeta: Record<PageId, { group: string; title: string; sub: string }> = {
  fleet: { group: "Operations", title: "Fleet overview", sub: "Supervisor, workers, and live Minecraft telemetry." },
  grind: { group: "Operations", title: "Grind jobs", sub: "Deterministic collection queues that survive a reconnect." },
  build: { group: "Operations", title: "Schematic builder", sub: "Upload a blueprint and place it block by block." },
  addons: { group: "Operations", title: "Add-ons", sub: "Sakura Valkyrie loadout, modules, and direct dispatch." },
  providers: { group: "Operations", title: "AI providers", sub: "Fallback order, latency, and keys for the supervisor's mind." },
  profiles: { group: "Infrastructure", title: "Agent profiles", sub: "Personas, routing, and mounted loadouts." },
  runtime: { group: "Infrastructure", title: "Runtime & cluster", sub: "Targets, engine parameters, and deployment state." },
  log: { group: "Infrastructure", title: "Command log", sub: "Every packet you dispatched, in order." },
  brief: { group: "Workspace", title: "Upgrade brief", sub: "The prompt that rebuilds this console at a higher standard." },
};

export type Tone = "ok" | "warn" | "idle" | "down";

export type Agent = {
  id: string;
  name: string;
  role: string;
  op: string;
  status: Tone;
  state: string;
  latency: number;
  load: number;
  region: string;
  tag: string;
  accent: string;
};

export const agents: Agent[] = [
  { id: "MC-FOREMAN", name: "Mt. Fuji", role: "Primary foreman", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 21, load: 62, region: "Osaka", tag: "Pilot", accent: "#f0aec0" },
  { id: "MC-CLUSTER-01", name: "Crimson Pagoda", role: "Combat worker", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 24, load: 48, region: "Osaka", tag: "Combat", accent: "#d4768f" },
  { id: "MC-CLUSTER-02", name: "Night Castle", role: "Economy worker", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 29, load: 37, region: "Tokyo", tag: "Economy", accent: "#a9c9b4" },
  { id: "MC-CLUSTER-03", name: "Kanagawa Wave", role: "Recon worker", op: "Anarchy · 1.21.4", status: "warn", state: "Mining", latency: 88, load: 91, region: "Kanagawa", tag: "Recon", accent: "#e4c690" },
  { id: "MC-CLUSTER-04", name: "Ukiyo-e", role: "Warp scout", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 33, load: 22, region: "Kyoto", tag: "Recon", accent: "#c9b8d8" },
  { id: "MC-CLUSTER-05", name: "Blossom Seal", role: "Survival worker", op: "Anarchy · 1.21.4", status: "idle", state: "Standby", latency: 41, load: 4, region: "Osaka", tag: "Survival", accent: "#9ab0c9" },
  { id: "MC-CLUSTER-06", name: "Silver Orchard", role: "Trade runner", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 27, load: 55, region: "Tokyo", tag: "Economy", accent: "#c7c0a8" },
  { id: "MC-CLUSTER-07", name: "Yozakura", role: "Sentinel", op: "Anarchy · 1.21.4", status: "ok", state: "Active", latency: 19, load: 31, region: "Osaka", tag: "Sentinel", accent: "#f0aec0" },
];

export const services: { name: string; host: string; port: string; status: Tone; uptime: string; latency: string; note: string }[] = [
  { name: "Coordinator", host: "eni-01.internal", port: "8090", status: "ok", uptime: "14d 06h", latency: "8 ms", note: "Supervisor heartbeat healthy" },
  { name: "MindServer UI", host: "eni-01.internal", port: "8091", status: "ok", uptime: "14d 06h", latency: "11 ms", note: "Dashboard state streaming" },
  { name: "Minecraft target", host: "jp-osaka.anarchy", port: "25565", status: "ok", uptime: "3d 22h", latency: "24 ms", note: "Mount Fuji · 1.21.4" },
  { name: "Blossom relay", host: "relay.yozakura", port: "7443", status: "warn", uptime: "2d 11h", latency: "88 ms", note: "Elevated jitter on shard 03" },
  { name: "Model gateway", host: "router.local", port: "4100", status: "ok", uptime: "9d 18h", latency: "31 ms", note: "Gemini primary · DeepSeek fallback" },
];

export type Activity = { t: string; kind: "command" | "system" | "warning" | "agent"; title: string; detail: string };

export const activity: Activity[] = [
  { t: "00:18", kind: "command", title: "Warpserv life steal dispatched", detail: "mc-cluster-01 · packet 0x4C · acknowledged" },
  { t: "00:14", kind: "agent", title: "Kanagawa Wave entered the Nether", detail: "Recon route 07 · dimension changed" },
  { t: "00:11", kind: "system", title: "Golden apple reserve refilled", detail: "18 stacks · economy worker · Osaka" },
  { t: "00:07", kind: "warning", title: "Relay jitter above threshold", detail: "88 ms · shard 03 · auto-retry queued" },
  { t: "23:59", kind: "command", title: "Equip totem offhand", detail: "mc-foreman · packet 0x22 · acknowledged" },
  { t: "23:54", kind: "system", title: "Routine backup sealed", detail: "cluster state · 412 MB · verified" },
  { t: "23:48", kind: "agent", title: "Mt. Fuji relogged successfully", detail: "session restored in 2.4 s" },
];

export const stats = [
  { label: "Agents online", value: "8", suffix: "/ 8", delta: "+1", trend: "Nominal", series: [3, 4, 4, 5, 6, 6, 7, 8, 8, 8, 8, 8] },
  { label: "Fleet latency", value: "23", suffix: "ms", delta: "−6 ms", trend: "Improving", series: [48, 46, 42, 44, 38, 35, 33, 29, 30, 26, 24, 23] },
  { label: "Ops dispatched", value: "1,284", suffix: "/hr", delta: "+8.2%", trend: "Healthy", series: [820, 880, 940, 910, 1010, 1090, 1040, 1120, 1180, 1210, 1260, 1284] },
  { label: "Incidents", value: "0", suffix: "open", delta: "0", trend: "Clear", series: [2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0] },
];

export const profiles = [
  { id: "mt-fuji", name: "Mt. Fuji", sub: "Sakura Valkyrie", note: "Foreman · combat ready", mounted: true },
  { id: "crimson", name: "Crimson Pagoda", sub: "Blossom Vanguard", note: "Combat · route 02" },
  { id: "night", name: "Night Castle", sub: "Quiet Broker", note: "Economy · Osaka" },
  { id: "kanagawa", name: "Kanagawa Wave", sub: "Tide Recon", note: "Recon · Kanagawa" },
  { id: "ukiyo", name: "Ukiyo-e", sub: "Floating World", note: "Warp scout · Kyoto" },
];

export type Addon = {
  id: string;
  name: string;
  category: "Combat" | "Survival" | "Economy" | "Recon" | "System";
  description: string;
  icon: "sword" | "heart" | "leaf" | "coin" | "compass" | "shield" | "zap" | "map-pin" | "spark" | "layers" | "globe";
  enabled: boolean;
  risk: "low" | "medium" | "guarded";
  config?: { label: string; min: number; max: number; step: number; value: number; unit: string };
};

export const addons: Addon[] = [
  { id: "auto-totem", name: "Auto-Totem", category: "Combat", description: "Keeps an off-hand totem equipped using inventory and equipment APIs.", icon: "sword", enabled: true, risk: "low" },
  { id: "cps-booster", name: "CPS Booster", category: "Combat", description: "Configurable cadence for 1.8 combat mechanics. Targets nearest hostile within four blocks.", icon: "zap", enabled: true, risk: "medium" },
  { id: "sakura-guard", name: "Sakura Guard", category: "Survival", description: "Refills saturation and health from the nearest cached food source.", icon: "shield", enabled: true, risk: "low" },
  { id: "gapple-ration", name: "Gapple Ration", category: "Survival", description: "Caps golden apple usage at two per encounter to protect long-run reserves.", icon: "heart", enabled: true, risk: "low" },
  { id: "market-tide", name: "Market Tide", category: "Economy", description: "Reads shard pricing and sells inventory surplus when margins exceed 12%.", icon: "coin", enabled: true, risk: "guarded" },
  { id: "warp-weave", name: "Warp Weave", category: "Recon", description: "Chains highway stalls to shave transit time. Refuses unknown shards.", icon: "compass", enabled: true, risk: "medium" },
  { id: "petal-scan", name: "Petal Scan", category: "Recon", description: "Sweeps 32 blocks for hostiles and stores a lighter-than-air route home.", icon: "map-pin", enabled: true, risk: "low" },
  { id: "blossom-seals", name: "Blossom Seals", category: "System", description: "Applies the sentinel seal set on spawn and verifies every signature.", icon: "spark", enabled: true, risk: "low" },
  { id: "night-cache", name: "Night Cache", category: "Economy", description: "Stages inventory in a hollow stash before risky crossings.", icon: "leaf", enabled: false, risk: "guarded" },
  { id: "auto-gapple", name: "Auto-Gapple", category: "Survival", description: "Consumes a golden apple when health falls below the configured threshold.", icon: "heart", enabled: true, risk: "low", config: { label: "Heal threshold", min: 1, max: 20, step: 1, value: 14, unit: "HP" } },
  { id: "auto-armor", name: "Auto-Armor", category: "Combat", description: "Scores netherite against diamond and equips the strongest piece in every slot.", icon: "shield", enabled: true, risk: "low", config: { label: "Minimum protection", min: 1, max: 4, step: 1, value: 3, unit: "tier" } },
  { id: "panic-escape", name: "Panic Escape", category: "Survival", description: "Throws an ender pearl at 45° and retreats when health is critical.", icon: "compass", enabled: false, risk: "guarded", config: { label: "Trigger below", min: 1, max: 20, step: 1, value: 6, unit: "HP" } },
  { id: "killaura", name: "Killaura", category: "Combat", description: "Targets hostiles inside the configured radius with deterministic cadence.", icon: "sword", enabled: false, risk: "guarded", config: { label: "Attack radius", min: 1, max: 6, step: 1, value: 4, unit: "blocks" } },
  { id: "elytra-fly", name: "Elytra Fly", category: "Recon", description: "Maintains altitude with firework pacing and fails safe above unloaded chunks.", icon: "zap", enabled: false, risk: "medium" },
  { id: "scaffold", name: "Scaffold", category: "Survival", description: "Places support blocks beneath the bot while bridging over voids.", icon: "layers", enabled: false, risk: "medium" },
  { id: "esp", name: "Entity ESP", category: "Recon", description: "Highlights players, hostiles, and high-tier loot inside the scan radius.", icon: "globe", enabled: true, risk: "medium", config: { label: "Scan radius", min: 16, max: 96, step: 8, value: 32, unit: "blocks" } },
];

export const telemetry = [
  { label: "Vitality", value: 20, max: 20, unit: "HP", icon: "heart" as const, tone: "rose", note: "Full · 20 / 20" },
  { label: "Saturation", value: 18, max: 20, unit: "pts", icon: "droplet" as const, tone: "amber", note: "Regenerating" },
  { label: "Totem reserve", value: 4, max: 6, unit: "units", icon: "shield" as const, tone: "sage", note: "2 in offhand · 4 stashed" },
  { label: "Golden apples", value: 18, max: 24, unit: "stacks", icon: "coin" as const, tone: "amber", note: "Refilled 00:11" },
  { label: "Treasury", value: 92, max: 120, unit: "k", icon: "database" as const, tone: "sage", note: "Across 3 shards" },
  { label: "Active seals", value: 8, max: 9, unit: "seals", icon: "spark" as const, tone: "rose", note: "8 of 9 enabled" },
];

export const providers = [
  { name: "Gemini 3.8 Flash High", maker: "Google", role: "Primary reasoner", weight: 64, latency: "1.2 s", spend: "$18.40", status: "ok" as Tone, tags: ["Subagents", "Vision", "Long context"], note: "Subagent orchestration enabled for design, build, and QA passes." },
  { name: "DeepSeek v4.1 Flash 1017", maker: "DeepSeek", role: "Implementation partner", weight: 28, latency: "0.7 s", spend: "$4.12", status: "ok" as Tone, tags: ["Deterministic", "Code", "Fast"], note: "Handles refactors and long implementation runs with pinned temperature." },
  { name: "ENI local critic", maker: "Rust · 7B", role: "Visual QA", weight: 8, latency: "210 ms", spend: "$0.00", status: "ok" as Tone, tags: ["Screenshots", "Accessibility"], note: "Scores spacing, contrast, and hierarchy before every deploy." },
];

export const dispatchGroups = [
  {
    id: "01",
    label: "Economy & market",
    actions: [
      { id: "shop", label: "Open /shopgui", tone: "primary" as const },
      { id: "sell", label: "Run /sell all", tone: "sage" as const },
      { id: "check", label: "Check /bal", tone: "ghost" as const },
    ],
  },
  {
    id: "02",
    label: "Combat & gear reflex",
    actions: [
      { id: "totem", label: "Equip totem offhand", tone: "ghost" as const },
      { id: "gapple", label: "Consume gapple", tone: "ghost" as const },
      { id: "armor", label: "Equip best armor", tone: "ghost" as const },
      { id: "scan", label: "Scan & loot ground", tone: "ghost" as const },
    ],
  },
  {
    id: "03",
    label: "Dimensional warp & shell",
    actions: [
      { id: "warpserv", label: "Warp /serv lifesteal", tone: "primary" as const },
      { id: "randomtp", label: "Wild /randomtp", tone: "sage" as const },
      { id: "sethome", label: "/sethome base", tone: "ghost" as const },
      { id: "home", label: "/home base", tone: "ghost" as const },
    ],
  },
];
