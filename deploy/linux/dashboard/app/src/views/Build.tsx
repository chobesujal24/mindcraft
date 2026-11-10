import { useAgentStatus } from "../hooks/useAgentStatus";
import { useDashboard } from "../state/store";
import { Chip } from "../ui/Chip";
import { BuildHistory } from "./build/BuildHistory";
import { BuildPlanner } from "./build/BuildPlanner";
import { CurrentBuild } from "./build/CurrentBuild";
import { ViewHead } from "./shared";

export function Build() {
  const state = useDashboard();
  const agent = useAgentStatus();
  const job = state.build?.current;
  const builderLabel = state.offlinePreview
    ? "Offline snapshot"
    : agent.offline
      ? "Builder offline"
      : job
        ? `Builder ${job.status}`
        : agent.online
          ? "Builder ready"
          : "Builder status pending";
  return (
    <>
      <ViewHead
        eyebrow="Operations · builds"
        title="Build"
        sub="Upload a Sponge schematic and track placement against the material ledger."
        aside={
          <>
            <Chip
              tone={state.offlinePreview ? "warn" : agent.offline ? "danger" : job || agent.online ? "ok" : "neutral"}
              dot
            >
              {builderLabel}
            </Chip>
            <Chip tone="neutral">{job ? `${Math.round((job.placed / Math.max(1, job.totalBlocks)) * 100)}% placed` : "No active job"}</Chip>
          </>
        }
      />
      <div className="build-layout">
        <BuildPlanner />
        <CurrentBuild />
      </div>
      <BuildHistory />
    </>
  );
}
