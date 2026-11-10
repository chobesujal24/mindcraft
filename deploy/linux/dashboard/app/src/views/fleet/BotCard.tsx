import type { FleetBot } from "../../data/types";
import { initials, percent, titleCase } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { Icon, type IconName } from "../../ui/icons";

const STATE_TONE: Record<FleetBot["state"], Tone> = {
  active: "ok",
  idle: "neutral",
  warning: "warn",
  stale: "warn",
  offline: "danger",
};

const STATE_LABEL: Record<FleetBot["state"], string> = {
  active: "Active",
  idle: "Idle",
  warning: "Attention",
  stale: "Stale",
  offline: "Offline",
};

const STATE_ICON: Record<FleetBot["state"], IconName> = {
  active: "activity",
  idle: "pause",
  warning: "alert",
  stale: "clock",
  offline: "wifi-off",
};

function toneForVital(value: number | null, max: number): "warn" | "danger" | undefined {
  if (value === null) return "danger";
  if (value <= max * 0.25) return "danger";
  if (value <= max * 0.5) return "warn";
  return undefined;
}

export function BotCard({
  bot,
  selected,
  onSelect,
}: {
  bot: FleetBot;
  selected: boolean;
  onSelect: () => void;
}) {
  const healthTone = toneForVital(bot.health, 20);
  const foodTone = toneForVital(bot.food, 20);
  const coords = [bot.x, bot.y, bot.z].every((value) => value !== null && Number.isFinite(value))
    ? `${bot.x} ${bot.y} ${bot.z}`
    : "position unreported";

  const locateOnRadar = () => {
    onSelect();
    document.querySelector(".radar-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <article className="bot-card" data-selected={selected || undefined}>
      <button
        type="button"
        className="bot-card__main"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="sr-only">Select to show this agent on the radar.</span>
        <div className="bot-card__top">
          <div className="bot-card__identity">
            <span className="bot-card__monogram" aria-hidden="true">
              {initials(bot.name)}
              <span className="bot-card__presence" data-state={bot.state} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="bot-card__name">{bot.name}</div>
              <div className="bot-card__id">
                {bot.id} · {titleCase(bot.dimension?.replace(/^minecraft:/, "") ?? "unknown")}
              </div>
            </div>
          </div>
          <Chip tone={STATE_TONE[bot.state]} dot size="sm">
            {STATE_LABEL[bot.state]}
          </Chip>
        </div>

        <div className="bot-card__vitals">
          <div className="vital">
            <div className="vital__head">
              <span className="vital__label">Health</span>
              <span className="vital__value">
                {percent(bot.health, 20)} · {bot.health ?? "—"}/20
              </span>
            </div>
            <div className="mini-bar" data-tone={healthTone}>
              <span style={{ width: percent(bot.health, 20, "0%") }} />
            </div>
          </div>
          <div className="vital">
            <div className="vital__head">
              <span className="vital__label">Food</span>
              <span className="vital__value">
                {percent(bot.food, 20)} · {bot.food ?? "—"}/20
              </span>
            </div>
            <div className="mini-bar" data-tone={foodTone}>
              <span style={{ width: percent(bot.food, 20, "0%") }} />
            </div>
          </div>
        </div>

        <div className="bot-card__meta">
          <span className="bot-card__coords">
            <Icon name="map-pin" size={10} /> {coords}
          </span>
          <span>
            <Icon name={STATE_ICON[bot.state]} size={10} /> {bot.state === "offline" ? "no signal" : "telemetry ok"}
          </span>
        </div>

        <div className="bot-card__foot">
          <span className="bot-card__activity">{bot.activity}</span>
          <span className="bot-card__ping">{bot.ping === null ? "— ms" : `${bot.ping} ms`}</span>
        </div>
      </button>

      <Button
        variant={selected ? "primary" : "secondary"}
        size="sm"
        block
        className="bot-card__cta"
        leading={<Icon name="compass" size={13} />}
        onClick={locateOnRadar}
      >
        Show on radar
      </Button>
    </article>
  );
}
