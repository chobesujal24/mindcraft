import { useState } from "react";
import type { Threat } from "../../data/types";
import { actions, useDashboard } from "../../state/store";
import { Button } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { Panel } from "../../ui/Panel";
import { Radar, type RadarRange } from "../../ui/Radar";
import { Table, type Column } from "../../ui/Table";
import { Icon } from "../../ui/icons";
import { hasFreshTelemetry } from "../../utils/telemetry";

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function distanceTone(distance: number | null): Tone {
  if (distance === null) return "neutral";
  if (distance <= 10) return "danger";
  if (distance <= 20) return "warn";
  return "ok";
}

export function Threats() {
  const state = useDashboard();
  const [range, setRange] = useState<RadarRange>(32);
  const radarEnabled = state.addons?.config.player_radar === true;
  const radarAvailable = !state.offlinePreview && radarEnabled && hasFreshTelemetry(state.addons?.live?.timestamp);
  const threats = radarAvailable ? state.addons?.live?.radar ?? [] : [];
  const bot = state.fleet?.bots[0] ?? null;

  const columns: Column<Threat>[] = [
    {
      key: "player",
      header: "Contact",
      render: (threat) => (
        <span className="row" style={{ gap: 6 }}>
          <Icon name="user" size={12} />
          <strong>{threat.username || "Unknown contact"}</strong>
          {threat.isSneaking && <Chip tone="warn">sneaking</Chip>}
        </span>
      ),
    },
    {
      key: "distance",
      header: "Range",
      numeric: true,
      render: (threat) => {
        const distance = finiteOrNull(threat.distance);
        return (
          <Chip tone={distanceTone(distance)}>
            {distance === null ? "not reported" : `${distance.toFixed(1)} m`}
          </Chip>
        );
      },
    },
    {
      key: "position",
      header: "Position",
      numeric: true,
      hideBelow: "sm",
      render: (threat) => (
        <span className="mono">
          {[threat.x, threat.y, threat.z].map((value) => finiteOrNull(value) ?? "—").join(" ")}
        </span>
      ),
    },
    {
      key: "item",
      header: "Held",
      hideBelow: "sm",
      render: (threat) => (
        <span className="mono mute">
          {typeof threat.heldItem === "string" && threat.heldItem
            ? threat.heldItem.replace(/_/g, " ")
            : "not reported"}
        </span>
      ),
    },
    {
      key: "threat",
      header: "Assessment",
      render: (threat) => {
        const distance = finiteOrNull(threat.distance);
        return (
          <Chip size="sm" tone={distanceTone(distance)} dot>
            {distance === null ? "Unknown" : distance <= 10 ? "Critical" : distance <= 20 ? "Caution" : "Clear"}
          </Chip>
        );
      },
    },
  ];

  return (
    <div className="threat-grid">
      <Panel
        eyebrow="Player radar · contacts"
        title="Threat ledger"
        sub={radarAvailable
          ? "Contacts are refreshed by the player radar once per second. Distance is relative to ENI1."
          : !radarEnabled
            ? "Enable Player Radar in Add-ons to begin scanning."
            : "Waiting for fresh radar telemetry from ENI1."}
        flush
        tools={
          <Button size="sm" variant="quiet" onClick={() => actions.setLightboxOpen(true)}>
            Open radar
          </Button>
        }
      >
        <Table
          label="Threat ledger"
          columns={columns}
          rows={threats}
          rowKey={(threat, index) => `${threat.username || "contact"}-${threat.x ?? 0}-${threat.z ?? 0}-${index}`}
          compact
          empty={radarAvailable ? `No contacts within ${range} metres. The sweep is active.` : !radarEnabled ? "Player Radar is disabled." : "Radar telemetry is unavailable or stale."}
        />
      </Panel>
      <Panel className="radar-panel threat-mini" eyebrow="Sweep" title="Player radar" sub={radarAvailable ? "Pauses automatically when hidden." : !radarEnabled ? "Enable Player Radar to scan." : "Waiting for fresh telemetry."}>
        <Radar threats={threats} range={range} onRangeChange={setRange} bot={bot} onExpand={() => actions.setLightboxOpen(true)} />
      </Panel>
    </div>
  );
}
