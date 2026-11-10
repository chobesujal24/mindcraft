import { useEffect, useRef } from "react";
import { actions, useDashboard } from "../state/store";
import type { View } from "../data/types";
import { relative } from "../utils/format";
import { BrandMark } from "../ui/BrandMark";
import { Button, IconButton } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/icons";
import { shortcutLabel } from "../utils/platform";
import { serviceHealth } from "../utils/services";

const META: Record<View, { group: string; title: string }> = {
  fleet: { group: "Operations", title: "Fleet" },
  grind: { group: "Operations", title: "Grind" },
  build: { group: "Operations", title: "Build" },
  addons: { group: "Operations", title: "Add-ons" },
  providers: { group: "Operations", title: "AI providers" },
  settings: { group: "System", title: "Settings" },
};

type TopBarProps = {
  onRefresh: () => void;
  refreshing: boolean;
};

type Alert = { id: string; title: string; detail: string; tone: "ok" | "warn" | "danger" | "accent" };

export function TopBar({ onRefresh, refreshing }: TopBarProps) {
  const state = useDashboard();
  const meta = META[state.view];
  const health = serviceHealth(state.services);
  const p95 = state.telemetry?.latency?.p95;
  const tone = state.offlinePreview
    ? "warn"
    : state.failures > 0 || (health.total > 0 && health.active < health.total)
      ? "danger"
      : state.pollError
        ? "warn"
        : state.lastUpdated
          ? "ok"
          : "neutral";
  const statusLabel = state.offlinePreview
    ? "Offline"
    : state.failures > 0 || state.pollError
      ? "Degraded"
      : state.lastUpdated
        ? "API live"
        : "Connecting";
  const restartKey = "service:mc-foreman:restart";
  const restartPending = state.pendingByAction[restartKey]?.status === "pending";
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const alerts: Alert[] = [];
  if (state.offlinePreview) {
    alerts.push({
      id: "offline",
      title: "Dashboard offline",
      detail: "Showing last received values; unavailable fields are left blank. Retrying every 30 seconds.",
      tone: "warn",
    });
  }
  health.core
    .filter((service) => service.state !== "active")
    .forEach((service) => {
      alerts.push({
        id: `svc-${service.name}`,
        title: `${service.name} is ${service.state}`,
        detail: "Open Fleet to start, restart, or inspect the logs.",
        tone: "danger",
      });
    });
  const build = state.build?.current;
  if (build && build.missing.length > 0) {
    alerts.push({
      id: "build-missing",
      title: `${build.missing.length} material shortage${build.missing.length === 1 ? "" : "s"}`,
      detail: `${build.sourceName} is waiting on ${build.missing.slice(0, 3).join(", ")}.`,
      tone: "warn",
    });
  }
  if (state.jobs?.current) {
    alerts.push({
      id: "grind",
      title: "Grind job in progress",
      detail: `${state.jobs.current.completed}/${state.jobs.current.requested} ${state.jobs.current.target.replace(/_/g, " ")} collected.`,
      tone: "accent",
    });
  }
  const pendingErrors = Object.entries(state.pendingByAction).filter(([, entry]) => entry.status === "error");
  pendingErrors.slice(0, 2).forEach(([key, entry]) => {
    alerts.push({
      id: `pending-${key}`,
      title: `${entry.label ?? key} needs attention`,
      detail: entry.error ?? "The last action failed. Retry it from its inline control.",
      tone: "danger",
    });
  });
  if (alerts.length === 0) {
    alerts.push(state.lastUpdated
      ? {
          id: "clear",
          title: "All clear",
          detail: "No service, build, or queue warnings right now.",
          tone: "ok",
        }
      : {
          id: "connecting",
          title: "Connecting to telemetry",
          detail: "Waiting for the first dashboard snapshot.",
          tone: "warn",
        });
  }

  useEffect(() => {
    if (!state.notificationsOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && popoverRef.current && !popoverRef.current.contains(target)) {
        actions.setNotificationsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") actions.setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [state.notificationsOpen]);

  const restartForeman = async () => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Service supervisor",
      title: "Restart mc-foreman?",
      description:
        "ENI1 will disconnect from the cluster for a few seconds while the foreman restarts. Queued grind and schematic state is persisted.",
      confirmLabel: "Restart foreman",
      danger: true,
    });
    if (confirmed) void actions.serviceAction("mc-foreman", "restart");
  };

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__lead">
          <button
            type="button"
            className="icon-btn topbar__menu"
            aria-label="Open navigation"
            aria-expanded={state.navOpen}
            onClick={() => actions.setNavOpen(true)}
          >
            <Icon name="menu" size={17} />
          </button>
          <div className="topbar__brand">
            <BrandMark size={18} decorative />
            <span>Yozakura</span>
          </div>
          <div className="topbar__title">
            <div className="topbar__crumbs">
              <span>Yozakura</span>
              <Icon name="chevron-right" size={9} />
              <span>{meta.group}</span>
            </div>
            <div className="topbar__heading">{meta.title}</div>
          </div>
          <Chip tone={tone} dot pulse={!state.offlinePreview && Boolean(state.lastUpdated)} className="topbar__pill">
            {statusLabel}
          </Chip>
          <span className="sync">
            Updated <strong>{relative(state.lastUpdated)}</strong>
          </span>
        </div>

        <div className="topbar__spacer" />

        <div className="topbar__actions">
          <Chip tone={health.total === 0 ? "neutral" : health.active >= health.total ? "ok" : "warn"} className="topbar__pill topbar__pill--services">
            {health.total ? `${health.active}/${health.total} core` : "Services —"}
          </Chip>
          <span className="sync topbar__pill--telemetry">
            p95 <strong>{typeof p95 === "number" && p95 > 0 ? `${Math.round(p95)}ms` : "—"}</strong>
          </span>
          <IconButton
            label={state.theme === "yozakura" ? "Switch to Hanami daylight" : "Switch to Yozakura night"}
            onClick={actions.toggleTheme}
          >
            <Icon name={state.theme === "yozakura" ? "sun" : "moon"} size={16} />
          </IconButton>
          <IconButton
            label={state.sound ? "Mute interface chimes" : "Enable interface chimes"}
            pressed={state.sound}
            onClick={actions.toggleSound}
            className="topbar__sound"
          >
            <Icon name={state.sound ? "volume" : "volume-x"} size={16} />
          </IconButton>
          <IconButton label="Refresh dashboard" onClick={onRefresh} loading={refreshing}>
            <Icon name="refresh" size={16} />
          </IconButton>
          <button type="button" className="topbar__palette" onClick={() => actions.setPaletteOpen(true)}>
            <Icon name="search" size={13} />
            <span>Command</span>
            <span className="kbd">{shortcutLabel("K")}</span>
          </button>
          <div className="topbar__notifications" ref={popoverRef} style={{ position: "relative" }}>
            <IconButton
              label={`Notifications, ${alerts.length} item${alerts.length === 1 ? "" : "s"}`}
              pressed={state.notificationsOpen}
              aria-haspopup="dialog"
              aria-expanded={state.notificationsOpen}
              onClick={() => actions.setNotificationsOpen(!state.notificationsOpen)}
            >
              <Icon name="bell" size={16} />
              {alerts.length > 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 7,
                    right: 7,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
              )}
            </IconButton>
            {state.notificationsOpen && (
              <div className="notifications-popover" role="dialog" aria-label="Notifications">
                <div className="notifications-popover__head">
                  <span className="eyebrow">Status log</span>
                  <span className="mono mute">{alerts.length} ITEMS</span>
                </div>
                <div className="notifications-popover__list">
                  {alerts.map((alert) => (
                    <div className="notification-row" key={alert.id}>
                      <Chip tone={alert.tone} dot>
                        {alert.tone === "ok" ? "Clear" : alert.tone === "danger" ? "Alert" : alert.tone === "warn" ? "Watch" : "Info"}
                      </Chip>
                      <div>
                        <div className="notification-row__title">{alert.title}</div>
                        <div className="notification-row__detail">{alert.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="notifications-popover__foot">
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => {
                      actions.setNotificationsOpen(false);
                      actions.setView("fleet");
                    }}
                  >
                    Open fleet
                  </button>
                  <button type="button" className="btn btn--quiet" onClick={() => actions.setTerminalOpen(true)}>
                    Open console
                  </button>
                </div>
              </div>
            )}
          </div>
          <span className="topbar__divider" aria-hidden="true" />
          <div className="topbar__primary">
            <Button
              variant="quiet"
              size="md"
              aria-label="Restart foreman"
              leading={<Icon name="power" size={12} />}
              onClick={restartForeman}
              loading={restartPending}
              loadingLabel="Restarting"
              disabledReason="A restart is already in progress."
              disabled={restartPending}
            >
              <span className="btn__label-long">Restart foreman</span>
              <span className="btn__label-short">Restart</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
