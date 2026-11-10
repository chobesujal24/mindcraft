import { useAgentStatus } from "../hooks/useAgentStatus";
import { useDashboard } from "../state/store";
import { Chip } from "../ui/Chip";
import { CurrentGrind } from "./grind/CurrentGrind";
import { GrindHistory, GrindQueue } from "./grind/GrindQueue";
import { GrindPlanner } from "./grind/GrindPlanner";
import { ViewHead } from "./shared";

export function Grind() {
  const state = useDashboard();
  const agent = useAgentStatus();
  const current = state.jobs?.current;
  const status = typeof current?.status === "string" ? current.status : "idle";
  const workerLabel = state.offlinePreview
    ? "Worker status unknown"
    : agent.offline
      ? "Worker offline"
      : status !== "idle"
        ? `Worker ${status}`
        : agent.online
          ? "Worker ready"
          : "Worker status pending";
  return (
    <>
      <ViewHead
        eyebrow="Operations · queue"
        title="Grind"
        sub="Plan a collection job, watch the worker reconcile progress, and review completed or aborted runs."
        aside={
          <>
            <Chip tone={state.offlinePreview ? "warn" : "ok"} dot>
              {state.offlinePreview ? "Offline snapshot" : `${(state.jobs?.queue.length ?? 0) + (current ? 1 : 0)} in flight`}
            </Chip>
            <Chip tone={state.offlinePreview ? "warn" : agent.offline ? "danger" : agent.online ? "ok" : "neutral"} dot>{workerLabel}</Chip>
          </>
        }
      />
      <div className="grind-layout">
        <GrindPlanner />
        <div className="stack">
          <CurrentGrind />
          <GrindQueue />
        </div>
      </div>
      <GrindHistory />
    </>
  );
}
