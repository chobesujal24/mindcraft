import { actions, useDashboard } from "../../state/store";
import { useNow } from "../../hooks/useNow";
import { deriveProgress } from "../../utils/progress";
import { duration, eta, number, titleCase } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { Panel } from "../../ui/Panel";
import { Progress, ProgressRing } from "../../ui/Progress";
import { Icon } from "../../ui/icons";
import { EmptyState, PendingInline } from "../shared";

const TONE: Record<string, Tone> = {
  running: "accent",
  queued: "neutral",
  paused: "warn",
  pausing: "warn",
  blocked: "warn",
  cancelling: "danger",
  completed: "ok",
  failed: "danger",
  cancelled: "neutral",
};

export function CurrentBuild() {
  const state = useDashboard();
  const job = state.build?.current ?? null;
  const status = typeof job?.status === "string" ? job.status : "unknown";
  const active = Boolean(job && ["running", "queued", "pausing", "blocked"].includes(status));
  const now = useNow(active);
  const pause = state.pendingByAction["build:pause"];
  const resume = state.pendingByAction["build:resume"];
  const cancel = state.pendingByAction["build:cancel"];

  if (!job) {
    return (
      <Panel className="job-panel" eyebrow="Builder" title="No active schematic" sub="The placement queue is empty.">
        <EmptyState icon="layers" title="The world is quiet">
          Upload a schematic from the planner. Completed builds remain in the history table below with their material
          ledger.
        </EmptyState>
      </Panel>
    );
  }

  const sourceName = job.sourceName || job.fileName || "Schematic";
  const derived = deriveProgress(
    {
      completed: job.placed,
      total: job.totalBlocks,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      status,
    },
    now,
  );
  const paused = ["paused", "pausing", "blocked"].includes(status);
  const stopped = ["completed", "cancelled", "failed"].includes(status);
  const missing = new Set(
    Array.isArray(job.missing) ? job.missing.filter((item): item is string => typeof item === "string") : [],
  );
  const ledger = job.materials && typeof job.materials === "object" && !Array.isArray(job.materials)
    ? job.materials
    : {};
  const materials = Object.entries(ledger)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort((left, right) => right[1] - left[1]);

  const abort = async () => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Schematic builder",
      title: "Abort this build?",
      description:
        "The builder stops after the current placement tick. Blocks already placed remain in the world; the job is archived as cancelled.",
      confirmLabel: "Abort build",
      danger: true,
    });
    if (confirmed) void actions.buildControl("cancel");
  };

  return (
    <Panel
      className="job-panel"
      eyebrow="Builder · live placement"
      title="Schematic in progress"
      sub={typeof job.message === "string" ? job.message : undefined}
      flush
      tools={
        <span className="row" style={{ gap: 6 }}>
          <Chip tone={TONE[status] ?? "neutral"} dot>
            {titleCase(status)}
          </Chip>
          <PendingInline entry={pause ?? resume ?? cancel} compact />
        </span>
      }
      footer={
        <div className="job-controls">
          {paused ? (
            <Button
              size="sm"
              variant="primary"
              leading={<Icon name="play" size={12} />}
              loading={resume?.status === "pending"}
              loadingLabel="Resuming"
              disabled={status === "pausing" || stopped}
              disabledReason="The pause is still being acknowledged."
              onClick={() => void actions.buildControl("resume")}
            >
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              leading={<Icon name="pause" size={12} />}
              loading={pause?.status === "pending"}
              loadingLabel="Pausing"
              disabled={!active || stopped}
              disabledReason="Only a running build can be paused."
              onClick={() => void actions.buildControl("pause")}
            >
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            leading={<Icon name="stop" size={12} />}
            loading={cancel?.status === "pending"}
            loadingLabel="Aborting"
            disabled={stopped}
            disabledReason="This build has already finished."
            onClick={() => void abort()}
          >
            Abort
          </Button>
          <span className="sync" style={{ marginLeft: "auto" }}>
            {sourceName} · {(job.fileName || "file not reported").slice(0, 18)}
          </span>
        </div>
      }
    >
      <div className="job-hero">
        <ProgressRing
          value={derived.percent}
          max={100}
          center={`${Math.floor(derived.percent)}%`}
          sub={`${number(job.placed)} / ${number(job.totalBlocks)}`}
          label={`${sourceName} placed`}
        />
        <div className="job-main">
          <div className="job-main__head">
            <div>
              <div className="job-main__target">{sourceName}</div>
              <div className="job-main__meta">
                {job.size && Number.isFinite(job.size.x) && Number.isFinite(job.size.y) && Number.isFinite(job.size.z)
                  ? `${job.size.x}×${job.size.y}×${job.size.z}`
                  : "size pending"}{" "}
                · rotation {job.rotation ?? 0}° · {job.replaceBlocks ? "replace" : "preserve"}
              </div>
            </div>
            <Chip tone={missing.size ? "warn" : "ok"}>{missing.size ? `${missing.size} shortages` : "Materials ready"}</Chip>
          </div>
          <Progress
            className="mt-2"
            value={derived.percent}
            max={100}
            label="Schematic placement"
            tone={missing.size ? "warn" : "accent"}
            showMeta
            detail={`${Math.floor(derived.completed)} of ${number(job.totalBlocks)} blocks`}
          />
          <div className="job-stats">
            <div>
              <div className="job-stat__value">{number(Math.floor(derived.completed))}</div>
              <div className="job-stat__label">Placed</div>
            </div>
            <div>
              <div className="job-stat__value">{derived.ratePerMinute ? Math.round(derived.ratePerMinute) : "—"}</div>
              <div className="job-stat__label">Blocks / min</div>
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

      <div style={{ padding: "0 18px 18px" }}>
        {missing.size > 0 && (
          <>
            <div className="section-head" style={{ marginTop: 3 }}>
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 650 }}>Shortages</h3>
                <p className="mute">The worker pauses until these materials are restocked.</p>
              </div>
            </div>
            <div className="shortages">
              {job.missing.map((item) => (
                <Chip key={item} tone="danger">
                  {item.replace(/_/g, " ")}
                </Chip>
              ))}
            </div>
          </>
        )}
        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650 }}>Material ledger</h3>
            <p className="mute">Required blocks reported by the parser. Missing entries are highlighted.</p>
          </div>
          <span className="mono mute">{materials.length} TYPES</span>
        </div>
        {materials.length === 0 ? (
          <p className="note">
            <Icon name="database" size={12} /> The ledger appears after the worker validates the uploaded file.
          </p>
        ) : (
          <div className="materials-list">
            {materials.slice(0, 12).map(([name, quantity]) => (
              <div className="material-row" key={name} data-missing={missing.has(name) || undefined}>
                <span className="material-row__name">{name.replace(/_/g, " ")}</span>
                <span className="material-row__qty">{number(quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
