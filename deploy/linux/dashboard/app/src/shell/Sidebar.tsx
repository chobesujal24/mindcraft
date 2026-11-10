import { armedAddonCount } from "../data/fixtures";
import { actions, useDashboard } from "../state/store";
import type { View } from "../data/types";
import { BrandMark } from "../ui/BrandMark";
import { Chip, StatusDot } from "../ui/Chip";
import { Icon, type IconName } from "../ui/icons";
import { shortcutLabel } from "../utils/platform";
import { serviceHealth } from "../utils/services";

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "fleet", label: "Fleet", icon: "fleet" },
  { id: "grind", label: "Grind", icon: "activity" },
  { id: "build", label: "Build", icon: "layers" },
  { id: "addons", label: "Add-ons", icon: "sliders" },
  { id: "providers", label: "AI providers", icon: "cpu" },
];

export function Sidebar({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const state = useDashboard();
  const agent = state.addons?.agentName ?? state.fleet?.bots[0]?.name ?? "ENI1";
  const health = serviceHealth(state.services);
  const enabledAddons = state.addons ? armedAddonCount(state.addons.config) : 0;
  const onlineBots = state.fleet?.bots.filter((bot) => bot.state === "active" || bot.state === "warning").length ?? 0;
  const tone = state.offlinePreview
    ? "warn"
    : state.failures > 0
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
  const serviceTotal = health.total;

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <button
        type="button"
        className="sidebar__collapse"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggle}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={14} />
      </button>
      <button type="button" className="sidebar__close" aria-label="Close navigation" onClick={onClose}>
        <Icon name="x" size={16} />
      </button>

      <div className="brand">
        <div className="brand__mark">
          <BrandMark size={30} />
        </div>
        <div className="brand__text">
          <div className="brand__name">
            Yozakura <span className="brand__kanji" aria-hidden="true">夜桜</span>
          </div>
          <div className="brand__sub">
            <b>ENI-01</b>
            <span className="brand__dot" aria-hidden="true" />
            <span>Field console</span>
          </div>
        </div>
      </div>

      <div className="cluster-card">
        <div className="cluster-card__top">
          <span className="cluster-card__name">
            {agent} <em>cluster</em>
          </span>
          <Chip tone={tone} dot pulse={!state.offlinePreview && Boolean(state.lastUpdated)}>
            {statusLabel}
          </Chip>
        </div>
        <div className="cluster-card__metrics">
          <div className="cluster-card__metric">
            <b>{String(onlineBots).padStart(2, "0")}</b>
            <span>Agents</span>
          </div>
          <div className="cluster-card__metric">
            <b>
              {health.active}
              <i>/{serviceTotal || "—"}</i>
            </b>
            <span>Core</span>
          </div>
          <div className="cluster-card__metric">
            <b>{String(enabledAddons).padStart(2, "0")}</b>
            <span>Add-ons</span>
          </div>
        </div>
        <div
          className="cluster-card__meter"
          data-tone={
            health.percent === null
              ? "neutral"
              : health.percent >= 100
                ? "ok"
                : health.percent >= 50
                  ? "warn"
                  : "danger"
          }
          aria-hidden="true"
        >
          <span style={{ width: `${health.percent ?? 0}%` }} />
        </div>
        <div className="cluster-card__foot">
          <span>Core availability</span>
          <b>{health.percent === null ? "—" : `${health.percent}%`}</b>
        </div>
      </div>

      <nav className="nav" aria-label="Dashboard views">
        <div className="nav-group">
          <div className="nav-group__label">Operations</div>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-link"
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={state.view === item.id ? "page" : undefined}
              onClick={() => actions.setView(item.id)}
            >
              <span className="nav-link__icon">
                <Icon name={item.icon} size={15} />
              </span>
              <span className="nav-link__label">{item.label}</span>
              {item.id === "addons" && enabledAddons > 0 && (
                <span className="nav-link__badge" aria-label={`${enabledAddons} enabled`}>
                  {enabledAddons}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="nav-group">
          <div className="nav-group__label">System</div>
          <button
            type="button"
            className="nav-link"
            title={collapsed ? "Settings" : undefined}
            aria-label="Settings"
            aria-current={state.view === "settings" ? "page" : undefined}
            onClick={() => actions.setView("settings")}
          >
            <span className="nav-link__icon">
              <Icon name="settings" size={15} />
            </span>
            <span className="nav-link__label">Settings</span>
          </button>
          <button
            type="button"
            className="nav-link"
            title={collapsed ? "Console" : undefined}
            aria-label="Console"
            onClick={() => actions.setTerminalOpen(true)}
          >
            <span className="nav-link__icon">
              <Icon name="terminal" size={15} />
            </span>
            <span className="nav-link__label">Console</span>
            <span className="nav-link__hint">{shortcutLabel("J")}</span>
          </button>
          <button
            type="button"
            className="nav-link"
            title={collapsed ? "Command palette" : undefined}
            aria-label="Command palette"
            onClick={() => actions.setPaletteOpen(true)}
          >
            <span className="nav-link__icon">
              <Icon name="command" size={15} />
            </span>
            <span className="nav-link__label">Command palette</span>
            <span className="nav-link__hint">{shortcutLabel("K")}</span>
          </button>
          <a className="nav-link" href="/?tab=legacy" title={collapsed ? "Legacy shell" : undefined} aria-label="Legacy shell">
            <span className="nav-link__icon">
              <Icon name="external" size={15} />
            </span>
            <span className="nav-link__label">Legacy shell</span>
            <span className="nav-link__hint">↗</span>
          </a>
        </div>
      </nav>

      <div className="sidebar__foot">
        <div className="sidebar__foot-row">
          <span className="sidebar__status">
            <StatusDot tone={tone} pulse={!state.offlinePreview && Boolean(state.lastUpdated)} />
            {statusLabel} telemetry
          </span>
          <span>5s</span>
        </div>
        <div className="sidebar__foot-row">
          <span>ENI-01 · v{state.config?.version ?? "0.1.4"}</span>
          <span>{state.lastUpdated ? "polling 5s" : "awaiting bus"}</span>
        </div>
      </div>
    </aside>
  );
}
