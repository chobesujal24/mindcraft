import { actions, useDashboard } from "../../state/store";
import type { GrindJob } from "../../data/types";
import { number, titleCase } from "../../utils/format";
import { Chip, type Tone } from "../../ui/Chip";
import { IconButton } from "../../ui/Button";
import { Panel } from "../../ui/Panel";
import { Table, type Column } from "../../ui/Table";
import { Icon } from "../../ui/icons";

const TONE: Record<string, Tone> = {
  completed: "ok",
  cancelled: "neutral",
  failed: "danger",
  running: "accent",
  paused: "warn",
  queued: "neutral",
};

export function GrindQueue() {
  const state = useDashboard();
  const queue = state.jobs?.queue ?? [];
  const cancelPending = state.pendingByAction["grind:cancel"]?.status === "pending";

  const remove = async (job: GrindJob) => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Grind queue",
      title: `Remove ${titleCase(job.target)} from the queue?`,
      description: `This removes the queued request for ${job.requested} blocks. Jobs already running are not affected.`,
      confirmLabel: "Remove job",
      danger: true,
    });
    if (confirmed) void actions.grindControl("cancel", job.id);
  };

  return (
    <Panel
      eyebrow="Up next"
      title="Queue"
      sub="Maximum five waiting jobs. Each row can be removed before the worker starts it."
      flush
      tools={<Chip tone={queue.length ? "accent" : "neutral"}>{queue.length} waiting</Chip>}
    >
      {queue.length === 0 ? (
        <div className="empty">
          <strong>No queued jobs</strong>
          <p>The planner adds jobs here; the worker promotes the oldest request when it becomes idle.</p>
        </div>
      ) : (
        <div className="queue-list">
          {queue.map((job, index) => (
            <div className="queue-row" key={job.id}>
              <span className="queue-row__index">{String(index + 1).padStart(2, "0")}</span>
              <div style={{ minWidth: 0 }}>
                <div className="queue-row__name">{titleCase(job.target)}</div>
                <div className="queue-row__meta">
                  {job.radius ?? 32} m · {job.deposit ?? "inventory"} · {job.status}
                </div>
              </div>
              <span className="queue-row__count">{number(job.requested)}</span>
              <Chip tone={TONE[job.status] ?? "neutral"}>{titleCase(job.status)}</Chip>
              <IconButton
                label={`Remove ${titleCase(job.target)} from queue`}
                onClick={() => void remove(job)}
                disabled={cancelPending}
              >
                <Icon name="trash" size={12} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function GrindHistory() {
  const state = useDashboard();
  const rows = state.jobs?.history ?? [];
  const columns: Column<GrindJob>[] = [
    {
      key: "target",
      header: "Target",
      render: (job) => <strong>{titleCase(job.target)}</strong>,
    },
    {
      key: "requested",
      header: "Requested",
      numeric: true,
      hideBelow: "sm",
      render: (job) => <span className="mono">{number(job.requested)}</span>,
    },
    {
      key: "completed",
      header: "Collected",
      numeric: true,
      render: (job) => (
        <span className="mono">
          {number(job.completed)} <span className="mute">/ {number(job.requested)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <Chip tone={TONE[job.status] ?? "neutral"}>{titleCase(job.status)}</Chip>,
    },
    {
      key: "when",
      header: "Finished",
      numeric: true,
      hideBelow: "sm",
      render: (job) => (
        <span className="mono mute">
          {new Date(job.updatedAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ];
  return (
    <Panel
      className="grind-history"
      eyebrow="Ledger"
      title="Grind history"
      sub="The last ten jobs, newest first. Cancelled jobs keep their partial count."
      flush
      tools={<Chip tone="neutral">{rows.length} records</Chip>}
    >
      <Table
        label="Grind history"
        columns={columns}
        rows={rows}
        rowKey={(job) => job.id}
        compact
        empty="No completed jobs yet. The ledger fills as soon as the first collection finishes."
      />
    </Panel>
  );
}
