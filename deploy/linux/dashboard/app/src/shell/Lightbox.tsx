import { useState } from "react";
import { actions, useDashboard } from "../state/store";
import { Dialog } from "../ui/Dialog";
import { Radar, type RadarRange } from "../ui/Radar";
import { Button } from "../ui/Button";
import { hasFreshTelemetry } from "../utils/telemetry";

export function Lightbox() {
  const state = useDashboard();
  const [range, setRange] = useState<RadarRange>(32);
  const radarEnabled = state.addons?.config.player_radar === true;
  const radarAvailable = !state.offlinePreview && radarEnabled && hasFreshTelemetry(state.addons?.live?.timestamp);
  const threats = radarAvailable ? state.addons?.live?.radar ?? [] : [];
  const bot = state.fleet?.bots[0] ?? null;

  const botCoords =
    bot && Number.isFinite(bot.x) && Number.isFinite(bot.z)
      ? `ENI-01 POS [X: ${Math.round(bot.x!)}, Y: ${Math.round(bot.y ?? 64)}, Z: ${Math.round(bot.z!)}]`
      : null;

  return (
    <Dialog
      open={state.lightboxOpen}
      onClose={() => actions.setLightboxOpen(false)}
      eyebrow={botCoords ? `Player radar · ${botCoords}` : "Player radar · live sweep"}
      title="Player radar"
      description={radarAvailable
        ? "Live contacts from ENI1. The sweep pauses while this tab is hidden."
        : !radarEnabled
          ? "Enable Player Radar in Add-ons to show live contacts."
          : "Radar contacts are hidden until ENI1 reports fresh telemetry."}
      wide
      footer={
        <Button variant="secondary" onClick={() => actions.setLightboxOpen(false)}>
          Close radar
        </Button>
      }
    >
      <Radar threats={threats} range={range} onRangeChange={setRange} bot={bot} />
    </Dialog>
  );
}
