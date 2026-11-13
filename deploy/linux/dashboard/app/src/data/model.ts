/* UI data model for the Yozakura Console.
   Types mirror the supervisor API shapes in data/types.ts, adapted for display.
   Everything here is derived from the live supervisor API. */

export type View = "fleet" | "grind" | "build" | "addons" | "providers" | "settings";
export const VIEWS: View[] = ["fleet", "grind", "build", "addons", "providers", "settings"];

export type Service = {
  name: string;
  role: string;
  state: "active" | "inactive" | "restarting";
  pid: number | null;
  cpu: number | null;
  mem: number | null; // bytes
  startedAt: number | null;
};

export type BotState = "active" | "idle" | "warning" | "offline" | "stale";

export type FleetBot = {
  id: string;
  name: string;
  role: string;
  /** The systemd unit that runs this agent. */
  unit: string;
  avatar?: string;
  health: number | null; // 0..20
  food: number | null; // 0..20
  x: number | null;
  y: number | null;
  z: number | null;
  dimension: string | null;
  ping: number | null;
  basePing: number | null;
  activity: string;
  state: BotState;
};

export type Profile = {
  file: string;
  name: string;
  model: string;
  online: boolean;
  note: string;
};

export type Threat = {
  username: string;
  distance: number;
  bearing: number; // radians, relative to the agent
  heldItem: string;
  sneaking: boolean;
};

export type JobStatus =
  | "queued"
  | "submitted"
  | "running"
  | "pausing"
  | "paused"
  | "blocked"
  | "cancelling"
  | "completed"
  | "cancelled"
  | "failed";

export type GrindJob = {
  id: string;
  target: string;
  requested: number;
  completed: number;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  message: string;
};

export type Material = { block: string; need: number; missing: boolean };

export type BuildJob = {
  id: string;
  fileName: string;
  name: string;
  status: JobStatus;
  totalBlocks: number;
  placed: number;
  skipped: number;
  layers: number;
  size: [number, number, number]; // width, height, depth
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** null means "place at the builder's current position". */
  origin: { x: number; y: number; z: number } | null;
  rotation: number;
  replaceBlocks: boolean;
  materials: Material[];
  message: string;
};

export type AddonDef = {
  id: string;
  name: string;
  category: "Combat" | "Survival" | "Recon" | "Economy" | "System";
  description: string;
  risk: "low" | "medium" | "guarded";
  managed?: boolean;
  setting?: { key: string; label: string; min: number; max: number; step: number; unit: string };
};

export type DispatchAction = {
  label: string;
  action: string;
  command?: string;
  /** Add-on that must be armed for this action to do anything. */
  requires?: string;
};

export type DispatchGroup = { title: string; hint: string; actions: DispatchAction[] };

export type Provider = {
  id: string;
  name: string;
  baseURL: string;
  /** Environment variable the key is read from. Empty for keyless endpoints. */
  keyName: string;
  model: string;
  timeoutMs: number;
  keyConfigured: boolean;
  enabled: boolean;
  /** Filled by the Test button or initial baseline telemetry. */
  latencyMs: number | null;
  /** Filled by the Test button for this session only. */
  modelCount: number | null;
};

export type TermSource = "mc-foreman" | "mc-cluster" | "mc-shim" | "mc-dashboard" | "minecraft-server" | "console" | "api";

export type TermLine = {
  id: number;
  time: string;
  source: TermSource;
  text: string;
  tone: "default" | "muted" | "ok" | "warn" | "danger" | "accent";
};

export type ToastMsg = {
  id: number;
  title: string;
  detail?: string;
  tone: "ok" | "warn" | "danger" | "info";
};

/** A terminal/current job that the API still lists alongside history. */
export const TERMINAL_JOB_STATES: ReadonlySet<JobStatus> = new Set(["completed", "cancelled", "failed"]);

export const isActiveJob = (status: JobStatus) => !TERMINAL_JOB_STATES.has(status);

/* ── Static catalogs ──────────────────────────────────────── */

export const addonCatalog: AddonDef[] = [
  { id: "auto_totem", name: "Auto Totem", category: "Combat", risk: "low", description: "Keeps a totem in the off hand and refills it from inventory through the shared lock." },
  { id: "cps_booster", name: "CPS Booster", category: "Combat", risk: "medium", description: "Deterministic attack cadence for close fights. No LLM calls, no packet burst.", setting: { key: "cps_value", label: "Clicks per second", min: 4, max: 30, step: 1, unit: "cps" } },
  { id: "cps_cooldown_mode", name: "Cooldown Mode", category: "Combat", risk: "low", description: "Waits for the vanilla attack cooldown instead of holding a fixed click cadence." },
  { id: "auto_gapple", name: "Auto Gapple", category: "Survival", risk: "low", description: "Eats a golden apple when health crosses the configured threshold." },
  { id: "auto_armor", name: "Auto Armor", category: "Survival", risk: "low", description: "Scores armour pieces and equips the strongest item in every weaker slot." },
  { id: "panic_escape", name: "Panic Escape", category: "Survival", risk: "guarded", description: "Throws an ender pearl and breaks line of sight when the health buffer collapses." },
  { id: "player_radar", name: "Player Radar", category: "Recon", risk: "low", description: "Tracks non-crew players nearby and exposes range, held item and sneak state." },
  { id: "auto_loot", name: "Auto Loot", category: "Recon", risk: "medium", description: "Collects nearby drops while the grind queue is idle. Respects the inventory lock." },
  { id: "shop_gui", name: "Shop GUI", category: "Economy", risk: "guarded", description: "Reads the server shop GUI and exposes balance plus buy and sell dispatch." },
  { id: "auto_sell", name: "Auto Sell", category: "Economy", risk: "guarded", description: "Sells configured surplus through the shop GUI after a grind job completes." },
  { id: "schematic_builder", name: "Schematic Builder", category: "System", risk: "low", managed: true, description: "Places Sponge schematics block by block. Driven from the Build view." },
  { id: "grind_worker", name: "Grind Worker", category: "System", risk: "low", managed: true, description: "Persistent collection queue that survives reconnects. Driven from the Grind view." },
];

/** One-tap orders, ported from the original dashboard's dispatch groups. */
export const dispatchGroups: DispatchGroup[] = [
  {
    title: "Loadout",
    hint: "Inventory actions, taken through the shared lock.",
    actions: [
      { label: "Equip totem", action: "totem" },
      { label: "Eat gapple", action: "eat" },
      { label: "Equip armour", action: "armor" },
    ],
  },
  {
    title: "Field",
    hint: "Movement and pickup around the work site.",
    actions: [
      { label: "Collect drops", action: "loot" },
      { label: "Return to base", action: "send_command", command: "/home base" },
      { label: "Return to spawn", action: "send_command", command: "/spawn" },
    ],
  },
  {
    title: "Economy",
    hint: "Shop actions need the Shop GUI add-on.",
    actions: [
      { label: "Open shop", action: "shopgui", requires: "shop_gui" },
      { label: "Check balance", action: "bal" },
      { label: "Sell surplus", action: "sell_all", requires: "shop_gui" },
    ],
  },
  {
    title: "Travel",
    hint: "Server commands sent as ENI1.",
    actions: [
      { label: "Connect to Lifesteal", action: "send_command", command: "/server lifesteal" },
      { label: "Random TP to wild", action: "send_command", command: "/randomtp" },
      { label: "Set home", action: "send_command", command: "/sethome" },
      { label: "Return home", action: "send_command", command: "/home" },
    ],
  },
];

export const blockCategories = [
  { id: "ores", label: "Ores", blocks: ["ancient_debris", "diamond_ore", "emerald_ore", "gold_ore", "iron_ore", "copper_ore", "coal_ore", "redstone_ore", "lapis_ore", "nether_quartz_ore", "nether_gold_ore"] },
  { id: "logs", label: "Logs", blocks: ["oak_log", "birch_log", "spruce_log", "jungle_log", "acacia_log", "dark_oak_log", "mangrove_log", "cherry_log"] },
  { id: "terrain", label: "Terrain", blocks: ["stone", "cobblestone", "netherrack", "dirt", "sand", "gravel"] },
  { id: "crops", label: "Crops", blocks: ["wheat", "carrots", "potatoes", "beetroots", "sugar_cane"] },
] as const;

export type BlockCategoryId = (typeof blockCategories)[number]["id"];

/* ── Derivations ──────────────────────────────────────────── */

/** The layer the builder is working on, 1-based. */
export function layerOf(job: Pick<BuildJob, "placed" | "totalBlocks" | "layers">) {
  return Math.min(Math.max(1, job.layers), Math.floor((job.placed / Math.max(1, job.totalBlocks)) * job.layers) + 1);
}

/* ── Formatters ───────────────────────────────────────────── */

export const fmtInt = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("en-US");

export function fmtBytes(bytes: number | null) {
  if (bytes === null) return "—";
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function fmtAgo(ts: number | null | undefined, from = Date.now()) {
  if (!ts) return "never";
  const s = Math.max(0, Math.round((from - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ${h % 24}h ago`;
}

/** Compact duration: 42s, 6m 05s, 3h 12m, 14d 06h. */
export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;
  return `${Math.floor(h / 24)}d ${pad(h % 24)}h`;
}

export function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function prettyBlock(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function coord(bot: Pick<FleetBot, "x" | "y" | "z">) {
  if (bot.x === null || bot.y === null || bot.z === null) return "—";
  return `${Math.round(bot.x)} / ${Math.round(bot.y)} / ${Math.round(bot.z)}`;
}

const COMPASS_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function bearingCompass(rad: number): { deg: number; label: string } {
  const rawDeg = ((rad * 180) / Math.PI) % 360;
  const deg = Math.round((rawDeg + 360) % 360) % 360;
  const idx = Math.round(deg / 45) % 8;
  return { deg, label: COMPASS_DIRS[idx] };
}
