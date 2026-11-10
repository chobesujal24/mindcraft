import { actions, useDashboard } from "../state/store";

/**
 * Promise-based confirmation. The dialog itself is rendered once by AppShell,
 * so every view can ask for a guarded action without owning modal markup.
 */
export function useConfirm() {
  const current = useDashboard((state) => state.confirm);
  return {
    confirm: actions.requestConfirm,
    resolve: actions.resolveConfirm,
    current,
  };
}
