import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../data/api";
import type { AddonConfig, AddonsResponse, Provider } from "../data/types";
import { useKeyboardNav } from "../hooks/useKeyboardNav";
import { usePolling } from "../hooks/usePolling";
import { useSound } from "../hooks/useSound";
import { actions, useDashboard, type PollPayload } from "../state/store";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/icons";
import { Addons } from "../views/Addons";
import { Build } from "../views/Build";
import { Fleet } from "../views/Fleet";
import { Grind } from "../views/Grind";
import { Providers } from "../views/Providers";
import { Settings } from "../views/Settings";
import { CommandPalette } from "./CommandPalette";
import { Lightbox } from "./Lightbox";
import { Sidebar } from "./Sidebar";
import { TabNav } from "./TabNav";
import { TerminalDock } from "./TerminalDock";
import { ToastStack } from "./ToastStack";
import { TopBar } from "./TopBar";

async function fetchSnapshot(signal: AbortSignal): Promise<PollPayload> {
  const calls = [
    { key: "status", promise: api.status(signal) },
    { key: "fleet", promise: api.fleet(signal) },
    { key: "telemetry", promise: api.telemetry(signal) },
    { key: "config", promise: api.config(signal) },
    { key: "addons", promise: api.addons(signal) },
    { key: "grind", promise: api.grind(signal) },
    { key: "schematic", promise: api.schematic(signal) },
    { key: "providers", promise: api.providers(signal) },
  ] as const;

  const settled = await Promise.allSettled(calls.map((call) => call.promise));
  const payload: PollPayload = { failed: [] };
  let rejected = 0;

  settled.forEach((result, index) => {
    const key = calls[index].key;
    if (result.status === "rejected") {
      rejected += 1;
      payload.failed.push(key);
      return;
    }
    const value = result.value as
      | { services?: unknown; grind?: unknown; providers?: unknown; current?: unknown; config?: unknown }
      | null;
    switch (key) {
      case "status":
        payload.status = result.value as PollPayload["status"];
        break;
      case "fleet":
        payload.fleet = result.value as PollPayload["fleet"];
        break;
      case "telemetry":
        payload.telemetry = result.value as PollPayload["telemetry"];
        break;
      case "config":
        payload.config = result.value as PollPayload["config"];
        break;
      case "addons":
        payload.addons = result.value as AddonsResponse;
        break;
      case "grind": {
        const response = value as { grind?: PollPayload["grind"] } | null;
        payload.grind = response?.grind ?? null;
        break;
      }
      case "schematic": {
        const response = value as { current?: unknown; history?: unknown } | null;
        payload.schematic = {
          current: (response?.current ?? null) as NonNullable<PollPayload["schematic"]>["current"],
          history: (response?.history ?? []) as NonNullable<PollPayload["schematic"]>["history"],
        };
        break;
      }
      case "providers": {
        const response = value as { providers?: Provider[] } | null;
        payload.providers = Array.isArray(response?.providers) ? response.providers : null;
        break;
      }
      default:
        break;
    }
  });

  if (rejected === calls.length) {
    const first = settled.find((result) => result.status === "rejected");
    throw first && first.status === "rejected" ? first.reason : new Error("No dashboard endpoints responded");
  }
  return payload;
}

function ConfirmDialog() {
  const confirm = useDashboard((state) => state.confirm);
  const pending = useDashboard((state) => state.pendingByAction);
  const busy = confirm ? Object.values(pending).some((entry) => entry.status === "pending") : false;
  return (
    <Dialog
      open={Boolean(confirm)}
      onClose={() => actions.resolveConfirm(false)}
      eyebrow={confirm?.eyebrow ?? "Confirm action"}
      title={confirm?.title ?? "Are you sure?"}
      description={confirm?.description}
      footer={
        <>
          <Button variant="quiet" onClick={() => actions.resolveConfirm(false)} data-autofocus>
            {confirm?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={confirm?.danger ? "danger" : "primary"}
            onClick={() => actions.resolveConfirm(true)}
            disabled={busy}
            disabledReason="Wait for the current action to finish."
          >
            {confirm?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      <p className="note">
        This action is sent to the local supervisor. It will be logged in the console and can be reviewed from the
        terminal dock.
      </p>
    </Dialog>
  );
}

function OfflineBar({ onRetry, refreshing }: { onRetry: () => void; refreshing: boolean }) {
  const state = useDashboard();
  return (
    <div className="offline-bar" role="status">
      <span className="offline-bar__dot" aria-hidden="true" />
      <div>
        <strong>Dashboard offline</strong>
        <span>
          Showing the last received values. Fields without a confirmed snapshot are left empty{state.pollError ? ` · ${state.pollError}` : ""}. Retrying with exponential backoff up to 30 seconds.
        </span>
      </div>
      <Button size="sm" variant="secondary" loading={refreshing} loadingLabel="Retrying" onClick={onRetry}>
        Retry now
      </Button>
    </div>
  );
}

export function AppShell() {
  const sound = useDashboard((snapshot) => snapshot.sound);
  const toasts = useDashboard((snapshot) => snapshot.toasts);
  const navOpen = useDashboard((snapshot) => snapshot.navOpen);
  const paletteOpen = useDashboard((snapshot) => snapshot.paletteOpen);
  const view = useDashboard((snapshot) => snapshot.view);
  const offlinePreview = useDashboard((snapshot) => snapshot.offlinePreview);
  const pollError = useDashboard((snapshot) => snapshot.pollError);
  const terminalOpen = useDashboard((snapshot) => snapshot.terminalOpen);
  const lightboxOpen = useDashboard((snapshot) => snapshot.lightboxOpen);
  const booting = useDashboard((snapshot) => snapshot.booting);
  const play = useSound(sound);
  const lastToast = useRef(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("yz.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("yz.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
    } catch {
      /* storage unavailable */
    }
  }, [sidebarCollapsed]);

  const polling = usePolling(fetchSnapshot, {
    intervalMs: 5_000,
    onData: actions.applyPoll,
    onFailure: (error, failures) => actions.pollFailure(error, failures),
  });

  useEffect(() => actions.attachRefresh(polling.refresh), [polling.refresh]);

  useEffect(() => {
    const newest = toasts[toasts.length - 1];
    if (!newest || newest.id <= lastToast.current) return;
    lastToast.current = newest.id;
    play(newest.tone === "danger" ? "warn" : newest.tone === "warn" ? "warn" : "ok");
  }, [toasts, play]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") actions.setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useKeyboardNav({
    "mod+k": () => actions.setPaletteOpen(!paletteOpen),
    "mod+j": () => actions.toggleTerminal(),
    "shift+?": () => actions.setPaletteOpen(true),
    "g f": () => actions.setView("fleet"),
    "g g": () => actions.setView("grind"),
    "g b": () => actions.setView("build"),
    "g a": () => actions.setView("addons"),
    "g p": () => actions.setView("providers"),
    "g s": () => actions.setView("settings"),
    t: actions.toggleTheme,
    s: actions.toggleSound,
    r: polling.refresh,
  });

  const activeView = (() => {
    switch (view) {
      case "fleet":
        return <Fleet />;
      case "grind":
        return <Grind />;
      case "build":
        return <Build />;
      case "addons":
        return <Addons />;
      case "providers":
        return <Providers />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  })();

  return (
    <div
      className="shell"
      data-nav={navOpen ? "open" : undefined}
      data-sidebar={sidebarCollapsed ? "collapsed" : undefined}
      data-terminal={terminalOpen ? "open" : undefined}
    >
      <a className="skip-link" href="#main">
        Skip to dashboard content
      </a>
      <div className="ambient" aria-hidden="true">
        <span className="ambient__grid" />
        <span className="ambient__blob ambient__blob--rose" />
        <span className="ambient__blob ambient__blob--gold" />
      </div>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onClose={() => actions.setNavOpen(false)} />
      {navOpen && (
        <button
          type="button"
          className="drawer-scrim"
          aria-label="Close navigation drawer"
          onClick={() => actions.setNavOpen(false)}
        />
      )}
      <div className="main">
        <TopBar onRefresh={polling.refresh} refreshing={polling.loading} />
        <TabNav />
        {offlinePreview && <OfflineBar onRetry={polling.refresh} refreshing={polling.loading} />}
        {pollError && !offlinePreview && (
          <div className="partial-bar" role="status">
            <Icon name="alert" size={13} />
            <span>{pollError}</span>
            <button type="button" onClick={polling.refresh}>
              Retry
            </button>
          </div>
        )}
        <main className="view" id="main" tabIndex={-1} data-view={view}>
          <div key={view} role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
            {activeView}
          </div>
        </main>
      </div>
      <ToastStack />
      <CommandPalette />
      {terminalOpen && <TerminalDock />}
      {lightboxOpen && <Lightbox />}
      <ConfirmDialog />
      {booting && !offlinePreview && (
        <div className="boot-note" role="status">
          <span className="dot dot--pulse" aria-hidden="true" />
          Opening the telemetry bus…
        </div>
      )}
    </div>
  );
}
