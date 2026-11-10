import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { contrast, coverage, critique, deepseekPrompt, geminiPrompt, photography, research } from "../prompt";
import { Photo } from "../components/Photo";
import { photoCredits, photos } from "../images";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Divider, Eyebrow, Panel, PanelHead } from "../components/ui";

const subagents = [
  { n: "Audit", d: "Inventory every control, route, and visual defect. No code." },
  { n: "Design system", d: "Tokens, type scale, and every component state." },
  { n: "Fleet", d: "Hero, metrics, radar, feed, services, topology." },
  { n: "Loadout", d: "Pilot card, telemetry, dispatch, subsystem toggles." },
  { n: "Shell", d: "Navigation, palette, terminal, toasts, transitions." },
  { n: "QA", d: "Three widths, keyboard paths, contrast, parity check." },
];

const tokens = [
  { name: "Void", hex: "#0A090B", use: "canvas" },
  { name: "Panel", hex: "#121014", use: "surface" },
  { name: "Raise", hex: "#17141A", use: "inset" },
  { name: "Line", hex: "#262129", use: "hairline" },
  { name: "Ink", hex: "#F3EDE8", use: "primary" },
  { name: "Ink dim", hex: "#AAA2AB", use: "secondary" },
  { name: "Blush", hex: "#F0AEC0", use: "signature" },
  { name: "Gold", hex: "#F0B85A", use: "kintsugi" },
  { name: "Sage", hex: "#A9C9B4", use: "healthy" },
  { name: "Amber", hex: "#E4C690", use: "warning" },
  { name: "Porcelain", hex: "#FAF3F5", use: "day canvas" },
];

const changes = [
  "Five real tabs — Fleet, Grind, Build, Add-ons, Providers — with hash routing.",
  "One signature accent; sage and amber carry status meaning only.",
  "Hairline surfaces and flat insets instead of nested glowing cards.",
  "Every spec surface gets real content: no full-screen failure states.",
  "Deterministic grind and schematic progress that restores after refresh.",
  "Working palette, terminal, lightbox, supervisor controls, and UI chime.",
  "Eleven real Kyoto photographs replace illustrated art, with credits.",
];

export function Brief({ notify }: { notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void }) {
  const [model, setModel] = useState<"gemini" | "deepseek">("gemini");
  const prompt = model === "gemini" ? geminiPrompt : deepseekPrompt;
  const stats = useMemo(() => {
    const words = prompt.trim().split(/\s+/).length;
    return { words, lines: prompt.split("\n").length, mins: Math.max(1, Math.round(words / 220)) };
  }, [prompt]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      notify(`${model === "gemini" ? "Gemini" : "DeepSeek"} prompt copied`, `${stats.words.toLocaleString()} words · ready to paste`, "info");
    } catch {
      notify("Copy blocked by the browser", "Select the brief text and copy manually", "warn");
    }
  };

  const download = () => {
    const blob = new Blob([`# Yozakura ENI-01 · upgrade brief (${model})\n\n${prompt}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yozakura-upgrade-brief-${model}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify("Brief downloaded", `yozakura-upgrade-brief-${model}.txt · ${stats.words.toLocaleString()} words`);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Workspace / Upgrade brief"
        title={<>Raise the <span className="display italic text-blush">ceiling.</span></>}
        serif
        description="A spec-aware prompt built from your real architecture: five tabs, dual themes, eight overlays and endpoints, and the exact defects visible in the screenshots. Hand the art-direction brief to Gemini 3.8 Flash High, then the implementation brief to DeepSeek v4.1 Flash 1017."
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={download}>Download</Button>
            <Button variant="primary" icon="copy" onClick={copy}>Copy {model === "gemini" ? "Gemini" : "DeepSeek"} prompt</Button>
          </>
        }
        meta={
          <>
            <Chip tone="blush">Reference build</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">{stats.words.toLocaleString()} words · {stats.lines} lines</span>
            <span className="font-mono text-[9.5px] text-ink-mute">≈ {stats.mins} min read</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Panel className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blush/[0.06] blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-blush/25 bg-blush/[0.08] text-blush"><Icon name="spark" size={15} /></span>
                <div>
                  <p className="text-[12.5px] text-ink">Design brief · v1</p>
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">the prompt that fixes the cheap feeling</p>
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-[8px] border border-white/[0.07] bg-white/[0.02] p-0.5">
                {(["gemini", "deepseek"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={cn("rounded-[6px] px-3 py-1.5 text-[11px] transition-colors", model === m ? "bg-white/[0.08] text-ink" : "text-ink-mute hover:text-ink-dim")}
                  >
                    {m === "gemini" ? "Gemini 3.8 Flash High" : "DeepSeek v4.1"}
                  </button>
                ))}
              </div>
            </div>
            <p className="relative mt-4 max-w-[620px] text-[12px] leading-relaxed text-ink-dim">
              {model === "gemini"
                ? "A complete art-direction and orchestration prompt with six subagent roles, five delivery phases, and an explicit acceptance bar. It forbids the exact patterns that made the original feel cheap."
                : "A condensed engineering brief: tokens, component contracts, state requirements, motion timings, and non-negotiable quality gates. Paste it after the Gemini plan is approved."}
            </p>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blush/70" />
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">upgrade-prompt.txt</span>
                <span className="font-mono text-[8.5px] text-ink-mute">read only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">{stats.words.toLocaleString()} words</span>
                <Button variant="secondary" size="sm" icon="copy" onClick={copy}>Copy</Button>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto bg-[#0D0B0F]">
              <pre className="whitespace-pre-wrap break-words px-5 py-5 font-mono text-[10.5px] leading-[1.85] text-ink-dim selection:bg-blush/25">{prompt}</pre>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3">
              <span className="flex items-center gap-1.5 font-mono text-[8.5px] text-ink-mute"><Icon name="lock" size={10} /> self-contained · no attachments required</span>
              <button onClick={copy} className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-blush/80 transition-colors hover:text-blush">
                <Icon name="copy" size={10} /> copy to clipboard
              </button>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <PanelHead eyebrow="How to run it" title="Handoff sequence" meta={<Chip tone="neutral">4 steps</Chip>} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["01", "Attach the screenshots and the existing repo", "Gemini needs the real components, not a description. Let the audit agent run first."],
                ["02", "Ask for diagnosis and tokens only", "Do not let it write UI yet. Approve the palette, type scale, and shell plan."],
                ["03", "Fan out Fleet, Loadout, and Shell to subagents", "Every subagent receives the same token block. Reconciliation is your job, not theirs."],
                ["04", "Pass the DeepSeek brief for implementation and QA", "Build, then screenshot at 1440 / 1024 / 390 and reject anything that still glows."],
              ].map(([n, t, d]) => (
                <div key={n} className="rounded-[10px] border border-white/[0.06] bg-white/[0.018] p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[8.5px] text-blush">{n}</span>
                    <span className="text-[11.5px] text-ink">{t}</span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-mute">{d}</p>
                </div>
              ))}
            </div>
            <Divider className="my-5" />
            <div className="grid gap-2 sm:grid-cols-2">
              {research.map((r) => (
                <div key={r.area} className="rounded-[8px] border border-white/[0.055] bg-white/[0.015] p-3">
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-blush/70">{r.area}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-ink-mute">{r.note}</p>
                </div>
              ))}
            </div>
            <Divider className="my-5" />
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow className="mr-1 !text-[8px]">Subagents</Eyebrow>
              {subagents.map((s) => (
                <span key={s.n} title={s.d} className="cursor-default rounded-[6px] border border-white/[0.07] bg-white/[0.02] px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-mute transition-colors hover:border-blush/20 hover:text-blush/80">
                  {s.n}
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Panel className="overflow-hidden p-0">
            <div className="relative flex h-[148px]">
              <Photo src={photos.pilot} alt="Editorial portrait beside a stone lantern" className="h-full w-[62%]" position="52% 26%" grade="night" />
              <Photo src={photos.pilotAlt} alt="Kimono portrait at a temple lantern in Kyoto" className="h-full w-[38%]" position="50% 24%" grade="night" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121014] via-[#121014]/10 to-transparent" />
              <div className="absolute left-4 top-4"><Chip tone="neutral" className="!bg-black/40 !backdrop-blur">Imagery · real photography</Chip></div>
              <div className="absolute inset-x-4 bottom-3">
                <p className="display text-[20px] leading-tight text-white">Not concept art.</p>
                <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-white/50">11 photographs · Pexels licence · locally hosted</p>
              </div>
            </div>
            <div className="p-4">
              <ul className="space-y-2.5">
                {photography.map((p) => (
                  <li key={p.title}>
                    <p className="text-[10.5px] leading-snug text-ink">{p.title}</p>
                    <p className="mt-0.5 text-[9.5px] leading-relaxed text-ink-mute">{p.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Diagnosis" title="Why it felt cheap" meta={<Chip tone="warn">6 causes</Chip>} />
            <ol className="mt-4 space-y-3.5">
              {critique.map((c, i) => (
                <li key={c.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.08] font-mono text-[8px] text-ink-mute">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[11.5px] leading-snug text-ink">{c.title}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-ink-mute">{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Art direction" title="Tokens in this build" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {tokens.map((t) => (
                <div key={t.name} className="group">
                  <div className="h-9 w-full rounded-[6px] border border-white/[0.08]" style={{ background: t.hex }} />
                  <div className="mt-1.5 truncate text-[10px] text-ink-dim">{t.name}</div>
                  <div className="truncate font-mono text-[8px] text-ink-mute">{t.use}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[8px] border border-white/[0.06] bg-white/[0.018] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">Contrast check</span>
                <span className="font-mono text-[8px] text-sage">AA+</span>
              </div>
              {contrast.map(([bg, bgHex, fg, fgHex, ratio]) => (
                <div key={String(bg) + String(fg)} className="flex items-center justify-between border-t border-white/[0.045] py-1.5 first:border-0 first:pt-0">
                  <span className="flex items-center gap-1.5 text-[9.5px] text-ink-mute">
                    <span className="flex overflow-hidden rounded-[2px] border border-white/10">
                      <span className="h-3 w-2" style={{ background: String(bgHex) }} />
                      <span className="h-3 w-2" style={{ background: String(fgHex) }} />
                    </span>
                    {bg} / {fg}
                  </span>
                  <span className="font-mono text-[9px] text-sage">{ratio}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Coverage" title="Spec surfaces in the prompt" meta={<Chip tone="blush">{coverage.length}</Chip>} />
            <ul className="mt-4 space-y-2">
              {coverage.map((c) => (
                <li key={c} className="flex gap-2 text-[10.5px] leading-relaxed text-ink-dim">
                  <Icon name="check" size={11} className="mt-0.5 shrink-0 text-sage/80" />
                  {c}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="Colophon" title="Photography credits" meta={<Chip tone="neutral">{photoCredits.length}</Chip>} />
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {[photos.heroNight, photos.pilot, photos.blossom, photos.fuji, photos.castle, photos.torii, photos.lanterns, photos.lanternLane, photos.wave].map((src, i) => (
                <Photo key={i} src={src} alt="" className="aspect-square rounded-[5px]" grade="night" />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {photoCredits.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-2 border-t border-white/[0.045] pt-1.5 first:border-0 first:pt-0">
                  <span className="truncate text-[9.5px] text-ink-mute">{c.by}</span>
                  <span className="shrink-0 font-mono text-[7.5px] uppercase tracking-[0.1em] text-ink-mute/60">{c.source} · {c.id}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[9px] leading-relaxed text-ink-mute/70">Free for commercial use under the Pexels licence; attribution is not required but is shown as courtesy. Downloaded locally and graded in CSS — no runtime hotlinks. Portraits are clearly marked editorial placeholders: the people photographed are not affiliated with this project, and nothing implies their endorsement.</p>
          </Panel>

          <Panel className="p-5">
            <PanelHead eyebrow="What changed" title="The reference build" />
            <ul className="mt-4 space-y-2.5">
              {changes.map((c) => (
                <li key={c} className="flex gap-2 text-[10.5px] leading-relaxed text-ink-dim">
                  <Icon name="check" size={12} className="mt-0.5 shrink-0 text-sage/80" />
                  {c}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
