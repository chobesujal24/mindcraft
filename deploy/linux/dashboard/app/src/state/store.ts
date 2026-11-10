import { useSyncExternalStore } from "react";
import { api, apiErrorMessage } from "../data/api";
import type { AddonDefinition } from "../data/fixtures";
import type {
  AddonConfig,
  AddonsResponse,
  ConfigResponse,
  FleetResponse,
  GrindJob,
  GrindState,
  Provider,
  ProviderTest,
  SchematicState,
  Service,
  StatusResponse,
  TelemetryResponse,
  Theme,
  Toast,
  View,
} from "../data/types";

export type PendingEntry = { status: "pending" | "error"; error?: string; label?: string };

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  eyebrow?: string;
};

type ConfirmState = ConfirmOptions & { id: string; resolve: (value: boolean) => void };

export type PollPayload = {
  status?: StatusResponse;
  fleet?: FleetResponse;
  telemetry?: TelemetryResponse;
  config?: ConfigResponse;
  addons?: AddonsResponse;
  grind?: GrindState | null;
  schematic?: SchematicState | null;
  providers?: Provider[] | null;
  failed: string[];
};

export type DashState = {
  view: View;
  theme: Theme;
  sound: boolean;
  fleet: FleetResponse | null;
  services: Service[];
  telemetry: TelemetryResponse | null;
  config: ConfigResponse | null;
  addons: AddonsResponse | null;
  jobs: GrindState | null;
  build: SchematicState | null;
  providers: Provider[] | null;
  toasts: Toast[];
  pendingByAction: Record<string, PendingEntry>;
  offlinePreview: boolean;
  failures: number;
  pollError: string | null;
  lastUpdated: number | null;
  booting: boolean;
  paletteOpen: boolean;
  terminalOpen: boolean;
  navOpen: boolean;
  lightboxOpen: boolean;
  notificationsOpen: boolean;
  confirm: ConfirmState | null;
  latencyHistory: number[];
  throughputHistory: number[];
};

const VIEWS: View[] = ["fleet", "grind", "build", "addons", "providers", "settings"];
const THEME_KEY = "yz.theme";
const SOUND_KEY = "yz.sound";
const TAB_KEY = "yz.tab";

function readHashView(): View | null {
  try {
    const hash = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
    return VIEWS.includes(hash as View) ? (hash as View) : null;
  } catch {
    return null;
  }
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage is optional */
  }
}

function initialTheme(): Theme {
  const stored = load<Theme>(THEME_KEY, "yozakura");
  return stored === "hanami" ? "hanami" : "yozakura";
}

function initialView(): View {
  return readHashView() ?? (VIEWS.includes(load<View>(TAB_KEY, "fleet")) ? load<View>(TAB_KEY, "fleet") : "fleet");
}

const initialState: DashState = {
  view: initialView(),
  theme: initialTheme(),
  sound: load<boolean>(SOUND_KEY, false),
  fleet: null,
  services: [],
  telemetry: null,
  config: null,
  addons: null,
  jobs: null,
  build: null,
  providers: null,
  toasts: [],
  pendingByAction: {},
  offlinePreview: false,
  failures: 0,
  pollError: null,
  lastUpdated: null,
  booting: true,
  paletteOpen: false,
  terminalOpen: false,
  navOpen: false,
  lightboxOpen: false,
  notificationsOpen: false,
  confirm: null,
  latencyHistory: [],
  throughputHistory: [],
};

let state: DashState = initialState;
const listeners = new Set<() => void>();
const toastTimers = new Map<number, number>();
let toastId = 1;
let refreshHandler: (() => void) | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function set(patch: Partial<DashState>) {
  state = { ...state, ...patch };
  emit();
}

export function getState(): DashState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDashboard<T = DashState>(selector?: (snapshot: DashState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => (selector ? selector(state) : (state as unknown as T)),
    () => (selector ? selector(state) : (state as unknown as T)),
  );
}

function setPending(key: string, entry: PendingEntry | null) {
  const next = { ...state.pendingByAction };
  if (entry) {
    // Reinsert updated records so oldest errors can be pruned predictably.
    delete next[key];
    next[key] = entry;
    if (entry.status === "error") {
      const errors = Object.keys(next).filter((candidate) => next[candidate].status === "error");
      while (errors.length > 32) {
        const oldest = errors.shift();
        if (oldest) delete next[oldest];
      }
    }
  } else delete next[key];
  set({ pendingByAction: next });
}

function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  save(THEME_KEY, theme);
}

function applySound(sound: boolean) {
  document.documentElement.dataset.sound = sound ? "on" : "off";
  save(SOUND_KEY, sound);
}

applyTheme(state.theme);
applySound(state.sound);

function toast(title: string, detail?: string, tone: Toast["tone"] = "ok") {
  const id = toastId++;
  const next = [...state.toasts, { id, title, detail, tone }].slice(-3);
  state.toasts.forEach((item) => {
    if (!next.some((candidate) => candidate.id === item.id)) {
      const timer = toastTimers.get(item.id);
      if (timer) window.clearTimeout(timer);
      toastTimers.delete(item.id);
    }
  });
  set({ toasts: next });
  const timer = window.setTimeout(() => dismissToast(id), 3_500);
  toastTimers.set(id, timer);
}

function dismissToast(id: number) {
  const timer = toastTimers.get(id);
  if (timer) window.clearTimeout(timer);
  toastTimers.delete(id);
  set({ toasts: state.toasts.filter((item) => item.id !== id) });
}

function markOffline() {
  set({ offlinePreview: true, booting: false });
}

export const actions = {
  attachRefresh(handler: () => void) {
    refreshHandler = handler;
    return () => {
      if (refreshHandler === handler) refreshHandler = null;
    };
  },

  refresh() {
    refreshHandler?.();
  },

  setView(view: View) {
    if (!VIEWS.includes(view)) return;
    save(TAB_KEY, view);
    set({ view, navOpen: false, paletteOpen: false });
    try {
      const next = `${window.location.pathname}${window.location.search}#${view}`;
      window.history.replaceState(null, "", next);
    } catch {
      /* ignore */
    }
  },

  setTheme(theme: Theme) {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme() {
    actions.setTheme(state.theme === "yozakura" ? "hanami" : "yozakura");
  },

  setSound(sound: boolean) {
    applySound(sound);
    set({ sound });
  },

  toggleSound() {
    actions.setSound(!state.sound);
  },

  setPaletteOpen(open: boolean) {
    set({ paletteOpen: open, notificationsOpen: false, navOpen: false });
  },

  setTerminalOpen(open: boolean) {
    set({ terminalOpen: open, paletteOpen: false });
  },

  toggleTerminal() {
    actions.setTerminalOpen(!state.terminalOpen);
  },

  setNavOpen(open: boolean) {
    set({ navOpen: open });
  },

  setNotificationsOpen(open: boolean) {
    set({ notificationsOpen: open, paletteOpen: false });
  },

  setLightboxOpen(open: boolean) {
    set({ lightboxOpen: open });
  },

  notify(title: string, detail?: string, tone: Toast["tone"] = "ok") {
    toast(title, detail, tone);
  },

  dismissToast,

  requestConfirm(options: ConfirmOptions): Promise<boolean> {
    state.confirm?.resolve(false);
    return new Promise((resolve) => {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
      set({ confirm: { ...options, id, resolve } });
    });
  },

  resolveConfirm(value: boolean) {
    const current = state.confirm;
    if (!current) return;
    set({ confirm: null });
    current.resolve(value);
  },

  applyPoll(payload: PollPayload) {
    const wasOffline = state.offlinePreview;
    const p95 = payload.telemetry?.latency?.p95;
    const throughput = payload.telemetry?.throughput;
    const latencyHistory =
      typeof p95 === "number" && Number.isFinite(p95)
        ? [...state.latencyHistory, p95].slice(-28)
        : state.latencyHistory;
    const throughputHistory =
      typeof throughput === "number" && Number.isFinite(throughput)
        ? [...state.throughputHistory, throughput].slice(-28)
        : state.throughputHistory;
    set({
      services: payload.status?.services ?? state.services,
      fleet: payload.fleet ?? state.fleet,
      telemetry: payload.telemetry ?? state.telemetry,
      config: payload.config ?? state.config,
      addons: payload.addons ?? state.addons,
      jobs: payload.grind ?? state.jobs,
      build: payload.schematic ?? state.build,
      providers: payload.providers ?? state.providers,
      offlinePreview: false,
      failures: 0,
      pollError: payload.failed.length ? `Partial sync: ${payload.failed.join(", ")}` : null,
      lastUpdated: Date.now(),
      booting: false,
      latencyHistory,
      throughputHistory,
    });
    if (wasOffline) {
      toast(
        payload.failed.length ? "Dashboard connection restored" : "Live telemetry restored",
        payload.failed.length
          ? `Some endpoints are still unavailable: ${payload.failed.join(", ")}.`
          : "The dashboard is receiving live cluster data.",
        "info",
      );
    }
  },

  pollFailure(error: unknown, failures: number) {
    const wasOffline = state.offlinePreview;
    const message = apiErrorMessage(error);
    set({ failures, pollError: message, booting: false });
    if (failures >= 2) {
      markOffline();
      if (!wasOffline) {
        toast("Dashboard offline", "Showing last received data only. Retrying every 30 seconds.", "warn");
      }
    }
  },

  enterOfflinePreview() {
    markOffline();
  },

  async serviceAction(name: string, action: "start" | "stop" | "restart") {
    const key = `service:${name}:${action}`;
    const previous = state.services;
    const optimistic = action === "stop" ? "stopping" : action === "start" ? "starting" : "restarting";
    set({
      services: state.services.map((service) =>
        service.name === name ? { ...service, state: optimistic } : service,
      ),
    });
    setPending(key, { status: "pending", label: `${action} ${name}` });
    try {
      await api.service(name, action);
      setPending(key, null);
      toast(`${name} ${action}ed`, "The service supervisor accepted the request.", "ok");
      refreshHandler?.();
    } catch (error) {
      set({ services: previous });
      setPending(key, { status: "error", error: apiErrorMessage(error), label: `${action} ${name}` });
      toast(`${action} ${name} failed`, apiErrorMessage(error), "danger");
    }
  },

  async saveConfig(body: Record<string, unknown>, key = "config:save", success = "Configuration saved") {
    setPending(key, { status: "pending", label: "Save configuration" });
    try {
      await api.saveConfig(body);
      setPending(key, null);
      toast(success, "Restarting only the services affected by this change.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      setPending(key, { status: "error", error: apiErrorMessage(error), label: "Save configuration" });
      toast("Could not save configuration", apiErrorMessage(error), "danger");
      return false;
    }
  },

  async switchProfile(file: string) {
    const key = `profile:${file}`;
    const previous = state.fleet;
    if (state.fleet) set({ fleet: { ...state.fleet, activeProfile: file } });
    setPending(key, { status: "pending", label: "Switch profile" });
    try {
      await api.saveConfig({ active_profile: file, restart: "eni" });
      setPending(key, null);
      toast("Profile switched", "ENI1 is restarting with the selected profile.", "ok");
      refreshHandler?.();
    } catch (error) {
      set({ fleet: previous });
      setPending(key, { status: "error", error: apiErrorMessage(error), label: "Switch profile" });
      toast("Profile switch failed", apiErrorMessage(error), "danger");
    }
  },

  setAddonLocal(key: string, value: boolean | number | string) {
    if (!state.addons) return;
    set({
      addons: {
        ...state.addons,
        config: { ...state.addons.config, [key]: value },
      },
    });
  },

  async commitAddon(key: string, value: boolean | number | string, fallback: boolean | number | string) {
    const pendingKey = `addon:${key}`;
    setPending(pendingKey, { status: "pending", label: labelFor(key) });
    try {
      const result = (await api.saveAddons({ [key]: value })) as {
        config?: AddonConfig;
        applied?: boolean;
        message?: string;
      };
      if (state.addons && result?.config && key in result.config) {
        set({
          addons: { ...state.addons, config: { ...state.addons.config, [key]: result.config[key] } },
        });
      }
      setPending(pendingKey, null);
      toast(
        `${labelFor(key)} ${typeof value === "boolean" ? (value ? "enabled" : "standby") : "updated"}`,
        result?.applied ? "Applied to the running agent." : "Saved for the next agent start.",
        result?.applied === false ? "warn" : "ok",
      );
      refreshHandler?.();
      return true;
    } catch (error) {
      actions.setAddonLocal(key, fallback);
      setPending(pendingKey, {
        status: "error",
        error: apiErrorMessage(error),
        label: labelFor(key),
      });
      toast(`${labelFor(key)} was not saved`, apiErrorMessage(error), "danger");
      return false;
    }
  },

  async saveAllAddons(patch: AddonConfig, fallback: AddonConfig) {
    if (!state.addons) return false;
    set({ addons: { ...state.addons, config: { ...state.addons.config, ...patch } } });
    setPending("addons:all", { status: "pending", label: "All add-ons" });
    try {
      const result = (await api.saveAddons(patch)) as { config?: AddonConfig; applied?: boolean };
      if (state.addons && result?.config) {
        set({ addons: { ...state.addons, config: result.config } });
      }
      setPending("addons:all", null);
      toast("Add-on fleet updated", result?.applied ? "Applied to the running agent." : "Saved for the next start.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      if (state.addons) set({ addons: { ...state.addons, config: fallback } });
      setPending("addons:all", { status: "error", error: apiErrorMessage(error), label: "All add-ons" });
      toast("Batch add-on update failed", apiErrorMessage(error), "danger");
      return false;
    }
  },

  async dispatchAddon(action: string, label: string, command?: string) {
    const key = `dispatch:${action}${command ? `:${command}` : ""}`;
    setPending(key, { status: "pending", label });
    try {
      const result = (await api.addonAction(action, command)) as { applied?: boolean };
      setPending(key, null);
      toast(
        `${label} dispatched`,
        result?.applied ? "The live bot accepted the packet." : "Queued for the next bot connection.",
        result?.applied === false ? "warn" : "ok",
      );
      refreshHandler?.();
      return true;
    } catch (error) {
      setPending(key, { status: "error", error: apiErrorMessage(error), label });
      toast(`${label} failed`, apiErrorMessage(error), "danger");
      return false;
    }
  },

  async sendCommand(command: string) {
    const trimmed = command.trim();
    if (!trimmed) return false;
    const key = "terminal:command";
    setPending(key, { status: "pending", label: "Command" });
    try {
      const result = (await api.addonAction("send_command", trimmed)) as { applied?: boolean };
      setPending(key, null);
      toast("Command dispatched", result?.applied ? trimmed : `${trimmed} · queued for the bot`, result?.applied === false ? "warn" : "ok");
      return true;
    } catch (error) {
      setPending(key, { status: "error", error: apiErrorMessage(error), label: "Command" });
      return false;
    }
  },

  async queueGrind(input: {
    target: string;
    count: number;
  }) {
    const optimistic: GrindJob = {
      id: `pending-${Date.now()}`,
      target: input.target,
      requested: input.count,
      completed: 0,
      status: "submitting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      message: "Submitting to the grind queue…",
    };
    if (state.jobs) {
      set({
        jobs: {
          ...state.jobs,
          queue: [...state.jobs.queue, optimistic],
        },
      });
    }
    setPending("grind:queue", { status: "pending", label: "Queue grind" });
    try {
      await api.grindAction({ action: "queue", target: input.target, count: input.count });
      setPending("grind:queue", null);
      toast("Grind job queued", `${input.count} × ${input.target.replace(/_/g, " ")} added to the queue.`, "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      if (state.jobs) {
        set({ jobs: { ...state.jobs, queue: state.jobs.queue.filter((job) => job.id !== optimistic.id) } });
      }
      setPending("grind:queue", { status: "error", error: apiErrorMessage(error), label: "Queue grind" });
      toast("Grind job was not queued", apiErrorMessage(error), "danger");
      return false;
    }
  },

  async grindControl(action: "pause" | "resume" | "cancel", jobId?: string) {
    const key = `grind:${action}`;
    const previous = state.jobs;
    if (state.jobs?.current) {
      const status = action === "pause" ? "pausing" : action === "resume" ? "running" : "cancelling";
      set({ jobs: { ...state.jobs, current: { ...state.jobs.current, status } } });
    }
    setPending(key, { status: "pending", label: `Grind ${action}` });
    try {
      await api.grindAction({ action, jobId });
      setPending(key, null);
      toast(`Grind ${action === "cancel" ? "aborted" : action === "pause" ? "paused" : "resumed"}`, "The queue state has been refreshed.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      set({ jobs: previous });
      setPending(key, { status: "error", error: apiErrorMessage(error), label: `Grind ${action}` });
      toast(`Could not ${action} grind`, apiErrorMessage(error), "danger");
      return false;
    }
  },

  async uploadBuild(
    file: File,
    params: Record<string, string>,
    onProgress?: (percent: number, loaded: number, total: number) => void,
  ) {
    setPending("build:upload", { status: "pending", label: "Upload schematic" });
    try {
      await api.uploadSchematic(file, params, undefined, onProgress);
      setPending("build:upload", null);
      toast("Schematic uploaded", "ENI1 will validate and begin the build.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      setPending("build:upload", { status: "error", error: apiErrorMessage(error), label: "Upload schematic" });
      toast("Schematic upload failed", apiErrorMessage(error), "danger");
      return false;
    }
  },

  async buildControl(action: "pause" | "resume" | "cancel") {
    const key = `build:${action}`;
    const previous = state.build;
    if (state.build?.current) {
      const status = action === "pause" ? "pausing" : action === "resume" ? "running" : "cancelling";
      set({ build: { ...state.build, current: { ...state.build.current, status } } });
    }
    setPending(key, { status: "pending", label: `Build ${action}` });
    try {
      await api.schematicControl(action);
      setPending(key, null);
      toast(`Build ${action === "cancel" ? "aborted" : action === "pause" ? "paused" : "resumed"}`, "Schematic state refreshed.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      set({ build: previous });
      setPending(key, { status: "error", error: apiErrorMessage(error), label: `Build ${action}` });
      toast(`Could not ${action} build`, apiErrorMessage(error), "danger");
      return false;
    }
  },

  async saveProviders(providers: Provider[], apiKeys: Record<string, string>, clearKeys: string[] = []) {
    setPending("providers:save", { status: "pending", label: "Save providers" });
    try {
      await api.saveProviders(providers, apiKeys, clearKeys);
      setPending("providers:save", null);
      toast("Provider order saved", "ENI1 is restarting to load the new routing table.", "ok");
      refreshHandler?.();
      return true;
    } catch (error) {
      setPending("providers:save", { status: "error", error: apiErrorMessage(error), label: "Save providers" });
      toast("Providers were not saved", apiErrorMessage(error), "danger");
      return false;
    }
  },

  async testProvider(
    provider: Pick<Provider, "id" | "baseURL" | "keyName" | "model">,
    testKey?: string,
  ): Promise<ProviderTest | null> {
    const key = `provider:test:${provider.id}`;
    setPending(key, { status: "pending", label: "Test provider" });
    try {
      const result = await api.testProvider(provider, testKey);
      setPending(key, null);
      return result;
    } catch (error) {
      setPending(key, { status: "error", error: apiErrorMessage(error), label: "Test provider" });
      return null;
    }
  },
};

export type AddonCatalogEntry = AddonDefinition;
