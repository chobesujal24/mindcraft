import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, "../public");
const PORT = Number(process.env.MOCK_PORT || 8093);
let failAll = false;
let failNext = 0;

const profiles = [
  { file: "./profiles/foreman.json", filename: "foreman.json", name: "ENI1 Foreman (foreman.json)", rawName: "ENI1", is_online: true, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
  { file: "./profiles/assistant.json", filename: "assistant.json", name: "ENI1 Assistant (assistant.json)", rawName: "ENI1 Assistant", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: false },
  { file: "./profiles/scout.json", filename: "scout.json", name: "Scout (scout.json)", rawName: "Scout", is_online: true, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: true },
  { file: "./profiles/miner.json", filename: "miner.json", name: "DeepMiner (miner.json)", rawName: "DeepMiner", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
  { file: "./profiles/builder.json", filename: "builder.json", name: "SchematicBuilder (builder.json)", rawName: "SchematicBuilder", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: true },
  { file: "./profiles/trader.json", filename: "trader.json", name: "Quartermaster (trader.json)", rawName: "Quartermaster", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: false },
  { file: "./profiles/guard.json", filename: "guard.json", name: "Night Watch (guard.json)", rawName: "Night Watch", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: true },
  { file: "./profiles/fisher.json", filename: "fisher.json", name: "Tidewalker (fisher.json)", rawName: "Tidewalker", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: false },
  { file: "./profiles/architect.json", filename: "architect.json", name: "Architect (architect.json)", rawName: "Architect", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: true },
  { file: "./profiles/nether.json", filename: "nether.json", name: "Ember Runner (nether.json)", rawName: "Ember Runner", is_online: false, model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", hide_commands_in_chat: true },
  { file: "./profiles/farmer.json", filename: "farmer.json", name: "Hanami Farmer (farmer.json)", rawName: "Hanami Farmer", is_online: false, model: "nvidia/nemotron-3.5-lightning-30b-a3b", hide_commands_in_chat: false },
  { file: "./profiles/envoy.json", filename: "envoy.json", name: "Envoy (envoy.json)", rawName: "Envoy", is_online: false, model: "zai-org/GLM-5.3-Flash", hide_commands_in_chat: false },
  { file: "./profiles/archivist.json", filename: "archivist.json", name: "Archivist (archivist.json)", rawName: "Archivist", is_online: false, model: "eni-critic-7b-q4", hide_commands_in_chat: true }
];

let services = [
  { name: "mc-dashboard", state: "active", pid: 40988, cpu: 0.7, mem: 96_468_992, uptime: "2d 4h" },
  { name: "mc-shim", state: "active", pid: 41022, cpu: 2.4, mem: 188_743_680, uptime: "2d 4h" },
  { name: "mc-cluster", state: "active", pid: 41088, cpu: 8.1, mem: 754_974_720, uptime: "2d 4h" },
  { name: "mc-foreman", state: "active", pid: 41192, cpu: 12.7, mem: 1_342_177_280, uptime: "6h 12m" },
  { name: "minecraft-server", state: "inactive", pid: null, cpu: null, mem: null, uptime: null }
];

const bots = [
  { id: "eni1", name: "ENI1", health: 19, food: 17, x: 142, y: 68, z: -38, dimension: "minecraft:overworld", ping: 23, activity: "Mining ancient debris · 47/128", state: "active" },
  { id: "scout", name: "Scout", health: 14, food: 9, x: 96, y: 64, z: -52, dimension: "minecraft:overworld", ping: 41, activity: "Holding perimeter at camp chest", state: "warning" }
];

let addonConfig = {
  auto_totem: true,
  auto_gapple: true,
  auto_armor: false,
  cps_booster: true,
  cps_value: 14,
  cps_cooldown_mode: false,
  panic_escape: true,
  player_radar: true,
  auto_loot: true,
  shop_gui: false,
  auto_sell: false
};

const threats = [
  { username: "sujal24", distance: 8.4, x: 150, y: 68, z: -34, heldItem: "diamond_sword", isSneaking: true },
  { username: "52hx", distance: 21.7, x: 121, y: 66, z: -20, heldItem: "bow", isSneaking: false },
  { username: "ADMIN", distance: 42.2, x: 184, y: 70, z: -70, heldItem: "golden_apple", isSneaking: false }
];

const now = Date.now();
let grind = {
  current: {
    id: "grind-3f6c2a1e-77b4-4a11-9d9e-2d0d2a3e6c11",
    target: "ancient_debris",
    requested: 128,
    completed: 47,
    status: "running",
    createdAt: now - 1_920_000,
    startedAt: now - 1_680_000,
    updatedAt: now - 2_000,
    message: "Sweeping the northern debris field.",
    radius: 32,
    deposit: "camp chest",
    tools: ["pickaxe"]
  },
  queue: [
    { id: "grind-q1", target: "nether_quartz_ore", requested: 96, completed: 0, status: "queued", createdAt: now - 900_000, updatedAt: now - 900_000, radius: 24, deposit: "camp chest" },
    { id: "grind-q2", target: "gold_ore", requested: 64, completed: 0, status: "queued", createdAt: now - 880_000, updatedAt: now - 880_000, radius: 32, deposit: "inventory" }
  ],
  history: [
    { id: "grind-h1", target: "diamond_ore", requested: 32, completed: 32, status: "completed", createdAt: now - 9_000_000, updatedAt: now - 7_000_000 },
    { id: "grind-h2", target: "coal_ore", requested: 128, completed: 92, status: "cancelled", createdAt: now - 12_000_000, updatedAt: now - 10_000_000 },
    { id: "grind-h3", target: "oak_log", requested: 64, completed: 64, status: "completed", createdAt: now - 20_000_000, updatedAt: now - 18_000_000 }
  ]
};

const buildMaterials = { deepslate_bricks: 1280, polished_blackstone: 640, cherry_planks: 320, glass_pane: 192, lantern: 48, ancient_debris: 16 };
let schematic = {
  current: {
    id: "schem-9a8e2d11-4c9b-4a55-b8e0-6b1c1e1b4a22",
    fileName: "schem-9a8e2d11-4c9b-4a55-b8e0-6b1c1e1b4a22.schem",
    sourceName: "hanami_pavilion",
    origin: { x: 152, y: 68, z: 6 },
    rotation: 90,
    replaceBlocks: false,
    status: "blocked",
    totalBlocks: 2496,
    nextIndex: 1180,
    placed: 1180,
    skipped: 0,
    size: { x: 24, y: 12, z: 18 },
    materials: buildMaterials,
    missing: ["lantern", "ancient_debris"],
    message: "Waiting for 32 lanterns before the next layer.",
    createdAt: now - 3_600_000,
    startedAt: now - 3_400_000,
    updatedAt: now - 6_000
  },
  history: [
    { id: "schem-h1", fileName: "schem-h1.schem", sourceName: "camp_chest", origin: { x: 150, y: 68, z: -12 }, rotation: 0, replaceBlocks: false, status: "completed", totalBlocks: 128, nextIndex: 128, placed: 128, skipped: 4, size: { x: 8, y: 4, z: 8 }, materials: { oak_planks: 96, chest: 4 }, missing: [], message: "Build complete.", createdAt: now - 40_000_000, updatedAt: now - 34_000_000, finishedAt: now - 34_000_000 }
  ]
};

let providers = [
  { id: "gemini-3-8-flash-high", name: "Gemini 3.8 Flash High", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", keyName: "GEMINI_API_KEY", model: "gemini-3.8-flash-high", timeoutMs: 45_000, enabled: true, keyConfigured: true, contextWindow: 1_048_576, contextUsed: 650_117, tokensPerSec: 186, lastLatencyMs: 1_240 },
  { id: "river-ai", name: "DeepSeek v4.1 Flash 1017", baseURL: "https://api.river.ai/v1", keyName: "RIVER_API_KEY", model: "deepseek-ai/DeepSeek-V4.1-Flash-1017", timeoutMs: 60_000, enabled: true, keyConfigured: true, contextWindow: 163_840, contextUsed: 62_259, tokensPerSec: 142, lastLatencyMs: 704 },
  { id: "eni-local-critic", name: "ENI local critic", baseURL: "http://127.0.0.1:4100/v1", keyName: "LOCAL_CRITIC_KEY", model: "eni-critic-7b-q4", timeoutMs: 30_000, enabled: true, keyConfigured: true, contextWindow: 32_768, contextUsed: 3_932, tokensPerSec: 64, lastLatencyMs: 210 },
  { id: "nvidia-1", name: "NVIDIA NIM", baseURL: "https://integrate.api.nvidia.com/v1", keyName: "NVIDIA_API_KEY", model: "nvidia/nemotron-3.5-super-vl-120b-a12b", timeoutMs: 30_000, enabled: false, keyConfigured: true, contextWindow: 131_072, contextUsed: 0, tokensPerSec: null, lastLatencyMs: null }
];

const settings = {
  host: "127.0.0.1",
  port: 56730,
  minecraft_version: "26.1",
  auth: "offline",
  base_profile: "assistant",
  only_chat_with: ["sujal24", "52hx", "ADMIN"],
  load_memory: true,
  narrate_behavior: true,
  allow_insecure_coding: false,
  code_timeout_mins: 10,
  spawn_timeout: 60,
  auto_open_ui: true
};

function json(res, code, body) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-mock-server": "yozakura"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function serviceDTO(service) {
  return { ...service, mem: service.mem, uptime: service.uptime };
}

function configResponse() {
  return {
    settings,
    bots: { server: { host: "127.0.0.1", port: 56730, version: "26.1", auth: "offline" }, safeguards: { startPaused: false } },
    env: {},
    effective: { host: settings.host, port: settings.port, version: settings.minecraft_version, auth: settings.auth, startPaused: false, overrides: {} },
    profiles,
    active_profile: "./profiles/foreman.json",
    version: "0.1.4"
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname === "/api/mock/fail") {
    failAll = url.searchParams.get("on") === "1";
    return json(res, 200, { failAll });
  }
  if (pathname === "/api/mock/fail-next") {
    failNext = Number(url.searchParams.get("count") || 1);
    return json(res, 200, { failNext });
  }

  if (failAll || failNext > 0) {
    if (failNext > 0) failNext -= 1;
    return json(res, 503, { error: "Mock outage: the supervisor is unreachable." });
  }

  if (pathname === "/api/status") {
    return json(res, 200, {
      ok: services.some((service) => service.state === "active"),
      services: services.map(serviceDTO),
      botCount: bots.length,
      uptime: 498_221,
      target: "127.0.0.1:56730"
    });
  }
  if (pathname === "/api/fleet") {
    return json(res, 200, { bots, profiles, activeProfile: "./profiles/foreman.json" });
  }
  if (pathname === "/api/telemetry") {
    return json(res, 200, {
      hits: 948,
      misses: 12,
      latency: { p50: 42, p95: 118 },
      throughput: 27,
      lastSweep: Date.now() - 1_400
    });
  }
  if (pathname === "/api/config" && req.method === "GET") {
    return json(res, 200, configResponse());
  }
  if (pathname === "/api/config" && req.method === "POST") {
    const body = await readBody(req);
    if (body.settings && typeof body.settings === "object") Object.assign(settings, body.settings);
    if (body.active_profile) {
      const match = profiles.find((profile) => profile.file === body.active_profile);
      if (match) profiles.forEach((profile) => { profile.is_online = profile === match; });
    }
    return json(res, 200, { settings: Object.keys(body.settings || {}), restarted: body.restart === false ? [] : ["mc-foreman"] });
  }
  if (pathname === "/api/addons" && req.method === "GET") {
    return json(res, 200, {
      agentName: "ENI1",
      config: addonConfig,
      live: {
        agentName: "ENI1",
        timestamp: Date.now(),
        health: 19,
        maxHealth: 20,
        food: 17,
        totems: 2,
        gapples: 14,
        egapples: 3,
        balance: "$14,208",
        radar: threats,
        config: addonConfig,
        grind,
        schematic,
        dimension: "minecraft:overworld",
        ping: 23,
        position: { x: 142, y: 68, z: -38 }
      }
    });
  }
  if (pathname === "/api/addons" && req.method === "POST") {
    const body = await readBody(req);
    addonConfig = { ...addonConfig, ...body };
    return json(res, 200, { ok: true, applied: true, config: addonConfig });
  }
  if (pathname === "/api/addons/action" && req.method === "POST") {
    await readBody(req);
    return json(res, 200, { ok: true, applied: true, agentName: "ENI1" });
  }
  if (pathname === "/api/grind" && req.method === "GET") {
    return json(res, 200, { agentName: "ENI1", grind, agentStatus: "connected", lastSeen: Date.now() });
  }
  if (pathname === "/api/grind" && req.method === "POST") {
    const body = await readBody(req);
    const action = String(body.action || "");
    if (action === "queue" || action === "start") {
      grind.queue.push({
        id: `grind-mock-${Date.now()}`,
        target: String(body.target || "stone"),
        requested: Number(body.count) || 1,
        completed: 0,
        status: "queued",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else if (action === "pause" && grind.current) {
      grind.current = { ...grind.current, status: "paused", updatedAt: Date.now(), message: "Paused by operator." };
    } else if (action === "resume" && grind.current) {
      grind.current = { ...grind.current, status: "running", updatedAt: Date.now(), message: "Resumed by operator." };
    } else if (action === "cancel") {
      if (body.jobId && grind.current?.id === body.jobId) {
        grind.history.unshift({ ...grind.current, status: "cancelled", updatedAt: Date.now() });
        grind.current = null;
      } else if (body.jobId) {
        grind.queue = grind.queue.filter((job) => job.id !== body.jobId);
      }
    }
    return json(res, 200, { ok: true, applied: true, agentName: "ENI1", grind });
  }
  if (pathname === "/api/schematic" && req.method === "GET") {
    return json(res, 200, { agentName: "ENI1", ...schematic });
  }
  if (pathname === "/api/schematic/control" && req.method === "POST") {
    const body = await readBody(req);
    if (schematic.current) {
      if (body.action === "pause") schematic.current = { ...schematic.current, status: "paused", updatedAt: Date.now() };
      if (body.action === "resume") schematic.current = { ...schematic.current, status: "running", updatedAt: Date.now() };
      if (body.action === "cancel") {
        schematic.history.unshift({ ...schematic.current, status: "cancelled", updatedAt: Date.now() });
        schematic.current = null;
      }
    }
    return json(res, 200, { ok: true, applied: true });
  }
  if (pathname === "/api/schematic/upload" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const sourceName = path.basename(String(url.searchParams.get("name") || "schematic.schem"));
    schematic.current = {
      id: `schem-mock-${Date.now()}`,
      fileName: `${Date.now()}.schem`,
      sourceName: sourceName.replace(/\.schem$/i, ""),
      origin: {
        x: Number(url.searchParams.get("x") || 0),
        y: Number(url.searchParams.get("y") || 0),
        z: Number(url.searchParams.get("z") || 0)
      },
      rotation: Number(url.searchParams.get("rotation") || 0),
      replaceBlocks: url.searchParams.get("replace") === "true",
      status: "queued",
      totalBlocks: Math.max(64, Math.round(size / 12)),
      nextIndex: 0,
      placed: 0,
      skipped: 0,
      size: { x: 12, y: 8, z: 12 },
      materials: { deepslate_bricks: 128, glass_pane: 32 },
      missing: [],
      message: "Upload received. ENI1 is validating the schematic.",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return json(res, 202, { ok: true, jobId: schematic.current.id, applied: true });
  }
  if (pathname === "/api/providers" && req.method === "GET") {
    return json(res, 200, { providers });
  }
  if (pathname === "/api/providers" && req.method === "POST") {
    const body = await readBody(req);
    if (Array.isArray(body.providers)) {
      providers = body.providers.map((provider) => ({
        ...provider,
        keyConfigured: Boolean(body.apiKeys?.[provider.keyName]) || provider.keyConfigured
      }));
      for (const key of body.clearKeys || []) {
        providers = providers.map((provider) => provider.keyName === key ? { ...provider, keyConfigured: false } : provider);
      }
    }
    return json(res, 200, { ok: true, restarted: ["mc-foreman"] });
  }
  if (pathname === "/api/providers/test" && req.method === "POST") {
    await readBody(req);
    await new Promise((resolve) => setTimeout(resolve, 180));
    return json(res, 200, { ok: true, latencyMs: 238, statusCode: 200, modelCount: 12 });
  }
  if (pathname === "/api/logs") {
    return json(res, 200, { service: "mc-foreman", lines: ["[mock] telemetry snapshot applied", "[mock] grind worker resumed"] });
  }
  if (pathname.startsWith("/api/service/") && req.method === "POST") {
    const parts = pathname.split("/").filter(Boolean);
    const name = decodeURIComponent(parts[2] || "");
    const action = decodeURIComponent(parts[3] || "");
    services = services.map((service) => {
      if (service.name !== name) return service;
      return { ...service, state: action === "stop" ? "inactive" : "active" };
    });
    return json(res, 200, { ok: true, action });
  }
  if (pathname.startsWith("/api/")) return json(res, 404, { error: "mock endpoint not found" });

  const wantsLegacy = url.searchParams.get("tab") === "legacy" || pathname === "/legacy";
  const relative = wantsLegacy ? "legacy.html" : pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const file = path.join(PUBLIC, relative);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("not found");
  }
  const type = file.endsWith(".html") ? "text/html; charset=utf-8"
    : file.endsWith(".css") ? "text/css"
    : file.endsWith(".js") ? "text/javascript"
    : file.endsWith(".svg") ? "image/svg+xml"
    : file.endsWith(".png") ? "image/png"
    : file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg"
    : "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock] Yozakura fixture server on http://127.0.0.1:${PORT}`);
});
