import { actions, useDashboard } from "../../state/store";
import { useNow } from "../../hooks/useNow";
import { deriveProgress } from "../../utils/progress";
import { duration, eta, number, titleCase } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { ProgressRing } from "../../ui/Progress";
import { Panel } from "../../ui/Panel";
import { Icon } from "../../ui/icons";
import { EmptyState, PendingInline } from "../shared";

const STATUS_TONE: Record<string, Tone> = {
  running: "accent",
  paused: "warn",
  pausing: "warn",
  cancelling: "danger",
  submitting: "neutral",
  queued: "neutral",
  completed: "ok",
  cancelled: "neutral",
  failed: "danger",
};

export function CurrentGrind() {
  const state = useDashboard();
  const job = state.jobs?.current ?? null;
  const active = Boolean(job && (job.status === "running" || job.status === "pausing" || job.status === "submitting"));
  const now = useNow(active);
  const pendingPause = state.pendingByAction["grind:pause"];
  const pendingResume = state.pendingByAction["grind:resume"];
  const pendingCancel = state.pendingByAction["grind:cancel"];

  if (!job) {
    return (
      <Panel className="job-panel" eyebrow="Active job" title="Nothing in the hopper" sub="The worker is idle.">
        <EmptyState icon="box" title="Queue is clear">
          Plan a collection job on the left. Completed and cancelled jobs remain visible in the history table below.
        </EmptyState>
      </Panel>
    );
  }

  const derived = deriveProgress(
    {
      completed: job.completed,
      total: job.requested,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      status: job.status,
    },
    now,
  );
  const paused = job.status === "paused" || job.status === "pausing";
  const stopped = ["completed", "cancelled", "failed"].includes(job.status);
  const statusTone = STATUS_TONE[job.status] ?? "neutral";

  const abort = async () => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Grind supervisor",
      title: "Abort this grind job?",
      description:
        "The worker stops after its current block action. Partial progress is preserved in the job history and cannot be resumed.",
      confirmLabel: "Abort job",
      danger: true,
    });
    if (confirmed) void actions.grindControl("cancel", job.id);
  };

  return (
    <Panel
      className="job-panel"
      eyebrow="Active job"
      title="Collection in progress"
      sub={job.message ?? "The worker is executing the queued collection plan."}
      flush
      tools={
        <span className="row" style={{ gap: 6 }}>
          <Chip tone={statusTone} dot>
            {titleCase(job.status)}
          </Chip>
          <PendingInline entry={pendingPause ?? pendingResume ?? pendingCancel} compact />
        </span>
      }
      footer={
        <div className="job-controls">
          {paused ? (
            <Button
              size="sm"
              variant="primary"
              leading={<Icon name="play" size={12} />}
              loading={pendingResume?.status === "pending"}
              loadingLabel="Resuming"
              disabled={job.status === "pausing" || stopped}
              disabledReason="The pause is still being acknowledged."
              onClick={() => void actions.grindControl("resume", job.id)}
            >
              {job.status === "pausing" ? "Pausing…" : "Resume"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              leading={<Icon name="pause" size={12} />}
              loading={pendingPause?.status === "pending"}
              loadingLabel="Pausing"
              disabled={!active || job.status === "pausing" || stopped}
              disabledReason="Only a running job can be paused."
              onClick={() => void actions.grindControl("pause", job.id)}
            >
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            leading={<Icon name="stop" size={12} />}
            loading={pendingCancel?.status === "pending"}
            loadingLabel="Aborting"
            disabled={stopped}
            disabledReason="This job has already finished."
            onClick={() => void abort()}
          >
            Abort
          </Button>
          <span className="sync" style={{ marginLeft: "auto" }}>
            Job {job.id.slice(0, 16)} · {job.status}
          </span>
        </div>
      }
    >
      <div className="job-hero">
        <ProgressRing
          value={derived.percent}
          max={100}
          center={`${Math.floor(derived.completed)}`}
          sub={`of ${number(job.requested)}`}
          label={`${titleCase(job.target)} collected`}
        />
        <div className="job-main">
          <div className="job-main__head">
            <div>
              <div className="job-main__target">{titleCase(job.target)}</div>
              <div className="job-main__meta">
                started {job.startedAt ? new Date(job.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"} · {job.deposit ?? "inventory"}
              </div>
            </div>
            <Chip tone={derived.remaining === 0 ? "ok" : "neutral"}>
              {Math.round(derived.percent)}% reconciled
            </Chip>
          </div>
          <p className="job-main__msg">
            {derived.remaining > 0
              ? `${number(derived.remaining)} blocks remain. Progress is derived from the job start time and observed collection rate between polls.`
              : "Target reached. The supervisor will move to the next queued job."}
          </p>
          <div className="job-stats">
            <div>
              <div className="job-stat__value">{number(Math.floor(derived.completed))}</div>
              <div className="job-stat__label">Collected</div>
            </div>
            <div>
              <div className="job-stat__value">{derived.ratePerMinute ? derived.ratePerMinute.toFixed(1) : "—"}</div>
              <div className="job-stat__label">Per minute</div>
            </div>
            <div>
              <div className="job-stat__value">{eta(derived.etaSeconds)}</div>
              <div className="job-stat__label">ETA</div>
            </div>
            <div>
              <div className="job-stat__value">{duration(derived.elapsedSeconds)}</div>
              <div className="job-stat__label">Elapsed</div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
