import type { ReactNode } from "react";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { Icon, type IconName } from "../ui/icons";

type ViewHeadProps = {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
};

export function ViewHead({ eyebrow, title, sub, aside }: ViewHeadProps) {
  return (
    <header className="view-head">
      <div className="view-head__copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display">{title}</h1>
        {sub && <p className="view-head__sub">{sub}</p>}
      </div>
      {aside && <div className="view-head__aside">{aside}</div>}
    </header>
  );
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon = "spark", title, children, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon name={icon} size={20} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function AgentOfflineNotice({ action }: { action?: ReactNode }) {
  const agent = useAgentStatus();
  if (!agent.offline) return null;
  return (
    <div className="agent-notice" role="status">
      <Icon name="wifi-off" size={14} />
      <span>
        <strong>{agent.name} is offline.</strong>{" "}
        {action ?? "This action is saved and dispatched when the agent reconnects."}
      </span>
    </div>
  );
}

export function PendingInline({
  entry,
  onRetry,
  compact,
}: {
  entry?: { status: "pending" | "error"; error?: string } | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (!entry) return null;
  if (entry.status === "pending") {
    return (
      <span className="sync" role="status">
        <span className="dot dot--pulse" aria-hidden="true" /> working…
      </span>
    );
  }
  return (
    <span className="error-inline" role="alert" title={entry.error}>
      <Icon name="alert" size={11} />
      {compact ? "failed" : entry.error ?? "Action failed."}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
}
