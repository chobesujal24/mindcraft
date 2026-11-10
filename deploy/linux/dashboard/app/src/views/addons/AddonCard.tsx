import { useEffect, useRef, useState } from "react";
import type { AddonDefinition } from "../../data/fixtures";
import type { AddonValue } from "../../data/types";
import { actions, useDashboard } from "../../state/store";
import { Button } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { Icon } from "../../ui/icons";
import { Slider } from "../../ui/Slider";
import { Toggle } from "../../ui/Toggle";
import { PendingInline } from "../shared";

const RISK: Record<AddonDefinition["risk"], { tone: Tone; label: string }> = {
  low: { tone: "ok", label: "Low risk" },
  medium: { tone: "warn", label: "Medium risk" },
  guarded: { tone: "danger", label: "Guarded" },
};

export function AddonCard({ definition }: { definition: AddonDefinition }) {
  const config = useDashboard((state) => state.addons?.config);
  const pending = useDashboard((state) => state.pendingByAction[`addon:${definition.id}`]);
  const cpsPending = useDashboard((state) => state.pendingByAction["addon:cps_value"]);
  const enabled = Boolean(config?.[definition.id]);
  const cps = typeof config?.cps_value === "number" ? config.cps_value : 12;
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localCps, setLocalCps] = useState(cps);
  const timers = useRef<Record<string, number | undefined>>({});
  const serverEnabled = useRef(enabled);
  const serverCps = useRef(cps);
  const risk = RISK[definition.risk];

  useEffect(() => {
    if (timers.current[definition.id]) return;
    setLocalEnabled(enabled);
    serverEnabled.current = enabled;
  }, [enabled, definition.id]);

  useEffect(() => {
    if (timers.current["cps_value"]) return;
    setLocalCps(cps);
    serverCps.current = cps;
  }, [cps]);

  useEffect(() => {
    return () => {
      for (const t of Object.values(timers.current)) {
        if (t) window.clearTimeout(t);
      }
    };
  }, []);

  const commit = (key: string, value: AddonValue, fallback: AddonValue) => {
    if (timers.current[key]) window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(() => {
      delete timers.current[key];
      void actions.commitAddon(key, value, fallback);
    }, 250);
  };

  const toggle = (next: boolean) => {
    setLocalEnabled(next);
    actions.setAddonLocal(definition.id, next);
    commit(definition.id, next, serverEnabled.current);
  };

  const changeCps = (next: number) => {
    setLocalCps(next);
    actions.setAddonLocal("cps_value", next);
    commit("cps_value", next, serverCps.current);
  };

  return (
    <article className="module-card" data-enabled={localEnabled || undefined} data-managed={definition.managed || undefined}>
      <div className="module-card__head">
        <span className="module-card__icon">
          <Icon name={definition.icon} size={15} />
        </span>
        <div className="module-card__identity">
          <div className="module-card__name">{definition.name}</div>
          <div className="module-card__cat">{definition.category}</div>
        </div>
        <Chip tone={risk.tone}>{risk.label}</Chip>
      </div>
      <p className="module-card__desc">{definition.description}</p>

      {definition.setting && (
        <div className="module-card__setting">
          <Slider
            label={definition.setting.label}
            value={localCps}
            min={definition.setting.min}
            max={definition.setting.max}
            step={definition.setting.step}
            onChange={changeCps}
            format={(value) => `${value} ${definition.setting?.unit ?? ""}`}
            disabled={!localEnabled}
            hint={definition.setting.label}
          />
          <PendingInline entry={cpsPending} compact />
        </div>
      )}

      {pending?.status === "error" && (
        <div className="module-card__error">
          <PendingInline entry={pending} onRetry={() => void actions.commitAddon(definition.id, localEnabled, serverEnabled.current)} />
        </div>
      )}

      <div className="module-card__foot">
        {definition.managed ? (
          <>
            <span className="module-card__managed">
              <Icon name="lock" size={11} /> Managed surface
            </span>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => actions.setView(definition.id === "schematic_builder" ? "build" : "grind")}
            >
              Open
            </Button>
          </>
        ) : (
          <>
            <span className="module-card__state" data-on={localEnabled || undefined}>
              <i aria-hidden="true" />
              {localEnabled ? "Armed" : "Standby"}
            </span>
            <Toggle
              label={definition.name}
              checked={localEnabled}
              onChange={toggle}
              pending={pending?.status === "pending"}
              stateLabels={["Standby", "Armed"]}
              size="sm"
            />
          </>
        )}
      </div>
    </article>
  );
}
