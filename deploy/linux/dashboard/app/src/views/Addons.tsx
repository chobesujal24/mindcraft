import { useMemo, useState } from "react";
import { addonCatalog, armedAddonCount, switchableAddons } from "../data/fixtures";
import { actions, useDashboard } from "../state/store";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/icons";
import { AddonCard } from "./addons/AddonCard";
import { DispatchGroups } from "./addons/DispatchGroups";
import { Threats } from "./addons/Threats";
import { AgentOfflineNotice, ViewHead } from "./shared";

export function Addons() {
  const state = useDashboard();
  const [query, setQuery] = useState("");
  const config = state.addons?.config ?? {};
  const armed = armedAddonCount(config);
  const guarded = addonCatalog.filter((entry) => entry.risk === "guarded").length;
  const busy = state.pendingByAction["addons:all"]?.status === "pending";

  const modules = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return addonCatalog;
    return addonCatalog.filter((entry) =>
      `${entry.name} ${entry.category} ${entry.description} ${entry.risk}`.toLowerCase().includes(needle),
    );
  }, [query]);

  const setAll = async (enabled: boolean) => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Add-on modules",
      title: enabled ? "Enable all switchable add-ons?" : "Disable all add-ons?",
      description: enabled
        ? "Every module except the managed Build and Grind workers will be enabled on the running agent. Guarded economy modules will be enabled as well."
        : "Every switchable module returns to standby. Managed Build and Grind workers keep their current queue state.",
      confirmLabel: enabled ? "Enable all" : "Disable all",
      danger: enabled,
    });
    if (!confirmed) return;
    const patch = Object.fromEntries(switchableAddons.map((entry) => [entry.id, enabled]));
    void actions.saveAllAddons(patch, config);
  };

  return (
    <>
      <ViewHead
        eyebrow="Operations · modules"
        title="Add-ons"
        sub={`${addonCatalog.length} modules, ${switchableAddons.length} switchable here. Switches write through a 250 ms debounce; failures keep the last confirmed state and surface an inline retry.`}
        aside={
          <>
            <Chip tone={state.offlinePreview ? "warn" : "ok"} dot>
              {state.offlinePreview ? "Offline config" : "Live config"}
            </Chip>
            <Chip tone={guarded ? "warn" : "neutral"}>{guarded} guarded</Chip>
          </>
        }
      />

      <AgentOfflineNotice action="Changes are saved and applied the moment the agent reconnects." />

      <div className="addons-toolbar">
        <div className="search">
          <Icon name="search" size={14} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search modules, categories, risk…"
            aria-label="Search add-on modules"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => void setAll(true)} loading={busy} disabled={busy || armed === switchableAddons.length} disabledReason="Every switchable module is already armed.">
          Arm all
        </Button>
        <Button size="sm" variant="quiet" onClick={() => void setAll(false)} loading={busy} disabled={busy || armed === 0} disabledReason="Every switchable module is already on standby.">
          Standby all
        </Button>
        <div className="addons-toolbar__counts">
          <Chip tone={armed > 0 ? "accent" : "neutral"} dot>
            {armed}/{switchableAddons.length} armed
          </Chip>
          <Chip tone="neutral">
            {addonCatalog.length} total · {switchableAddons.length} switchable
          </Chip>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 4 }}>
        <div>
          <h2>Modules</h2>
          <p className="mute">Managed workers are configured from their own operation tabs.</p>
        </div>
        <span className="mono mute">{modules.length} SHOWN</span>
      </div>

      {modules.length === 0 ? (
        <div className="empty">
          <strong>No module matches “{query}”</strong>
          <p>Try a category such as Combat, Survival, Recon, Economy, or System.</p>
          <Button size="sm" variant="quiet" className="mt-3" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="module-grid">
          {modules.map((definition) => (
            <AddonCard key={definition.id} definition={definition} />
          ))}
        </div>
      )}

      <DispatchGroups />
      <Threats />
    </>
  );
}
