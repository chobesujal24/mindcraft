/* Adapters from the supervisor API shapes (data/types.ts) to the console's
   display model (data/model.ts). The API stays authoritative; this module only
   normalises and derives what the UI needs. */

import type {
  AddonsResponse,
  ConfigResponse,
  FleetResponse,
  GrindResponse,
  ProfileOption,
  Provider as ApiProvider,
  ProvidersResponse,
  SchematicJob,
  SchematicResponse,
  Service as ApiService,
  StatusResponse,
  TelemetryResponse,
  Threat as ApiThreat,
} from "./types";
import { AVATARS } from "../assets";
import {
  isActiveJob,
  prettyBlock,
  type BuildJob,
  type FleetBot,
  type GrindJob,
  type JobStatus,
  type Material,
  type Profile,
  type Provider,
  type Service,
  type Threat,
} from "./model";

const SERVICE_ROLES: Record<string, string> = {
  "mc-shim": "Protocol shim · telemetry bridge",
  "mc-cluster": "Worker agents · grind and build",
  "mc-foreman": "ENI1 · supervisor loop",
  "mc-dashboard": "Dashboard · this console",
  "minecraft-server": "Minecraft server · world host",
};

const STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "submitted",
  "running",
  "pausing",
  "paused",
  "blocked",
  "cancelling",
  "completed",
  "cancelled",
  "failed",
]);

/** Parse the compact supervisor uptime (`14d 6h`, `3h 04m`, `5m 06s`, `7s`). */
export function parseUptimeSeconds(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?$/);
  if (!match) return null;
  const [, d, h, m, s] = match;
  if (!d && !h && !m && !s) return null;
  return (Number(d) || 0) * 86_400 + (Number(h) || 0) * 3_600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

export function serviceState(raw: string): Service["state"] {
  if (raw === "active") return "active";
  if (raw === "activating" || raw === "deactivating" || raw === "reloading") return "restarting";
  return "inactive";
}

export function adaptService(service: ApiService, now = Date.now()): Service {
  const uptime = parseUptimeSeconds(service.uptime);
  return {
    name: service.name,
    role: SERVICE_ROLES[service.name] ?? "Supervisor unit",
    state: serviceState(service.state),
    pid: service.pid,
    cpu: service.cpu,
    mem: service.mem,
    startedAt: uptime === null ? null : now - uptime * 1_000,
  };
}

export function adaptStatus(status: StatusResponse, now = Date.now()): Service[] {
  return status.services.map((service) => adaptService(service, now));
}

const AVATAR_KEYS = ["eni", "miner", "grinder", "builder"] as const;

export function adaptBots(fleet: FleetResponse): FleetBot[] {
  return fleet.bots.map((bot, index) => ({
    id: bot.id,
    name: bot.name,
    role: index === 0 ? "Foreman" : "Coordinator agent",
    unit: index === 0 ? "mc-foreman" : "mc-cluster",
    // The API does not serve avatars; only the console's embedded art is used.
    avatar: AVATARS[AVATAR_KEYS[index % AVATAR_KEYS.length]],
    health: bot.health,
    food: bot.food,
    x: bot.x,
    y: bot.y,
    z: bot.z,
    dimension: bot.dimension,
    ping: bot.ping,
    basePing: bot.ping,
    activity: bot.activity,
    state: bot.state,
  }));
}

export type Telemetry = {
  hits: number;
  misses: number;
  p50: number | null;
  p95: number | null;
  throughput: number | null;
};

export function adaptTelemetry(raw: TelemetryResponse): Telemetry {
  return {
    hits: raw.hits,
    misses: raw.misses,
    p50: raw.latency.p50,
    p95: raw.latency.p95,
    throughput: raw.throughput,
  };
}

export function adaptProfiles(profiles: ProfileOption[]): Profile[] {
  return profiles.map((profile) => ({
    file: profile.file,
    name: profile.name,
    model: profile.model || "model not reported",
    online: profile.is_online,
    note: profile.hide_commands_in_chat
      ? `${profile.filename} · commands hidden in chat`
      : profile.filename,
  }));
}

/** Radar contacts are relative to ENI1; the display draws a compass bearing. */
export function adaptThreats(radar: ApiThreat[] | undefined, bot: { x: number | null; z: number | null } | undefined): Threat[] {
  if (!Array.isArray(radar)) return [];
  const originX = bot?.x ?? null;
  const originZ = bot?.z ?? null;
  return radar
    .map((contact) => {
      const dx = originX === null ? null : contact.x - originX;
      const dz = originZ === null ? null : contact.z - originZ;
      const distance = Number.isFinite(contact.distance)
        ? contact.distance
        : dx !== null && dz !== null
          ? Math.hypot(dx, dz)
          : null;
      if (distance === null || !Number.isFinite(distance)) return null;
      const bearing = dx !== null && dz !== null ? Math.atan2(dx, dz) : 0;
      return {
        username: contact.username,
        distance,
        bearing,
        heldItem: contact.heldItem || "empty",
        sneaking: Boolean(contact.isSneaking),
      } satisfies Threat;
    })
    .filter((threat): threat is Threat => threat !== null);
}

export function adaptAddonConfig(raw: Record<string, unknown> | undefined): Record<string, boolean | number> {
  const entries = Object.entries(raw ?? {}).filter(([, value]) => typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)));
  return Object.fromEntries(entries) as Record<string, boolean | number>;
}

/* ── Jobs ─────────────────────────────────────────────────── */

function jobStatus(raw: string | undefined): JobStatus {
  const value = String(raw ?? "").toLowerCase();
  if (STATUSES.has(value)) return value as JobStatus;
  if (value === "done" || value === "success") return "completed";
  if (value === "error") return "failed";
  if (value === "stopped") return "cancelled";
  return "queued";
}

function millis(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function adaptGrindJob(job: NonNullable<GrindResponse["grind"]["current"]>): GrindJob {
  return {
    id: job.id,
    target: job.target,
    requested: Number(job.requested) || 0,
    completed: Number(job.completed) || 0,
    status: jobStatus(job.status),
    createdAt: millis(job.createdAt) ?? 0,
    startedAt: millis(job.startedAt),
    finishedAt: millis(job.finishedAt),
    message: job.message || "",
  };
}

export function adaptGrind(state: GrindResponse["grind"]): { current: GrindJob | null; queue: GrindJob[]; history: GrindJob[] } {
  const history = (Array.isArray(state.history) ? state.history : []).map(adaptGrindJob);
  const queue = (Array.isArray(state.queue) ? state.queue : []).map(adaptGrindJob);
  let current = state.current ? adaptGrindJob(state.current) : null;
  // The server can leave a finished job in `current` until the next job starts.
  // Treat it as history so the console never shows two jobs at once.
  if (current && !isActiveJob(current.status)) {
    history.unshift(current);
    current = null;
  }
  return { current, queue, history: history.slice(0, 12) };
}

function buildName(job: SchematicJob): string {
  // The server renames every upload to `schem-<uuid>.schem`, so the operator's
  // own name is the only one worth showing.
  const source = job.sourceName || job.fileName || "schematic.schem";
  return prettyBlock(source.replace(/\.schem$/i, "").replace(/[_-]+/g, " ")).trim() || "Schematic";
}

function materials(job: SchematicJob): Material[] {
  const missing = new Set(Array.isArray(job.missing) ? job.missing : []);
  return Object.entries(job.materials ?? {}).map(([block, need]) => ({
    block,
    need: Number(need) || 0,
    missing: missing.has(block),
  }));
}

export function adaptBuildJob(job: SchematicJob): BuildJob {
  const origin = job.origin;
  return {
    id: job.id,
    fileName: job.sourceName || job.fileName || "schematic.schem",
    name: buildName(job),
    status: jobStatus(job.status),
    totalBlocks: Number(job.totalBlocks) || 0,
    placed: Number(job.placed) || 0,
    skipped: Number(job.skipped) || 0,
    layers: Number(job.size?.y) || 0,
    size: [Number(job.size?.x) || 0, Number(job.size?.y) || 0, Number(job.size?.z) || 0],
    createdAt: millis(job.createdAt) ?? 0,
    startedAt: millis(job.startedAt),
    finishedAt: millis(job.finishedAt),
    origin:
      origin && Number.isFinite(Number(origin.x)) && Number.isFinite(Number(origin.y)) && Number.isFinite(Number(origin.z))
        ? { x: Number(origin.x), y: Number(origin.y), z: Number(origin.z) }
        : null,
    rotation: Number(job.rotation) || 0,
    replaceBlocks: Boolean(job.replaceBlocks),
    materials: materials(job),
    message: job.message || "",
  };
}

export function adaptBuild(state: SchematicResponse): { current: BuildJob | null; queue: BuildJob[]; history: BuildJob[] } {
  const history = (Array.isArray(state.history) ? state.history : []).map(adaptBuildJob);
  let current = state.current ? adaptBuildJob(state.current) : null;
  if (current && !isActiveJob(current.status)) {
    history.unshift(current);
    current = null;
  }
  return { current, queue: [], history: history.slice(0, 10) };
}

/* ── Providers ────────────────────────────────────────────── */

export function adaptProviders(response: ProvidersResponse, previous: Provider[] = []): Provider[] {
  const seen = new Map(previous.map((provider) => [provider.id, provider]));
  return response.providers.map((provider: ApiProvider) => {
    const old = seen.get(provider.id);
    return {
      id: provider.id,
      name: provider.name,
      baseURL: provider.baseURL,
      keyName: provider.keyName,
      model: provider.model,
      timeoutMs: Number(provider.timeoutMs) || 30_000,
      keyConfigured: Boolean(provider.keyConfigured),
      enabled: Boolean(provider.enabled),
      latencyMs: old?.latencyMs ?? null,
      modelCount: old?.modelCount ?? null,
    };
  });
}

/* ── Settings ─────────────────────────────────────────────── */

export type SettingsState = {
  minecraft_version: string;
  host: string;
  port: string;
  auth: "offline" | "microsoft";
  mindserver_port: string;
  base_profile: string;
  narrate_behavior: boolean;
  auto_open_ui: boolean;
  allow_insecure_coding: boolean;
  load_memory: boolean;
  code_timeout_mins: string;
  spawn_timeout: string;
  only_chat_with: string;
  via_proxy_enabled: boolean;
  via_proxy_host: string;
  via_proxy_port: string;
  via_proxy_client_version: string;
};

export type EffectiveConfig = {
  host: string;
  port: number;
  version: string;
  auth: string;
  /** Settings pinned by a host environment variable. */
  overrides: Record<string, "env">;
};

function stringValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function adaptSettings(settings: Record<string, unknown>): SettingsState {
  const proxy = settings.via_proxy && typeof settings.via_proxy === "object" && !Array.isArray(settings.via_proxy)
    ? (settings.via_proxy as Record<string, unknown>)
    : {};
  const chat = settings.only_chat_with;
  return {
    minecraft_version: stringValue(settings.minecraft_version, "26.1"),
    host: stringValue(settings.host, "127.0.0.1"),
    port: stringValue(settings.port, "25565"),
    auth: settings.auth === "microsoft" ? "microsoft" : "offline",
    mindserver_port: stringValue(settings.mindserver_port, "8080"),
    base_profile: stringValue(settings.base_profile, "assistant"),
    narrate_behavior: boolValue(settings.narrate_behavior, true),
    auto_open_ui: boolValue(settings.auto_open_ui, true),
    allow_insecure_coding: boolValue(settings.allow_insecure_coding, false),
    load_memory: boolValue(settings.load_memory, false),
    code_timeout_mins: stringValue(settings.code_timeout_mins, "10"),
    spawn_timeout: stringValue(settings.spawn_timeout, "60"),
    only_chat_with: Array.isArray(chat) ? chat.map(String).join(", ") : stringValue(chat, ""),
    via_proxy_enabled: boolValue(proxy.enabled, false),
    via_proxy_host: stringValue(proxy.host, "127.0.0.1"),
    via_proxy_port: stringValue(proxy.port, "25568"),
    via_proxy_client_version: stringValue(proxy.client_version, "26.1"),
  };
}

/** The settings patch `POST /api/config` expects. Values must be typed: the
    server stringifies each top-level value into settings.js. */
export function settingsPatch(settings: SettingsState): Record<string, unknown> {
  const chats = settings.only_chat_with
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return {
    minecraft_version: settings.minecraft_version.trim(),
    host: settings.host.trim(),
    port: Number(settings.port),
    auth: settings.auth,
    mindserver_port: Number(settings.mindserver_port),
    base_profile: settings.base_profile.trim(),
    narrate_behavior: settings.narrate_behavior,
    auto_open_ui: settings.auto_open_ui,
    allow_insecure_coding: settings.allow_insecure_coding,
    load_memory: settings.load_memory,
    code_timeout_mins: Number(settings.code_timeout_mins),
    spawn_timeout: Number(settings.spawn_timeout),
    only_chat_with: chats,
    via_proxy: {
      enabled: settings.via_proxy_enabled,
      host: settings.via_proxy_host.trim(),
      port: Number(settings.via_proxy_port),
      client_version: settings.via_proxy_client_version.trim(),
    },
  };
}

export function adaptEffective(config: ConfigResponse["effective"]): EffectiveConfig {
  return {
    host: stringValue(config.host, "127.0.0.1"),
    port: Number(config.port) || 25565,
    version: stringValue(config.version, "26.1"),
    auth: stringValue(config.auth, "offline"),
    overrides: Object.fromEntries(
      Object.entries(config.overrides ?? {})
        .filter(([, value]) => value === "env")
        .map(([key]) => [key, "env" as const]),
    ),
  };
}

/** The configuration the running process actually uses, for the Fleet view. */
export function liveEffective(saved: SettingsState, effective: EffectiveConfig): EffectiveConfig {
  const pinned = effective.overrides;
  return {
    ...effective,
    host: pinned.host ? effective.host : saved.host.trim(),
    port: pinned.port ? effective.port : Number(saved.port) || effective.port,
    version: pinned.version ? effective.version : saved.minecraft_version.trim(),
    auth: pinned.auth ? effective.auth : saved.auth,
  };
}
