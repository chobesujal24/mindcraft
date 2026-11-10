import { actions, useDashboard } from "../../state/store";
import { number, relative } from "../../utils/format";
import { BrandMark } from "../../ui/BrandMark";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Icon } from "../../ui/icons";
import { Sparkline } from "../../ui/Sparkline";
import { hasFreshTelemetry } from "../../utils/telemetry";
import { serviceHealth } from "../../utils/services";

export function FleetHero() {
  const state = useDashboard();
  const bots = state.fleet?.bots ?? [];
  const online = bots.filter((bot) => bot.state === "active").length;
  const reporting = bots.filter((bot) => bot.state === "active" || bot.state === "warning").length;
  const primaryBotState = bots[0]?.state ?? "idle";
  const radarLive = !state.offlinePreview
    && state.addons?.config.player_radar === true
    && hasFreshTelemetry(state.addons?.live?.timestamp);
  const botConnected = !state.offlinePreview && primaryBotState === "active";
  const connectionTone = state.offlinePreview
    ? "warn"
    : primaryBotState === "active"
      ? "ok"
      : primaryBotState === "warning" || primaryBotState === "stale"
        ? "warn"
        : "danger";
  const connectionLabel = state.offlinePreview
    ? "Offline snapshot"
    : primaryBotState === "active"
      ? "Bot connected"
      : primaryBotState === "stale"
        ? "Telemetry stale"
        : primaryBotState === "warning"
          ? "Bot unavailable"
          : bots.length
            ? "Bot offline"
            : "Awaiting bot";
  const health = serviceHealth(state.services);
  const p95 = state.telemetry?.latency.p95;
  const throughput = state.telemetry?.throughput;
  const hits = state.telemetry?.hits;
  const misses = state.telemetry?.misses;
  const latencyHistory = state.latencyHistory;
  const throughputHistory = state.throughputHistory;
  const samples = Math.max(latencyHistory.length, throughputHistory.length);
  const job = state.jobs?.current;
  const jobCompleted = job && typeof job.completed === "number" && Number.isFinite(job.completed) ? job.completed : 0;
  const jobRequested =
    job && typeof job.requested === "number" && Number.isFinite(job.requested) && job.requested > 0
      ? job.requested
      : 1;
  const progress = job ? Math.max(0, Math.min(100, Math.round((jobCompleted / jobRequested) * 100))) : null;
  const activeProfile = state.fleet?.activeProfile?.split("/").pop()?.replace(".json", "") || "Not reported";
  const agentName = state.fleet?.bots[0]?.name || "Fleet status";
  const p95Label = typeof p95 === "number" && p95 > 0 ? `${number(p95)} ms` : "not sampled";

  const statusLine = state.offlinePreview
    ? `Showing the last confirmed snapshot from ${relative(state.lastUpdated)}. Live polling is paused; values without a confirmed reading stay blank.`
    : bots.length === 0
      ? "No agent has reported yet. The console retries every five seconds, then backs off while the telemetry bus is unavailable."
      : `${reporting} of ${bots.length} agents reporting. ${health.active} of ${health.total || "—"} core services are up. API p95 is ${p95Label}.${
          job && progress !== null
            ? ` Grind is ${progress}% through ${(job.target || "the current target").replace(/_/g, " ")}.`
            : " The grind queue is idle."
        }`;

  return (
    <section className="command-hero" aria-labelledby="fleet-hero-title">
      <div className="command-hero__intro">
        <div className="command-hero__kicker">
          <Chip tone={connectionTone} dot pulse={botConnected}>
            {connectionLabel}
          </Chip>
          <span className="mono mute">
            FLEET / {String(online).padStart(2, "0")} OF {String(bots.length || 0).padStart(2, "0")} ONLINE
          </span>
        </div>
        <h1 className="display command-hero__title" id="fleet-hero-title">
          Fleet
        </h1>
        <p className="command-hero__copy">{statusLine}</p>
        <div className="command-hero__actions">
          <Button
            size="sm"
            variant="quiet"
            leading={<Icon name="activity" size={13} />}
            onClick={() => actions.setView("grind")}
          >
            Queue grind
          </Button>
          <Button
            size="sm"
            variant="quiet"
            leading={<Icon name="layers" size={13} />}
            onClick={() => actions.setView("build")}
          >
            Upload build
          </Button>
          <Button
            size="sm"
            variant="quiet"
            leading={<Icon name="compass" size={13} />}
            onClick={() => actions.setLightboxOpen(true)}
          >
            Open radar
          </Button>
        </div>
        <div className="command-hero__meta">
          <BrandMark className="command-hero__watermark" size={18} decorative />
          <span>
            Agent <b>{agentName}</b>
          </span>
          <span>
            Profile <b>{activeProfile}</b>
          </span>
          <span>
            Radar <b>{radarLive ? "live" : "unavailable"}</b>
          </span>
        </div>
      </div>

      <aside className="hero-pulse" aria-label="Cluster telemetry trend">
        <div className="hero-pulse__head">
          <div>
            <span className="eyebrow">Cluster pulse</span>
            <span className="hero-pulse__sub">
              API telemetry · {samples ? `${samples} ${samples === 1 ? "sample" : "samples"}` : "awaiting samples"}
            </span>
          </div>
          <Chip
            size="sm"
            tone={state.offlinePreview ? "warn" : "ok"}
            dot
            pulse={!state.offlinePreview && Boolean(state.lastUpdated)}
          >
            {state.offlinePreview ? "Snapshot" : "Live"}
          </Chip>
        </div>

        <div className="hero-pulse__metric">
          <div className="hero-pulse__readout">
            <span>p95 latency</span>
            <b>
              {typeof p95 === "number" && p95 > 0 ? number(p95) : "—"}
              <small>ms</small>
            </b>
          </div>
          <div className="hero-pulse__chart">
            {latencyHistory.length > 1 ? (
              <Sparkline
                data={latencyHistory}
                height={38}
                strokeWidth={1.3}
                label="API p95 latency, last 28 samples"
              />
            ) : (
              <span className="hero-pulse__empty">Collecting samples</span>
            )}
          </div>
        </div>

        <div className="hero-pulse__metric">
          <div className="hero-pulse__readout">
            <span>Throughput</span>
            <b>
              {typeof throughput === "number" ? number(throughput) : "—"}
              <small>req/min</small>
            </b>
          </div>
          <div className="hero-pulse__chart">
            {throughputHistory.length > 1 ? (
              <Sparkline
                data={throughputHistory}
                height={38}
                strokeWidth={1.3}
                label="API requests per minute, last 28 samples"
              />
            ) : (
              <span className="hero-pulse__empty">Collecting samples</span>
            )}
          </div>
        </div>

        <div className="hero-pulse__foot">
          <span>
            <i aria-hidden="true" /> {number(hits)} ok
          </span>
          <span data-alert={typeof misses === "number" && misses > 0 ? "true" : undefined}>
            {number(misses)} errors
          </span>
          <span>{relative(state.telemetry?.lastSweep)}</span>
        </div>
      </aside>

      <div className="command-hero__metrics" aria-label="Fleet summary">
        <div className="hero__stat">
          <div className="stat-value">
            {online}
            <small>/ {bots.length || "—"}</small>
          </div>
          <div className="stat-label">Agents reporting</div>
        </div>
        <div className="hero__stat">
          <div className="stat-value">
            {health.active}
            <small>/ {health.total || "—"}</small>
          </div>
          <div className="stat-label">Core services</div>
        </div>
        <div className="hero__stat">
          <div className="stat-value">
            {typeof p95 === "number" && p95 > 0 ? number(p95) : "—"}
            <small>ms</small>
          </div>
          <div className="stat-label">API p95</div>
        </div>
        <div className="hero__stat">
          <div className="stat-value">
            {progress === null ? "—" : progress}
            <small>%</small>
          </div>
          <div className="stat-label">{job ? (job.target || "current grind").replace(/_/g, " ") : "Queue idle"}</div>
        </div>
      </div>
    </section>
  );
}
