import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../components/icons";
import { Credit, Photo } from "../components/Photo";
import { photos } from "../images";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Eyebrow, Meter, Panel, PanelHead, StatusDot, Toggle } from "../components/ui";

const materials = [
  { name: "Polished andesite", need: 1240, have: 1820 },
  { name: "Dark oak planks", need: 680, have: 642 },
  { name: "Stripped dark oak log", need: 512, have: 780 },
  { name: "Cyan stained glass", need: 168, have: 168 },
  { name: "White concrete", need: 96, have: 144 },
  { name: "Lantern", need: 48, have: 32 },
  { name: "Barrel", need: 24, have: 24 },
];

const presets = [
  { name: "Sakura pavilion", size: "412 KB", blocks: 4096, file: "sakura_pavilion.schem" },
  { name: "Yozakura gate", size: "88 KB", blocks: 1240, file: "yozakura_gate.schem" },
];

type Stage = "idle" | "building" | "paused" | "complete";

export function Schematic({ notify }: { notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>({ name: "sakura_pavilion.schem", size: 421888 });
  const [origin, setOrigin] = useState({ x: "", y: "", z: "" });
  const [rotation, setRotation] = useState(0);
  const [replace, setReplace] = useState(false);
  const [stage, setStage] = useState<Stage>("building");
  const [placed, setPlaced] = useState(1284);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const total = 4096;

  useEffect(() => {
    if (stage !== "building") return;
    const t = window.setInterval(() => {
      setPlaced((p) => {
        if (p >= total) {
          setStage("complete");
          return total;
        }
        return Math.min(total, p + 12);
      });
    }, 900);
    return () => window.clearInterval(t);
  }, [stage]);

  useEffect(() => {
    if (stage === "complete") notify("Schematic complete", "4,096 blocks placed · sakura_pavilion.schem");
  }, [stage, notify]);

  const ingest = (f: File) => {
    const ok = /\.(schem|litematic)$/i.test(f.name);
    if (!ok) {
      setError("That file type isn't supported. Use a Sponge .schem or Litematica .litematic file.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("That file is over the 8 MB limit. Split the build into layers.");
      return;
    }
    setError("");
    setFile({ name: f.name, size: f.size });
    setStage("idle");
    setPlaced(0);
    notify("Blueprint loaded", `${f.name} · ${(f.size / 1024).toFixed(0)} KB`);
  };

  const start = () => {
    if (!file) {
      setError("Choose a .schem or .litematic file before starting a build.");
      return;
    }
    setError("");
    setStage("building");
    setPlaced(0);
    notify("Build started", `${file.name} · origin ${origin.x || "auto"}, ${origin.y || "auto"}, ${origin.z || "auto"}`);
  };

  const pct = Math.round((placed / total) * 100);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Build / Schematic"
        title={<>Raise something that <span className="display italic text-blush">outlives the wipe.</span></>}
        serif
        description="Upload a Sponge .schem blueprint. ENI places it block by block, pulls missing materials from nearby chests, and saves progress so you can pause and resume."
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={() => notify("Blueprint catalog", "2 saved schematics · 5.3 MB", "info")}>Catalog</Button>
            <Button variant="primary" icon="box" onClick={start} disabled={stage === "building"}>{stage === "building" ? "Building…" : "Upload & build"}</Button>
          </>
        }
        meta={
          <>
            <Chip tone={stage === "building" ? "ok" : stage === "paused" ? "warn" : stage === "complete" ? "ok" : "neutral"} dot>
              {stage === "building" ? "Placing blocks" : stage === "paused" ? "Paused · missing lanterns" : stage === "complete" ? "Build complete" : "Idle"}
            </Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">inventory + nearby chests · 32 block reach</span>
            <span className="font-mono text-[9.5px] text-ink-mute">limit 8 MB · 100,000 blocks</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="p-5 sm:p-6 xl:col-span-5">
          <PanelHead eyebrow="Blueprint" title="Upload a build" meta={<span className="font-mono text-[8.5px] text-ink-mute">up to 8 MB</span>} />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) ingest(f); }}
            className={cn("mt-5 rounded-[11px] border border-dashed p-5 text-center transition-colors", dragging ? "border-blush/50 bg-blush/[0.05]" : "border-white/[0.11] bg-white/[0.018]")}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".schem,.litematic"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) ingest(f); }}
              aria-label="Choose a schematic file"
            />
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-[9px] border border-white/[0.08] bg-white/[0.025] text-ink-mute"><Icon name="box" size={17} /></span>
            {file ? (
              <>
                <p className="mt-3 truncate text-[12.5px] text-ink">{file.name}</p>
                <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">{(file.size / 1024).toFixed(0)} KB · 4,096 blocks · verified</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button variant="quiet" size="sm" onClick={() => inputRef.current?.click()}>Replace file</Button>
                  <Button variant="ghost" size="sm" icon="x" aria-label="Remove file" onClick={() => { setFile(null); setError(""); setStage("idle"); setPlaced(0); }} />
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-[12.5px] text-ink">Drop a Sponge schematic here</p>
                <p className="mt-1 text-[10.5px] text-ink-mute">.schem or .litematic · 8 MB maximum</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>Choose file</Button>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-[7px] border border-rose/25 bg-rose/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-rose">
              <Icon name="bell" size={11} className="mt-px shrink-0" /> {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {presets.map((p) => (
              <button
                key={p.file}
                onClick={() => { setFile({ name: p.file, size: 1024 * 412 }); setStage("idle"); setPlaced(0); setError(""); notify("Blueprint loaded", `${p.name} · ${p.blocks} blocks`); }}
                className="flex flex-1 items-center gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-white/[0.13] hover:bg-white/[0.04]"
              >
                <Icon name="box" size={12} className="shrink-0 text-blush/70" />
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] text-ink-dim">{p.name}</span>
                  <span className="block font-mono text-[8px] text-ink-mute">{p.blocks} blocks · {p.size}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <Eyebrow className="!text-[8.5px]">Build origin</Eyebrow>
              <span className="font-mono text-[8px] text-ink-mute">blank = beside ENI1</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["x", "y", "z"] as const).map((axis) => (
                <div key={axis}>
                  <label htmlFor={`origin-${axis}`} className="mb-1.5 block font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">{axis}</label>
                  <input
                    id={`origin-${axis}`}
                    value={origin[axis]}
                    onChange={(e) => setOrigin((o) => ({ ...o, [axis]: e.target.value.replace(/[^0-9-]/g, "") }))}
                    placeholder="auto"
                    inputMode="numeric"
                    className="h-9 w-full rounded-[7px] border border-white/[0.09] bg-white/[0.03] px-2.5 font-mono text-[11px] text-ink placeholder:text-ink-mute/50 focus:border-blush/40 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="font-mono text-[8px] text-ink-mute">lower corner · feet level</span>
              <span className="font-mono text-[8px] text-ink-mute">rotation {rotation}°</span>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-2 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">Rotation</span>
            <div className="flex gap-1 rounded-[8px] border border-white/[0.07] bg-white/[0.02] p-1">
              {[0, 90, 180, 270].map((r) => (
                <button key={r} onClick={() => setRotation(r)} aria-pressed={rotation === r} className={cn("h-7 flex-1 rounded-[5px] font-mono text-[9.5px] transition-colors", rotation === r ? "bg-white/[0.08] text-ink" : "text-ink-mute hover:text-ink-dim")}>
                  {r}°
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4 rounded-[8px] border border-white/[0.055] bg-white/[0.015] p-3">
            <div>
              <p className="text-[11.5px] text-ink-dim">Replace mismatching blocks</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-ink-mute">Off by default. Existing chests and signs are never overwritten.</p>
            </div>
            <Toggle checked={replace} onChange={setReplace} label="Replace mismatching blocks" />
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="primary" className="flex-1 justify-between" onClick={start} icon="box">
              {stage === "building" ? "Rebuild from start" : "Upload & build"} <Icon name="arrow-right" size={13} />
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-mute">When a material runs out, ENI checks nearby chests within 32 blocks. If it is unavailable, the build pauses and keeps its place.</p>
        </Panel>

        <div className="space-y-4 xl:col-span-7">
          <Panel className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-blush/[0.05] blur-3xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3 rounded-[9px] border border-white/[0.06] bg-white/[0.018] p-2">
                <Photo src={photos.garden} alt="Reference photograph: stone lantern in a Kyoto garden" className="h-11 w-16 shrink-0 rounded-[5px]" grade="night" />
                <div className="min-w-0">
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">Reference · 夜桜 pavilion</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-ink-dim">Stone lantern garden, Kyoto — material and silhouette study</p>
                </div>
                <Credit className="ml-auto hidden shrink-0 sm:block">Gu Bra / Pexels</Credit>
              </div>
              <PanelHead
                eyebrow="Build progress"
                title="Sakura pavilion"
                meta={<Chip tone={stage === "building" ? "ok" : stage === "paused" ? "warn" : stage === "complete" ? "ok" : "idle"} dot>{stage === "building" ? "Placing" : stage === "complete" ? "Complete" : stage === "paused" ? "Paused" : "Idle"}</Chip>}
                actions={<span className="font-mono text-[9px] text-ink-mute">layer {Math.min(48, Math.ceil(pct / 2.1))} / 48</span>}
              />
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="num text-[36px] leading-none text-ink">{placed.toLocaleString()}</span>
                    <span className="font-mono text-[10.5px] text-ink-mute">/ {total.toLocaleString()} blocks</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Meter value={pct} className="w-40" />
                    <span className="font-mono text-[10px] text-blush">{pct}%</span>
                  </div>
                </div>
                <div className="flex gap-6 sm:ml-auto">
                  {[["ETA", stage === "building" ? "3m 42s" : "—"], ["Placed / min", "48"], ["Chest runs", "2"]].map(([k, v]) => (
                    <div key={k}>
                      <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-ink-mute">{k}</div>
                      <div className="mt-1 font-mono text-[11px] text-ink-dim">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.055] pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={stage === "paused" ? "play" : "pause"}
                  disabled={stage === "idle" || stage === "complete"}
                  onClick={() => {
                    setStage((s) => (s === "paused" ? "building" : "paused"));
                    notify(stage === "paused" ? "Build resumed" : "Build paused", `Layer ${Math.min(48, Math.ceil(pct / 2.1))} · position kept`, stage === "paused" ? "ok" : "info");
                  }}
                >
                  {stage === "paused" ? "Resume" : "Pause"}
                </Button>
                <Button variant="quiet" size="sm" icon="x" disabled={stage === "idle"} onClick={() => { setStage("paused"); notify("Build aborted", `${placed} of ${total} blocks placed · resumable`, "warn"); }}>Abort</Button>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[8.5px] text-ink-mute">
                  <StatusDot tone={stage === "paused" ? "warn" : "ok"} /> {stage === "paused" ? "waiting on lanterns · 32 short" : "streaming placements every 900ms"}
                </span>
              </div>

              {stage === "paused" && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-amber/20 bg-amber/[0.05] px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[10.5px] text-amber"><Icon name="bell" size={11} /> Missing 32 lanterns. Nearest chest has 12.</span>
                  <button onClick={() => { setStage("building"); notify("Resupply queued", "Night cache → build site · 32 lanterns", "info"); }} className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-amber hover:text-amber/80">request resupply</button>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between p-5">
              <PanelHead eyebrow="Materials" title="Have / need" meta={<Chip tone="warn" dot>1 shortage</Chip>} />
              <span className="font-mono text-[8.5px] text-ink-mute">nearest chest · 32b</span>
            </div>
            <ul className="border-t border-white/[0.055]">
              {materials.map((m) => {
                const short = m.have < m.need;
                return (
                  <li key={m.name} className="flex items-center gap-3 border-b border-white/[0.045] px-5 py-2.5 last:border-0 hover:bg-white/[0.015]">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", short ? "bg-amber" : "bg-sage/70")} />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink-dim">{m.name}</span>
                    <Meter value={Math.min(100, (m.have / m.need) * 100)} tone={short ? "amber" : "sage"} className="w-20" />
                    <span className={cn("w-24 shrink-0 text-right font-mono text-[9.5px]", short ? "text-amber" : "text-ink-mute")}>
                      {m.have.toLocaleString()} / {m.need.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="font-mono text-[8.5px] text-ink-mute">materials combine inventory + chests</span>
              <button onClick={() => notify("Materials reserved", "7 materials · 2,768 blocks staged", "info")} className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-dim hover:text-blush">reserve all</button>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Format notes" title="What is and isn't copied" actions={<Chip tone="neutral">Sponge .schem</Chip>} />
            <div className="mt-4 space-y-2 text-[10.5px] leading-relaxed text-ink-mute">
              <p className="flex gap-2"><Icon name="check" size={12} className="mt-0.5 shrink-0 text-sage" /> Blocks, block states, and rotation within the 100,000 block limit.</p>
              <p className="flex gap-2"><Icon name="x" size={12} className="mt-0.5 shrink-0 text-rose" /> Chest contents, signs, entities, and block-entity data are not copied.</p>
              <p className="flex gap-2"><Icon name="compass" size={12} className="mt-0.5 shrink-0 text-ink-mute" /> Survival placement follows vanilla orientation rules for stairs, doors, and similar blocks.</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.055] pt-3">
              <span className="font-mono text-[8.5px] text-ink-mute">automatic .bak before write</span>
              <span className="flex items-center gap-1.5 font-mono text-[8.5px] text-sage"><StatusDot tone="ok" /> ready</span>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
