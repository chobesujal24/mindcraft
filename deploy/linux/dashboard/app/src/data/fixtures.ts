import type {
  AddonConfig,
  ConfigResponse,
  FleetBot,
  FleetResponse,
  GrindState,
  ProfileOption,
  Provider,
  SchematicState,
  Service,
  StatusResponse,
  TelemetryResponse,
  Threat,
} from "./types";

export type AddonDefinition = {
  id: string;
  name: string;
  category: "Combat" | "Survival" | "Economy" | "Recon" | "System";
  description: string;
  risk: "low" | "medium" | "guarded";
  icon: "sword" | "heart" | "leaf" | "coin" | "compass" | "shield" | "zap" | "map-pin" | "spark" | "layers" | "globe" | "settings" | "clock" | "box" | "database";
  setting?: { key: string; label: string; min: number; max: number; step: number; unit: string };
  managed?: boolean;
};

export const addonCatalog: AddonDefinition[] = [
  {
    id: "auto_totem",
    name: "Auto Totem",
    category: "Combat",
    description: "Keeps a totem in the off hand and refills from inventory through the shared inventory lock.",
    risk: "low",
    icon: "sword",
  },
  {
    id: "cps_booster",
    name: "CPS Booster",
    category: "Combat",
    description: "Deterministic attack cadence for close-quarter fights. No LLM calls, no packet burst.",
    risk: "medium",
    icon: "zap",
    setting: { key: "cps_value", label: "Clicks per second", min: 4, max: 30, step: 1, unit: "cps" },
  },
  {
    id: "cps_cooldown_mode",
    name: "Cooldown Mode",
    category: "Combat",
    description: "Waits for the vanilla attack cooldown instead of holding a fixed click cadence.",
    risk: "low",
    icon: "clock",
  },
  {
    id: "auto_gapple",
    name: "Auto Gapple",
    category: "Survival",
    description: "Eats a golden apple when health crosses the configured threshold.",
    risk: "low",
    icon: "heart",
  },
  {
    id: "auto_armor",
    name: "Auto Armor",
    category: "Survival",
    description: "Scores armour pieces and equips the strongest item in every empty or weaker slot.",
    risk: "low",
    icon: "shield",
  },
  {
    id: "panic_escape",
    name: "Panic Escape",
    category: "Survival",
    description: "Throws an ender pearl and breaks line of sight when the health buffer collapses.",
    risk: "guarded",
    icon: "compass",
  },
  {
    id: "player_radar",
    name: "Player Radar",
    category: "Recon",
    description: "Tracks non-crew players inside 32 blocks and exposes range, held item, and sneak state.",
    risk: "low",
    icon: "map-pin",
  },
  {
    id: "auto_loot",
    name: "Auto Loot",
    category: "Recon",
    description: "Collects nearby dropped items while the grind queue is idle. Respects the inventory lock.",
    risk: "medium",
    icon: "spark",
  },
  {
    id: "shop_gui",
    name: "Shop GUI",
    category: "Economy",
    description: "Reads the server shop GUI and exposes balance plus safe buy/sell dispatch groups.",
    risk: "guarded",
    icon: "coin",
  },
  {
    id: "auto_sell",
    name: "Auto Sell",
    category: "Economy",
    description: "Sells configured surplus through the shop GUI after a grind job completes.",
    risk: "guarded",
    icon: "database",
  },
  {
    id: "schematic_builder",
    name: "Schematic Builder",
    category: "System",
    description: "Places Sponge schematics block by block. Controlled from the Build tab, not a toggle.",
    risk: "low",
    icon: "layers",
    managed: true,
  },
  {
    id: "grind_worker",
    name: "Grind Worker",
    category: "System",
    description: "Persistent collection queue that survives reconnects. Controlled from the Grind tab.",
    risk: "low",
    icon: "box",
    managed: true,
  },
];

/** Managed workers are driven from their own views and cannot be toggled here. */
export const switchableAddons = addonCatalog.filter((entry) => !entry.managed);

/** Single source of truth for the armed badge shown in nav, tabs, and the page. */
export function armedAddonCount(config: AddonConfig): number {
  return switchableAddons.filter((entry) => config[entry.id] === true).length;
}

const now = Date.now();

export const fixtureServices: Service[] = [
  { name: "mc-shim", state: "active", pid: 18422, cpu: 1.8, mem: 92 * 1024 * 1024, uptime: "2d 04h" },
  { name: "mc-cluster", state: "active", pid: 18390, cpu: 7.2, mem: 384 * 1024 * 1024, uptime: "14d 06h" },
  { name: "mc-foreman", state: "active", pid: 18455, cpu: 12.4, mem: 612 * 1024 * 1024, uptime: "6d 19h" },
];

export const fixtureProfiles: ProfileOption[] = [
  {
    file: "./profiles/foreman.json",
    filename: "foreman.json",
    name: "ENI1 (foreman.json)",
    rawName: "ENI1",
    is_online: false,
    model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    hide_commands_in_chat: true,
  },
  {
    file: "./profiles/foreman-online.json",
    filename: "foreman-online.json",
    name: "ENI1 Online (foreman-online.json)",
    rawName: "ENI1",
    is_online: true,
    model: "google/gemini-3.8-flash-high",
    hide_commands_in_chat: true,
  },
  {
    file: "./profiles/quiet.json",
    filename: "quiet.json",
    name: "ENI Quiet (quiet.json)",
    rawName: "ENI1",
    is_online: false,
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    hide_commands_in_chat: true,
  },
];

export const fixtureBots: FleetBot[] = [
  {
    id: "eni-01",
    name: "ENI1",
    health: 20,
    food: 19,
    x: 142,
    y: 68,
    z: -38,
    dimension: "minecraft:overworld",
    ping: 23,
    activity: "Supervising · schematic 31%",
    state: "active",
  },
  {
    id: "deep-miner",
    name: "DeepMiner",
    health: 17,
    food: 16,
    x: 118,
    y: -54,
    z: -12,
    dimension: "minecraft:overworld",
    ping: 31,
    activity: "Grinding ancient_debris",
    state: "active",
  },
  {
    id: "surface-grinder",
    name: "SurfaceGrinder",
    health: 20,
    food: 20,
    x: 208,
    y: 72,
    z: 46,
    dimension: "minecraft:overworld",
    ping: 27,
    activity: "Hauling cherry logs to camp",
    state: "active",
  },
  {
    id: "villager-tech",
    name: "VillagerTech",
    health: 13,
    food: 9,
    x: 94,
    y: 64,
    z: 118,
    dimension: "minecraft:overworld",
    ping: 88,
    activity: "Trading · hunger low",
    state: "warning",
  },
  {
    id: "schematic-builder",
    name: "SchematicBuilder",
    health: 20,
    food: 18,
    x: 156,
    y: 70,
    z: 4,
    dimension: "minecraft:overworld",
    ping: 36,
    activity: "Placing sakura pavilion · layer 9",
    state: "active",
  },
];

export const fixtureStatus: StatusResponse = {
  ok: true,
  services: fixtureServices,
  botCount: 5,
  uptime: 14 * 86_400 + 6 * 3_600,
  target: "127.0.0.1:56730 · 26.1",
};

export const fixtureFleet: FleetResponse = {
  bots: fixtureBots,
  profiles: fixtureProfiles,
  activeProfile: "./profiles/foreman.json",
};

export const fixtureTelemetry: TelemetryResponse = {
  hits: 4_812,
  misses: 37,
  latency: { p50: 42, p95: 186 },
  throughput: 18.4,
  lastSweep: now - 4_000,
};

export const fixtureConfig: ConfigResponse = {
  settings: {
    minecraft_version: "26.1",
    host: "127.0.0.1",
    port: 56730,
    auth: "offline",
    mindserver_port: 8080,
    base_profile: "assistant",
    load_memory: false,
    only_chat_with: ["sujal24", "52hx", "ADMIN"],
    allow_insecure_coding: false,
    code_timeout_mins: 10,
    spawn_timeout: 60,
    narrate_behavior: true,
    auto_open_ui: true,
  },
  bots: { server: { host: "127.0.0.1", port: 56730, version: "26.1" } },
  env: {},
  effective: { host: "127.0.0.1", port: 56730, version: "26.1", auth: "offline", startPaused: false, overrides: {} },
  profiles: fixtureProfiles,
  active_profile: "./profiles/foreman.json",
  version: "0.1.4",
};

export const fixtureAddonConfig: AddonConfig = {
  auto_totem: true,
  auto_gapple: true,
  auto_armor: true,
  cps_booster: false,
  cps_value: 12,
  cps_cooldown_mode: true,
  panic_escape: false,
  player_radar: true,
  auto_loot: false,
  shop_gui: false,
  auto_sell: false,
};

export const fixtureThreats: Threat[] = [
  { username: "52hx", distance: 14.2, x: 133, y: 68, z: -26, heldItem: "netherite_sword", isSneaking: true },
  { username: "sujal24", distance: 27.8, x: 166, y: 66, z: -14, heldItem: "bow", isSneaking: false },
  { username: "Mochi", distance: 41.6, x: 102, y: 71, z: -62, heldItem: "empty", isSneaking: false },
];

export const fixtureGrind: GrindState = {
  current: {
    id: "grind-7d3f0a",
    target: "ancient_debris",
    requested: 128,
    completed: 84,
    status: "running",
    createdAt: now - 30 * 60_000,
    updatedAt: now - 4_000,
    startedAt: now - 24 * 60_000,
    message: "Collected 84 of 128 blocks.",
    radius: 48,
    deposit: "camp chest",
    tools: ["pickaxe"],
  },
  queue: [
    {
      id: "grind-91bc22",
      target: "cherry_log",
      requested: 64,
      completed: 0,
      status: "queued",
      createdAt: now - 3 * 60_000,
      updatedAt: now - 3 * 60_000,
      message: "Waiting for ENI1 to become idle.",
      radius: 32,
      deposit: "inventory",
      tools: ["axe"],
    },
    {
      id: "grind-4a9d10",
      target: "wheat",
      requested: 96,
      completed: 0,
      status: "queued",
      createdAt: now - 2 * 60_000,
      updatedAt: now - 2 * 60_000,
      message: "Waiting for ENI1 to become idle.",
      radius: 40,
      deposit: "camp chest",
      tools: ["hoe"],
    },
  ],
  history: [
    {
      id: "grind-6f8e04",
      target: "gold_ore",
      requested: 32,
      completed: 32,
      status: "completed",
      createdAt: now - 5 * 3_600_000,
      updatedAt: now - 4 * 3_600_000,
      startedAt: now - 5 * 3_600_000,
      message: "Completed: collected 32 gold_ore.",
    },
    {
      id: "grind-0ca312",
      target: "oak_log",
      requested: 64,
      completed: 41,
      status: "cancelled",
      createdAt: now - 9 * 3_600_000,
      updatedAt: now - 8 * 3_600_000,
      startedAt: now - 9 * 3_600_000,
      message: "Cancelled by operator.",
    },
  ],
};

export const fixtureSchematic: SchematicState = {
  current: {
    id: "schem-4f2a1c",
    fileName: "schem-4f2a1c.schem",
    sourceName: "sakura_pavilion.schem",
    origin: { x: 152, y: 68, z: 6 },
    rotation: 0,
    replaceBlocks: false,
    status: "running",
    totalBlocks: 4_096,
    nextIndex: 1_284,
    placed: 1_284,
    skipped: 12,
    size: { x: 32, y: 16, z: 24 },
    materials: {
      "polished_andesite": 1_240,
      "dark_oak_planks": 680,
      "stripped_dark_oak_log": 512,
      "cyan_stained_glass": 168,
      "white_concrete": 96,
      "lantern": 48,
      "barrel": 24,
    },
    missing: ["lantern"],
    message: "Processed 1,284 of 4,096 blocks.",
    createdAt: now - 12 * 60_000,
    updatedAt: now - 3_000,
    startedAt: now - 9 * 60_000,
  },
  history: [
    {
      id: "schem-88a012",
      fileName: "schem-88a012.schem",
      sourceName: "yozakura_gate.schem",
      origin: { x: 120, y: 64, z: -20 },
      rotation: 90,
      replaceBlocks: true,
      status: "completed",
      totalBlocks: 1_240,
      nextIndex: 1_240,
      placed: 1_228,
      skipped: 12,
      size: { x: 18, y: 12, z: 8 },
      materials: { "dark_oak_planks": 420, "stripped_dark_oak_log": 280, "lantern": 36 },
      missing: [],
      message: "Completed: placed 1,228 blocks and skipped 12 already-correct blocks.",
      createdAt: now - 26 * 3_600_000,
      updatedAt: now - 25 * 3_600_000,
      startedAt: now - 26 * 3_600_000,
      finishedAt: now - 25 * 3_600_000,
    },
  ],
};

export const fixtureBuild: SchematicState = fixtureSchematic;

export const fixtureProviders: Provider[] = [
  {
    id: "gemini-3-8-flash-high",
    name: "Gemini 3.8 Flash High",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyName: "GEMINI_API_KEY",
    model: "gemini-3.8-flash-high",
    timeoutMs: 45_000,
    enabled: true,
    keyConfigured: true,
    contextWindow: 1_048_576,
    contextUsed: 650_117,
    tokensPerSec: 186,
    lastLatencyMs: 1_240,
  },
  {
    id: "river-ai",
    name: "DeepSeek v4.1 Flash 1017",
    baseURL: "https://api.river.ai/v1",
    keyName: "RIVER_API_KEY",
    model: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    timeoutMs: 60_000,
    enabled: true,
    keyConfigured: true,
    contextWindow: 163_840,
    contextUsed: 62_259,
    tokensPerSec: 142,
    lastLatencyMs: 704,
  },
  {
    id: "eni-local-critic",
    name: "ENI local critic",
    baseURL: "http://127.0.0.1:4100/v1",
    keyName: "LOCAL_CRITIC_KEY",
    model: "eni-critic-7b-q4",
    timeoutMs: 30_000,
    enabled: true,
    keyConfigured: true,
    contextWindow: 32_768,
    contextUsed: 3_932,
    tokensPerSec: 64,
    lastLatencyMs: 210,
  },
  {
    id: "nvidia-1",
    name: "NVIDIA NIM",
    baseURL: "https://integrate.api.nvidia.com/v1",
    keyName: "NVIDIA_API_KEY",
    model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
    timeoutMs: 30_000,
    enabled: false,
    keyConfigured: true,
    contextWindow: 131_072,
    contextUsed: 0,
    tokensPerSec: null,
    lastLatencyMs: null,
  },
];

export const grindTargets: { id: string; label: string; category: "Mining" | "Farming" | "Combat"; icon: "box" | "leaf" | "database" | "sword" | "coin" }[] = [
  { id: "stone", label: "Stone", category: "Mining", icon: "box" },
  { id: "cobblestone", label: "Cobblestone", category: "Mining", icon: "box" },
  { id: "dirt", label: "Dirt", category: "Mining", icon: "box" },
  { id: "gravel", label: "Gravel", category: "Mining", icon: "box" },
  { id: "sand", label: "Sand", category: "Mining", icon: "box" },
  { id: "netherrack", label: "Netherrack", category: "Mining", icon: "box" },
  { id: "coal_ore", label: "Coal ore", category: "Mining", icon: "database" },
  { id: "copper_ore", label: "Copper ore", category: "Mining", icon: "database" },
  { id: "iron_ore", label: "Iron ore", category: "Mining", icon: "database" },
  { id: "gold_ore", label: "Gold ore", category: "Mining", icon: "coin" },
  { id: "lapis_ore", label: "Lapis ore", category: "Mining", icon: "database" },
  { id: "redstone_ore", label: "Redstone ore", category: "Mining", icon: "database" },
  { id: "diamond_ore", label: "Diamond ore", category: "Mining", icon: "database" },
  { id: "emerald_ore", label: "Emerald ore", category: "Mining", icon: "database" },
  { id: "nether_quartz_ore", label: "Nether quartz", category: "Mining", icon: "database" },
  { id: "nether_gold_ore", label: "Nether gold", category: "Mining", icon: "coin" },
  { id: "ancient_debris", label: "Ancient debris", category: "Mining", icon: "database" },
  { id: "oak_log", label: "Oak logs", category: "Farming", icon: "leaf" },
  { id: "spruce_log", label: "Spruce logs", category: "Farming", icon: "leaf" },
  { id: "birch_log", label: "Birch logs", category: "Farming", icon: "leaf" },
  { id: "jungle_log", label: "Jungle logs", category: "Farming", icon: "leaf" },
  { id: "acacia_log", label: "Acacia logs", category: "Farming", icon: "leaf" },
  { id: "dark_oak_log", label: "Dark oak logs", category: "Farming", icon: "leaf" },
  { id: "mangrove_log", label: "Mangrove logs", category: "Farming", icon: "leaf" },
  { id: "cherry_log", label: "Cherry logs", category: "Farming", icon: "leaf" },
  { id: "wheat", label: "Wheat", category: "Farming", icon: "leaf" },
  { id: "carrots", label: "Carrots", category: "Farming", icon: "leaf" },
  { id: "potatoes", label: "Potatoes", category: "Farming", icon: "leaf" },
  { id: "beetroots", label: "Beetroots", category: "Farming", icon: "leaf" },
  { id: "sugar_cane", label: "Sugar cane", category: "Farming", icon: "leaf" },
];

export const fixtureThreatTable = fixtureThreats;

export const activityFeed = [
  { time: "00:18", title: "Grind job acknowledged by ENI1", detail: "ancient_debris · 84 / 128 · DeepMiner", tone: "accent" as const },
  { time: "00:14", title: "Schematic layer 9 reached", detail: "sakura_pavilion.schem · 1,284 placed", tone: "ok" as const },
  { time: "00:11", title: "Lantern shortage detected", detail: "48 needed · 32 available · build paused at layer 9", tone: "warn" as const },
  { time: "00:07", title: "VillagerTech hunger is low", detail: "9 / 20 food · SurfaceGrinder nearby", tone: "warn" as const },
  { time: "23:59", title: "Provider failover to River.ai", detail: "NVIDIA returned 429 · cooldown 60s · DeepSeek answered", tone: "accent" as const },
  { time: "23:54", title: "Nightly backup sealed", detail: "cluster state · 412 MB · verified", tone: "ok" as const },
];

export const fixtureLogs: Record<string, string[]> = {
  "mc-shim": [
    "00:18:41 [shim] POST /v1/chat/completions 200 704ms model=deepseek-v4.1-flash",
    "00:18:12 [shim] queue depth 0 · cli idle",
    "00:17:58 [shim] embedding hash-384 200 4ms",
    "00:17:31 [shim] provider fallback river-ai · retry 1",
    "00:16:52 [shim] GET /v1/models 200 2ms",
  ],
  "mc-cluster": [
    "00:18:30 [cluster] SurfaceGrinder spawned at 208,72,46",
    "00:17:07 [cluster] VillagerTech → trader_ui opened",
    "00:15:44 [cluster] DeepMiner collected ancient_debris (84/128)",
    "00:12:03 [cluster] SchematicBuilder lane locked · inventory mutex held",
    "00:09:20 [cluster] worker heartbeat ok · 5/5",
  ],
  "mc-foreman": [
    "00:19:02 [foreman] schematic tick 1284/4096 · missing lantern",
    "00:18:40 [foreman] addons config applied · player_radar=on",
    "00:18:10 [foreman] chat whisper from sujal24 acknowledged",
    "00:17:36 [foreman] nim request provider=river-ai latency=704ms",
    "00:16:02 [foreman] memory summary written · 500 chars",
  ],
};

export const serviceDescriptions: Record<string, string> = {
  "mc-shim": "OpenAI-compatible relay for the OpenCode CLI",
  "mc-cluster": "MindServer and the Minecraft worker cluster",
  "mc-foreman": "ENI1 supervisor and command plane",
};
