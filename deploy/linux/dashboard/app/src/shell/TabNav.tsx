import { armedAddonCount } from "../data/fixtures";
import type { View } from "../data/types";
import { actions, useDashboard } from "../state/store";
import { Tabs, type TabItem } from "../ui/Tabs";

const TABS: TabItem[] = [
  { id: "fleet", label: "Fleet", icon: "fleet" },
  { id: "grind", label: "Grind", icon: "activity" },
  { id: "build", label: "Build", icon: "layers" },
  { id: "addons", label: "Add-ons", icon: "sliders" },
  { id: "providers", label: "Providers", icon: "cpu" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function TabNav() {
  const state = useDashboard();
  const active = state.addons ? armedAddonCount(state.addons.config) : 0;
  return (
    <div className="tabnav">
      <div className="tabnav__inner">
        <Tabs
          items={TABS}
          active={state.view}
          onChange={(id) => actions.setView(id as View)}
          label="Dashboard views"
        />
        <div className="tabnav__meta" aria-hidden="true">
          <span>Batch 5s</span>
          <span>{active} add-ons armed</span>
          <span>{state.offlinePreview ? "Offline data" : "Live bus"}</span>
        </div>
      </div>
    </div>
  );
}
