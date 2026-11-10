import type { SchematicJob } from "../../data/types";
import { useDashboard } from "../../state/store";
import { number } from "../../utils/format";
import { Chip, type Tone } from "../../ui/Chip";
import { Panel } from "../../ui/Panel";
import { Table, type Column } from "../../ui/Table";

const TONE: Record<string, Tone> = {
  completed: "ok",
  cancelled: "neutral",
  failed: "danger",
  running: "accent",
  paused: "warn",
  blocked: "warn",
};

function finishedLabel(job: SchematicJob): string {
  const stamp = job.finishedAt ?? job.updatedAt;
  if (typeof stamp !== "number" || !Number.isFinite(stamp) || stamp <= 0) return "—";
  return new Date(stamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BuildHistory() {
  const state = useDashboard();
  const rows = state.build?.history ?? [];
  const columns: Column<SchematicJob>[] = [
    {
      key: "name",
      header: "Schematic",
      render: (job) => (
        <div style={{ minWidth: 0 }}>
          <strong>{job.sourceName || job.fileName || "Schematic"}</strong>
          <div className="mono mute" style={{ fontSize: 8.5 }}>
            {(job.fileName || "file not reported").slice(0, 24)}
          </div>
        </div>
      ),
    },
    {
      key: "origin",
      header: "Origin",
      numeric: true,
      hideBelow: "sm",
      render: (job) => (
        <span className="mono">
          {job.origin?.x ?? "—"} {job.origin?.y ?? "—"} {job.origin?.z ?? "—"}
        </span>
      ),
    },
    {
      key: "rotation",
      header: "Rot.",
      numeric: true,
      hideBelow: "sm",
      render: (job) => <span className="mono">{job.rotation ?? 0}°</span>,
    },
    {
      key: "progress",
      header: "Placed",
      numeric: true,
      render: (job) => (
        <span className="mono">
          {number(job.placed)} <span className="mute">/ {number(job.totalBlocks)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <Chip tone={TONE[job.status] ?? "neutral"}>{job.status || "unknown"}</Chip>,
    },
    {
      key: "when",
      header: "Finished",
      numeric: true,
      hideBelow: "sm",
      render: (job) => <span className="mono mute">{finishedLabel(job)}</span>,
    },
  ];

  return (
    <Panel
      className="build-history"
      eyebrow="Archive"
      title="Build history"
      sub="The last ten schematics. Completed builds keep their origin, rotation, and skip count."
      flush
      tools={<Chip tone="neutral">{rows.length} records</Chip>}
    >
      <Table
        label="Build history"
        columns={columns}
        rows={rows}
        rowKey={(job, index) => job.id || `build-${index}`}
        compact
        empty="No builds archived yet. The first completed schematic will appear here."
      />
    </Panel>
  );
}
