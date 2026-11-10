import { useDashboard } from "../state/store";

export type AgentStatus = {
  name: string;
  online: boolean;
  offline: boolean;
  reported: boolean;
};

/**
 * Connectivity for the primary agent. "Known offline" requires a live
 * snapshot, so the dashboard does not accuse the agent before the first poll.
 */
export function useAgentStatus(): AgentStatus {
  const state = useDashboard();
  const bots = state.fleet?.bots ?? [];
  const requested = state.addons?.agentName;
  const agent =
    bots.find((candidate) => candidate.id === requested || candidate.name === requested) ??
    bots[0] ??
    null;
  const reported = !state.offlinePreview && Boolean(state.lastUpdated) && bots.length > 0;
  const online = Boolean(agent && agent.state === "active") && !state.offlinePreview;
  return {
    name: agent?.name ?? requested ?? "ENI1",
    online,
    offline: reported && !online,
    reported,
  };
}
