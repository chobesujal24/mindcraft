import { actions, useDashboard } from "../state/store";

/**
 * Toast state lives in the central store so optimistic actions can report
 * from anywhere. This hook is the only toast surface components should use.
 */
export function useToasts() {
  const toasts = useDashboard((state) => state.toasts);
  return {
    toasts,
    notify: actions.notify,
    dismiss: actions.dismissToast,
  };
}
