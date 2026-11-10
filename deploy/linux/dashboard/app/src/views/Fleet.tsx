import { useState } from "react";
import { actions, useDashboard } from "../state/store";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Panel } from "../ui/Panel";
import { Radar, type RadarRange } from "../ui/Radar";
import { Icon } from "../ui/icons";
import { hasFreshTelemetry } from "../utils/telemetry";
import { BotCard } from "./fleet/BotCard";
import { FleetHero } from "./fleet/FleetHero";
import { ServicesPanel } from "./fleet/ServicesPanel";
import { EmptyState } from "./shared";

function RadarPanel({ selectedBotId }: { selectedBotId: string | null }) {
  const state = useDashboard();
  const [range, setRange] = useState<RadarRange>(32);
  const live = state.addons?.live;
  const radarEnabled = state.addons?.config.player_radar === true;
  const radarAvailable = !state.offlinePreview && radarEnabled && hasFreshTelemetry(live?.timestamp);
  const threats = radarAvailable ? live?.radar ?? [] : [];
  const bot = state.fleet?.bots.find((candidate) => candidate.id === selectedBotId) ?? state.fleet?.bots[0] ?? null;
  return (
    <Panel
      className="radar-panel"
      eyebrow="Telemetry · player radar"
      title="Player radar"
      sub={radarAvailable
        ? `Contacts relative to ${bot?.name ?? "ENI1"}. Sweep pauses when the tab is hidden.`
        : radarEnabled
          ? "Waiting for a fresh scan from ENI1."
          : "Disabled until the Player Radar add-on is armed."}
      tools={radarAvailable ? (
        <Button size="sm" variant="quiet" leading={<Icon name="arrow-up-right" size={12} />} onClick={() => actions.setLightboxOpen(true)}>
          Expand
        </Button>
      ) : undefined}
    >
      {!radarAvailable ? (
        <div className="radar-empty">
          <span className="radar-empty__icon">
            <Icon name={radarEnabled ? "clock" : "compass"} size={16} />
          </span>
          <div className="radar-empty__copy">
            <strong>{radarEnabled ? "Radar telemetry unavailable" : "Player Radar is off"}</strong>
            <p>
              {radarEnabled
                ? "The radar and contact list will appear when ENI1 reports a fresh scan."
                : "Arm Player Radar in Add-ons to show live contacts, range, and held items here."}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (radarEnabled ? actions.refresh() : actions.setView("addons"))}
          >
            {radarEnabled ? "Retry now" : "Open Add-ons"}
          </Button>
        </div>
      ) : (
        <>
          <Radar
            threats={threats}
            range={range}
            onRangeChange={setRange}
            bot={bot}
            onExpand={() => actions.setLightboxOpen(true)}
          />
          <div className="threat-list" aria-label="Radar contacts">
            {threats.length === 0 ? (
              <p className="radar-empty-inline">No contacts in range. The sweep continues.</p>
            ) : (
              threats.slice(0, 5).map((threat, index) => {
                const distance =
                  typeof threat.distance === "number" && Number.isFinite(threat.distance)
                    ? threat.distance
                    : null;
                const heldItem =
                  typeof threat.heldItem === "string" && threat.heldItem
                    ? threat.heldItem.replace(/_/g, " ")
                    : "not reported";
                return (
                  <div className="threat-row" key={`${threat.username || "contact"}-${index}`}>
                    <span className="threat-row__name">
                      <Icon name={distance !== null && distance <= 10 ? "alert" : "user"} size={11} />
                      <span>{threat.username || "Unknown contact"}</span>
                      {threat.isSneaking && <Chip tone="warn">sneaking</Chip>}
                    </span>
                    <span className="threat-row__dist">
                      {distance === null ? "—" : `${distance.toFixed(1)}m`}
                    </span>
                    <span className="threat-row__item" title={heldItem}>
                      {heldItem}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

export function Fleet() {
  const state = useDashboard();
  const bots = state.fleet?.bots ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const selectedId = selected ?? bots[0]?.id ?? null;
  const active = bots.filter((bot) => bot.state === "active" || bot.state === "warning").length;

  return (
    <>
      <FleetHero />

      <div className="fleet-top">
        <div className="fleet-main">
          <section className="fleet-agents" aria-labelledby="bot-grid-title">
            <div className="section-head" style={{ marginTop: 0 }}>
              <div>
                <h2 id="bot-grid-title">Agents</h2>
                <p className="mute">Select an agent to inspect position and radar contacts.</p>
              </div>
              <Chip tone={active === bots.length && bots.length > 0 ? "ok" : "warn"} dot>
                {active}/{bots.length || "—"} reporting
              </Chip>
            </div>
            {bots.length === 0 ? (
              <Panel>
                <EmptyState
                  icon="bot"
                  title="Waiting for the first fleet snapshot"
                  action={<Button size="sm" variant="secondary" onClick={actions.refresh}>Refresh telemetry</Button>}
                >
                  No agents have reported yet. The dashboard retries automatically every five seconds, then backs off to
                  thirty seconds while offline.
                </EmptyState>
              </Panel>
            ) : (
              <div className="bot-grid">
                {bots.map((bot) => (
                  <BotCard
                    key={bot.id}
                    bot={bot}
                    selected={bot.id === selectedId}
                    onSelect={() => setSelected(bot.id)}
                  />
                ))}
              </div>
            )}
          </section>
          <ServicesPanel />
        </div>

        <div className="fleet-side">
          <RadarPanel selectedBotId={selectedId} />
        </div>
      </div>
    </>
  );
}
