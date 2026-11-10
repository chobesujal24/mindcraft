export type ProgressInput = {
  completed: number;
  total: number;
  startedAt?: number | null;
  updatedAt?: number | null;
  status?: string;
};

export type DerivedProgress = {
  completed: number;
  remaining: number;
  percent: number;
  ratePerMinute: number;
  elapsedSeconds: number;
  etaSeconds: number | null;
  active: boolean;
};

const RUNNING = new Set(["running", "placing", "pausing", "cancelling", "submitting"]);

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Derives a job's progress from its start timestamp and observed rate. The
 * server only sends snapshots every five seconds; this keeps the ring moving
 * between polls without inventing a completion.
 */
export function deriveProgress(input: ProgressInput, now: number): DerivedProgress {
  const total = Math.max(0, finite(input.total));
  const base = Math.min(total, Math.max(0, finite(input.completed)));
  const startedAt = finite(input.startedAt, 0);
  const updatedAt = finite(input.updatedAt, 0);
  const active = RUNNING.has(String(input.status ?? ""));
  const elapsedBase = startedAt > 0 && updatedAt > startedAt ? (updatedAt - startedAt) / 1000 : 0;
  const rate = elapsedBase > 2 ? base / elapsedBase : 0;
  const delta = active && rate > 0 && updatedAt > 0 ? Math.max(0, (now - updatedAt) / 1000) : 0;
  const completed = total > 0 ? Math.min(total, base + delta * rate) : base;
  const elapsedSeconds = startedAt > 0 ? Math.max(0, ((active ? now : updatedAt || now) - startedAt) / 1000) : 0;
  const remaining = Math.max(0, total - completed);
  const etaSeconds = active && rate > 0 ? remaining / rate : null;

  return {
    completed,
    remaining,
    percent: total > 0 ? Math.min(100, (completed / total) * 100) : 0,
    ratePerMinute: rate * 60,
    elapsedSeconds,
    etaSeconds,
    active,
  };
}
