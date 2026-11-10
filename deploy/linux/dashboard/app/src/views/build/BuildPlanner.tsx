import { useRef, useState } from "react";
import { useAgentStatus } from "../../hooks/useAgentStatus";
import { actions, useDashboard } from "../../state/store";
import { bytes } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { IconButton } from "../../ui/Button";
import { Icon } from "../../ui/icons";
import { Panel } from "../../ui/Panel";
import { Progress } from "../../ui/Progress";
import { Toggle } from "../../ui/Toggle";
import { AgentOfflineNotice, PendingInline } from "../shared";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = /\.schem$/i;
const COORD = /^-?\d+$/;
const coordinateValid = (value: string) =>
  !value.trim() || (COORD.test(value.trim()) && Math.abs(Number(value)) <= 29_999_984);

type UploadStats = { percent: number; loaded: number; total: number; startedAt: number };

export function BuildPlanner() {
  const pending = useDashboard((state) => state.pendingByAction["build:upload"]);
  const agent = useAgentStatus();
  const busy = useDashboard((state) => Boolean(state.build?.current && ["queued", "running", "pausing", "paused", "blocked"].includes(state.build.current.status)));
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState({ x: "", y: "", z: "" });
  const [rotation, setRotation] = useState("0");
  const [replace, setReplace] = useState(false);
  const [upload, setUpload] = useState<UploadStats | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const coordsValid = [origin.x, origin.y, origin.z].every(coordinateValid);
  const canUpload = Boolean(file) && coordsValid && !busy && pending?.status !== "pending";

  const choose = (next: File | null) => {
    setUpload(null);
    if (!next) {
      setFile(null);
      setError(null);
      return;
    }
    if (!ACCEPT.test(next.name)) {
      setFile(null);
      setError("Choose a Sponge .schem file. Litematica .litematic files are not supported yet.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setError(`${next.name} is ${bytes(next.size)}. The upload limit is 8 MB.`);
      return;
    }
    if (next.size === 0) {
      setFile(null);
      setError("That file is empty.");
      return;
    }
    setError(null);
    setFile(next);
  };

  const submit = async () => {
    if (!file || !canUpload) return;
    setError(null);
    const stats: UploadStats = { percent: 0, loaded: 0, total: file.size, startedAt: Date.now() };
    setUpload(stats);
    const ok = await actions.uploadBuild(
      file,
      { name: file.name, x: origin.x.trim(), y: origin.y.trim(), z: origin.z.trim(), rotation, replace: String(replace) },
      (percent, loaded, total) => setUpload({ percent, loaded, total, startedAt: stats.startedAt }),
    );
    if (!ok) setUpload(null);
  };

  const etaText = (() => {
    if (!upload || upload.percent >= 100) return null;
    const elapsed = Math.max(0.4, (Date.now() - upload.startedAt) / 1000);
    const speed = upload.loaded / elapsed;
    if (!Number.isFinite(speed) || speed <= 0) return null;
    return `${bytes(speed)}/s · ETA ${Math.max(1, Math.ceil((upload.total - upload.loaded) / speed))}s`;
  })();

  return (
    <Panel
      eyebrow="Schematic builder"
      title="Load a structure"
      sub="Drop a Sponge schematic, set the insertion point, and let the builder place it layer by layer."
      tools={
        <Chip tone={busy ? "warn" : agent.offline ? "danger" : "neutral"}>
          {busy ? "Builder busy" : agent.online ? "Builder ready" : agent.offline ? "Builder offline" : "Builder status pending"}
        </Chip>
      }
    >
      <div className="build-form">
        <div>
          <label
            className="dropzone"
            data-drag={drag || undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDrag(false);
              choose(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <span className="dropzone__icon">
              <Icon name="upload" size={18} />
            </span>
            <span className="dropzone__title">{file ? "Replace schematic" : "Drop a schematic or choose a file"}</span>
            <span className="dropzone__hint">SPONGE .SCHEM · MAX 8 MB</span>
            <input
              ref={inputRef}
              type="file"
              accept=".schem"
              onChange={(event) => {
                const next = event.currentTarget.files?.[0] ?? null;
                choose(next);
                // Allow choosing the same file again after a removal or a
                // validation error without reopening the picker.
                event.currentTarget.value = "";
              }}
              aria-label="Choose schematic file"
            />
          </label>
          {file && (
            <div className="file-row mt-2">
              <span className="file-row__icon">
                <Icon name="layers" size={14} />
              </span>
              <span className="file-row__name" title={file.name}>
                {file.name}
              </span>
              <span className="file-row__meta">{bytes(file.size)}</span>
              <IconButton
                label="Remove selected schematic"
                onClick={() => {
                  choose(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <Icon name="x" size={12} />
              </IconButton>
            </div>
          )}
          {error && (
            <p className="error-inline mt-2" role="alert">
              <Icon name="alert" size={12} /> {error}
            </p>
          )}
        </div>

        <div>
          <div className="field-row" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {(["x", "y", "z"] as const).map((axis) => (
              <Field key={axis} label={`Origin ${axis.toUpperCase()}`} error={!coordinateValid(origin[axis]) ? "Whole number within world limits" : undefined}>
                <input
                  className="input input--mono"
                  inputMode="numeric"
                  placeholder="auto"
                  value={origin[axis]}
                  onChange={(event) => {
                    const value = event.currentTarget.value.replace(/[^\d-]/g, "");
                    setOrigin((current) => ({ ...current, [axis]: value }));
                  }}
                />
              </Field>
            ))}
          </div>
          <p className="advisory mt-2">
            <Icon name="map-pin" size={11} /> Leave blank to anchor to ENI1’s current position (X/Z offset +2). Explicit coordinates allow ±29,999,984.
          </p>
        </div>

        <Field label="Rotation" hint="Applied to the insertion point before the first block is placed.">
          <select className="select select--mono" value={rotation} onChange={(event) => setRotation(event.currentTarget.value)}>
            <option value="0">0° · north</option>
            <option value="90">90° · east</option>
            <option value="180">180° · south</option>
            <option value="270">270° · west</option>
          </select>
        </Field>

        <div className="field">
          <span className="field__label">Existing blocks</span>
          <Toggle
            label="Replace existing blocks"
            checked={replace}
            onChange={setReplace}
            stateLabels={["Preserve", "Replace"]}
          />
          <span className="field__hint">Preserve skips blocks that already match the schematic. Replace overwrites the volume.</span>
        </div>

        {upload && (
          <div className="upload-meter" role="status">
            <Progress value={upload.percent} max={100} label="Schematic upload" />
            <div className="row row--between">
              <span className="mono mute">
                {bytes(upload.loaded)} / {bytes(upload.total)} · {Math.round(upload.percent)}%
              </span>
              <span className="mono mute">{etaText ?? (upload.percent >= 100 ? "Upload complete" : "measuring…")}</span>
            </div>
          </div>
        )}

        <AgentOfflineNotice action="The schematic uploads now and the build starts when the builder reconnects." />

        <Button
          variant="primary"
          block
          leading={<Icon name="upload" size={13} />}
          onClick={() => void submit()}
          loading={pending?.status === "pending"}
          loadingLabel="Uploading schematic"
          disabled={!canUpload}
          disabledReason={
            busy
              ? "A schematic is already active. Cancel it before uploading another."
              : !file
                ? "Choose a Sponge .schem file first."
                : !coordsValid
                  ? "Origin coordinates must be whole numbers within ±29,999,984."
                  : undefined
          }
        >
          Upload &amp; begin build
        </Button>
        <PendingInline entry={pending} onRetry={() => void submit()} />
        <p className="advisory">
          <Icon name="shield" size={11} /> Rotation is persisted with the job. The worker validates materials before
          placing; shortages pause the build instead of skipping blocks.
        </p>
      </div>
    </Panel>
  );
}
