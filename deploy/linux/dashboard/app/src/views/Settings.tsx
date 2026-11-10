import { useDashboard } from "../state/store";
import { Chip } from "../ui/Chip";
import { ProfilesPanel } from "./fleet/ProfilesPanel";
import { RuntimeConfig } from "./fleet/RuntimeConfig";
import { ViewHead } from "./shared";

export function Settings() {
  const config = useDashboard((state) => state.config);
  const offlinePreview = useDashboard((state) => state.offlinePreview);
  const overrides = config?.effective?.overrides ?? {};
  const overrideCount = Object.keys(overrides).length;

  return (
    <>
      <ViewHead
        eyebrow="System · configuration"
        title="Settings"
        sub="Operator planes, agent profiles, and the truth about what the running process actually uses. Configuration changes are written to disk before any service restarts."
        aside={
          <>
            <Chip tone={offlinePreview ? "warn" : overrideCount ? "warn" : "ok"} dot>
              {offlinePreview ? "Offline snapshot" : overrideCount ? `${overrideCount} env override${overrideCount === 1 ? "" : "s"}` : "Settings saved"}
            </Chip>
            <Chip tone="neutral">{config?.active_profile?.split("/").pop()?.replace(".json", "") ?? "No profile"}</Chip>
          </>
        }
      />

      <div className="settings-layout">
        <RuntimeConfig />
        <ProfilesPanel />
      </div>
    </>
  );
}
