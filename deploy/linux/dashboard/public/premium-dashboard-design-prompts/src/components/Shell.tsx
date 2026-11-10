import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { navGroups, pageMeta, type PageId } from "../data";
import { Icon, Monogram, type IconName } from "./icons";
import { photos } from "../images";
import { AvatarPhoto } from "./Photo";
import { Button, Chip, Eyebrow, IconButton, Kbd, Meter, Panel, StatusDot } from "./ui";

export type ToastItem = { id: number; title: string; detail?: string; tone?: "ok" | "warn" | "info" };

/* ================================================================== */
/* Sidebar                                                             */
/* ================================================================== */
export function Sidebar({
  page,
  onNavigate,
  open,
  onClose,
  addonCount,
  onControl,
}: {
  page: PageId;
  onNavigate: (p: PageId) => void;
  open: boolean;
  onClose: () => void;
  addonCount: number;
  onControl: (action: "start" | "workers" | "restart" | "stop") => void;
}) {
  const go = (p: PageId) => {
    onNavigate(p);
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-white/[0.06] bg-[#0B090C]/95 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/[0.055] px-4">
          <button onClick={() => go("fleet")} className="group flex items-center gap-2.5 text-left">
            <Monogram className="h-8 w-8 shrink-0" />
            <span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-medium tracking-[-0.01em] text-ink">Yozakura</span>
                <span className="font-mono text-[9px] text-ink-mute">/ ENI-01</span>
              </span>
              <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-mute">Blossom control</span>
            </span>
          </button>
          <IconButton icon="x" label="Close navigation" onClick={onClose} className="lg:hidden" />
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-white/[0.022] px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-blush/[0.12] font-mono text-[9px] text-blush">夜</span>
              <span className="text-[12px] text-ink-dim">Night pavilion</span>
            </div>
            <span className="rounded-full border border-sage/20 bg-sage/[0.08] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-sage">Live</span>
          </div>
        </div>

        <nav className="hide-scrollbar mt-5 flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <Eyebrow className="mb-1.5 px-2.5 !text-[8.5px] !tracking-[0.2em] text-ink-mute/70">{group.label}</Eyebrow>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = page === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => go(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[12.5px] transition-colors duration-200",
                          active
                            ? "bg-white/[0.055] text-ink"
                            : "text-ink-dim hover:bg-white/[0.032] hover:text-ink",
                        )}
                      >
                        {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-blush" />}
                        <Icon
                          name={item.icon as IconName}
                          size={15}
                          className={cn("shrink-0 transition-colors", active ? "text-blush" : "text-ink-mute group-hover:text-ink-dim")}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.id === "addons" && (
                          <span className="font-mono text-[9.5px] text-ink-mute">{String(addonCount).padStart(2, "0")}</span>
                        )}
                        {item.id === "fleet" && <span className="h-1.5 w-1.5 rounded-full bg-sage/80" />}
                        {item.id === "brief" && <span className="rounded-[4px] border border-blush/20 px-1 py-px font-mono text-[8px] uppercase tracking-wider text-blush/80">new</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-white/[0.055] p-3">
          <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.018] p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow className="!text-[8px] !tracking-[0.18em]">ENI supervisor</Eyebrow>
              <span className="flex items-center gap-1 font-mono text-[8px] text-sage"><StatusDot tone="ok" size={5} /> online</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {([["start", "Start ENI", "play"], ["workers", "Workers", "bot"], ["restart", "Restart", "refresh"], ["stop", "Stop", "power"]] as const).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => onControl(id)}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1.5 rounded-[6px] border font-mono text-[8.5px] uppercase tracking-[0.08em] transition-colors",
                    id === "stop"
                      ? "border-rose/20 bg-rose/[0.05] text-rose/80 hover:bg-rose/[0.1] hover:text-rose"
                      : id === "restart"
                        ? "border-white/[0.08] bg-white/[0.03] text-ink-dim hover:border-blush/25 hover:text-blush"
                        : "border-white/[0.06] bg-white/[0.02] text-ink-mute hover:text-ink-dim",
                  )}
                >
                  <Icon name={icon as IconName} size={9} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-[10px] border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-transparent p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11.5px] text-ink"><StatusDot tone="ok" /> Fleet nominal</span>
              <span className="font-mono text-[9px] text-sage">99.98%</span>
            </div>
            <Meter value={99.98} tone="sage" className="mt-2.5" />
            <p className="mt-2.5 text-[10.5px] leading-relaxed text-ink-mute">8 of 8 agents responding across 3 shards.</p>
          </div>
          <div className="flex items-center gap-2 rounded-[8px] px-1 py-1">
            <AvatarPhoto src={photos.blossom} alt="Operator emblem" size={26} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] text-ink-dim">Operator · ENI-01</div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">Clearance · owner</div>
            </div>
            <Kbd>⌘K</Kbd>
          </div>
          <div className="flex items-center justify-between px-1 font-mono text-[8.5px] tracking-wide text-ink-mute/60">
            <span>v2.4.1</span>
            <span>build 8f2a1c</span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ================================================================== */
/* Top bar                                                             */
/* ================================================================== */
export function TopBar({
  page,
  onMenu,
  onPalette,
  onTerminal,
  onNotify,
  ambience,
  onAmbience,
  sound,
  onSound,
  onRefresh,
  theme = "yozakura",
  onToggleTheme,
  isLive = false,
}: {
  page: PageId;
  onMenu: () => void;
  onPalette: () => void;
  onTerminal: () => void;
  onNotify: () => void;
  ambience: boolean;
  onAmbience: () => void;
  sound: boolean;
  onSound: () => void;
  onRefresh: () => void;
  theme?: "yozakura" | "hanami";
  onToggleTheme?: () => void;
  isLive?: boolean;
}) {
  const meta = pageMeta[page];
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.055] bg-shell/80 backdrop-blur-xl">
      <div className="flex h-[60px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <IconButton icon="menu" label="Open navigation" onClick={onMenu} className="lg:hidden" />
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute sm:inline">Yozakura</span>
          <Icon name="chevron-right" size={11} className="hidden text-ink-mute/50 sm:inline" />
          <span className="truncate text-[12.5px] text-ink">{meta.title}</span>
          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute md:inline-flex">
            <StatusDot tone={isLive ? "ok" : "warn"} />
            {isLive ? "ENI1 Live" : "Offline Preview"}
          </span>
          <span className="hidden items-center gap-2 font-mono text-[8.5px] tracking-[0.08em] text-ink-mute/70 xl:flex">
            <span className="h-3 w-px bg-white/[0.09]" />
            coordinator :8090
            <span className="h-3 w-px bg-white/[0.09]" />
            mindserver :8091
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onPalette}
            className="group flex h-8 items-center gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.025] pl-2.5 pr-1.5 text-ink-mute transition-colors hover:border-white/[0.12] hover:bg-white/[0.045] hover:text-ink-dim"
            aria-label="Open command palette"
          >
            <Icon name="search" size={13} />
            <span className="hidden w-[124px] text-left text-[11.5px] md:inline">Search or jump to…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <div className="mx-1 hidden h-4 w-px bg-white/[0.08] sm:block" />
          <IconButton icon="refresh" label="Refresh dashboard" onClick={onRefresh} className="hidden sm:inline-flex" />
          {onToggleTheme && (
            <IconButton
              icon={theme === "hanami" ? "moon" : "spark"}
              label={theme === "hanami" ? "Switch to Yozakura Night" : "Switch to Hanami Daylight"}
              onClick={onToggleTheme}
              className="hidden sm:inline-flex"
            />
          )}
          <IconButton icon={ambience ? "spark" : "moon"} label={ambience ? "Soften artwork ambience" : "Raise artwork ambience"} onClick={onAmbience} className="hidden sm:inline-flex" />
          <IconButton icon={sound ? "radio" : "heart"} label={sound ? "Mute interface sound" : "Enable interface sound"} onClick={onSound} className={cn("hidden sm:inline-flex", sound && "!text-blush")} />
          <button onClick={onNotify} className="relative hidden h-8 w-8 items-center justify-center rounded-[8px] text-ink-mute transition-colors hover:bg-white/[0.045] hover:text-ink sm:inline-flex" aria-label="Notifications">
            <Icon name="bell" size={16} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blush ring-2 ring-[#0A090B]" />
          </button>
          <div className="mx-1 hidden h-4 w-px bg-white/[0.08] sm:block" />
          <Button variant="secondary" size="sm" icon="terminal" onClick={onTerminal} className="hidden sm:inline-flex">
            Terminal
            <span className="ml-0.5 font-mono text-[9px] text-ink-mute">~</span>
          </Button>
          <IconButton icon="terminal" label="Open terminal" onClick={onTerminal} className="sm:hidden" />
        </div>
      </div>
    </header>
  );
}

/* ================================================================== */
/* Command palette                                                     */
/* ================================================================== */
export type PaletteAction = { id: string; label: string; hint?: string; icon: IconName; group: string; run: () => void; keywords?: string };

export function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = query
      ? actions.filter((a) => `${a.label} ${a.group} ${a.keywords ?? ""}`.toLowerCase().includes(query))
      : actions;
    const groups: { group: string; items: PaletteAction[] }[] = [];
    for (const a of filtered) {
      const g = groups.find((x) => x.group === a.group);
      if (g) g.items.push(a);
      else groups.push({ group: a.group, items: [a] });
    }
    return groups;
  }, [actions, q]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, flat.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && flat[sel]) {
        e.preventDefault();
        flat[sel].run();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, flat, sel, onClose]);

  if (!open) return null;

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[11vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px] anim-fade-in" onClick={onClose} />
      <div className="anim-fade-up relative w-full max-w-[580px] overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#141116] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Icon name="search" size={17} className="text-ink-mute" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search agents, pages, and actions…"
            className="h-[52px] flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-mute focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-[13px] text-ink-dim">No matches for “{q}”</p>
              <p className="mt-1 text-[11.5px] text-ink-mute">Try fleet, add-ons, provider, or sync.</p>
            </div>
          )}
          {results.map((g) => (
            <div key={g.group} className="mb-1.5 last:mb-0">
              <Eyebrow className="px-3 py-2 !text-[8.5px] !tracking-[0.2em]">{g.group}</Eyebrow>
              {g.items.map((a) => {
                idx += 1;
                const active = idx === sel;
                return (
                  <button
                    key={a.id}
                    onMouseEnter={() => setSel(flat.findIndex((x) => x.id === a.id))}
                    onClick={() => {
                      a.run();
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left transition-colors",
                      active ? "bg-white/[0.07]" : "hover:bg-white/[0.035]",
                    )}
                  >
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-[7px] border", active ? "border-blush/25 bg-blush/[0.1] text-blush" : "border-white/[0.07] bg-white/[0.02] text-ink-mute")}>
                      <Icon name={a.icon} size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink">{a.label}</span>
                      {a.hint && <span className="mt-0.5 block truncate text-[10.5px] text-ink-mute">{a.hint}</span>}
                    </span>
                    {active && <span className="font-mono text-[9px] uppercase tracking-wider text-ink-mute">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-black/20 px-4 py-2.5">
          <div className="flex items-center gap-3 text-[10px] text-ink-mute">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> select</span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute/60">ENI command</span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Terminal dock                                                       */
/* ================================================================== */
export type TermLine = { text: string; tone?: "mute" | "ink" | "ok" | "warn" | "blush" };

export function TerminalDock({
  open,
  onClose,
  lines,
  onCommand,
}: {
  open: boolean;
  onClose: () => void;
  lines: TermLine[];
  onCommand: (cmd: string) => void;
}) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "";
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, open]);

  if (!open) return null;

  const toneClass = { mute: "text-ink-mute", ink: "text-ink-dim", ok: "text-sage", warn: "text-amber", blush: "text-blush" };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[65] px-0 sm:px-6 sm:pb-5">
      <div className="anim-fade-up mx-auto w-full max-w-[980px] overflow-hidden rounded-t-[16px] border border-white/[0.11] bg-[#0E0C10]/97 shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:rounded-[16px]">
        <div className="flex h-11 items-center gap-3 border-b border-white/[0.07] px-4">
          <div className="flex items-center gap-1.5">
            <button onClick={onClose} aria-label="Close terminal" className="h-2.5 w-2.5 rounded-full bg-[#4a3540] transition-colors hover:bg-rose" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#4a4030]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#33402f]" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">eni terminal</span>
          <span className="hidden rounded border border-white/[0.07] px-1.5 py-0.5 font-mono text-[8.5px] text-ink-mute sm:inline">pty · eni-01</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-sage"><StatusDot tone="ok" /> attached</span>
          <IconButton icon="chevron-down" label="Hide terminal" onClick={onClose} size={14} />
        </div>
        <div ref={scrollRef} className="max-h-[220px] overflow-y-auto px-4 py-3 font-mono text-[11px] leading-[1.85]">
          {lines.map((l, i) => (
            <div key={i} className={cn("whitespace-pre-wrap break-words", toneClass[l.tone ?? "ink"])}>
              {l.text}
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cmd = value.trim();
            if (!cmd) return;
            setHistory((h) => [cmd, ...h]);
            setHistIdx(-1);
            onCommand(cmd);
            setValue("");
          }}
          className="flex items-center gap-2 border-t border-white/[0.07] bg-white/[0.015] px-4 py-2.5"
        >
          <span className="font-mono text-[12px] text-blush">›</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = Math.min(histIdx + 1, history.length - 1);
                if (history[next]) {
                  setHistIdx(next);
                  setValue(history[next]);
                }
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = histIdx - 1;
                setHistIdx(next);
                setValue(next >= 0 ? history[next] : "");
              }
            }}
            placeholder="Try status, agents, enable all…"
            aria-label="Terminal command"
            spellCheck={false}
            className="flex-1 bg-transparent font-mono text-[11px] text-ink placeholder:text-ink-mute/60 focus:outline-none"
          />
          <span className="hidden gap-2 font-mono text-[9px] text-ink-mute/60 sm:flex">
            <span>↑ history</span>
            <span>· help</span>
          </span>
          <button type="submit" aria-label="Run command" className="text-ink-mute transition-colors hover:text-blush">
            <Icon name="arrow-right" size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Toasts                                                              */
/* ================================================================== */
export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[80] flex w-[min(92vw,336px)] flex-col gap-2 sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-toast pointer-events-auto flex items-start gap-3 rounded-[11px] border border-white/[0.1] bg-[#17131A]/97 p-3 pr-2.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl"
          role="status"
        >
          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border", t.tone === "warn" ? "border-amber/25 bg-amber/[0.1] text-amber" : t.tone === "info" ? "border-blush/25 bg-blush/[0.1] text-blush" : "border-sage/25 bg-sage/[0.1] text-sage")}>
            <Icon name={t.tone === "warn" ? "bell" : t.tone === "info" ? "spark" : "check"} size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-snug text-ink">{t.title}</p>
            {t.detail && <p className="mt-0.5 text-[10.5px] leading-snug text-ink-mute">{t.detail}</p>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="rounded p-1 text-ink-mute transition-colors hover:text-ink" aria-label="Dismiss notification">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Page header                                                         */
/* ================================================================== */
export function PageHeader({
  eyebrow,
  title,
  serif,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  title: React.ReactNode;
  serif?: boolean;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Eyebrow className="mb-3 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-blush/70" />
          {eyebrow}
        </Eyebrow>
        <h1 className={cn("text-[30px] leading-[1.08] tracking-[-0.025em] text-ink sm:text-[36px]", serif && "display text-[34px] sm:text-[42px] lg:text-[46px]")}>{title}</h1>
        {description && <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-ink-dim">{description}</p>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-7 sm:px-6 lg:px-8 lg:pt-9">{children}</div>;
}

/* ================================================================== */
/* 4K artwork lightbox                                                 */
/* ================================================================== */
const gallery = [
  {
    src: photos.fuji,
    title: "Mount Fuji · Chureito Pagoda",
    meta: "Fujiyoshida, Yamanashi · cherry blossom season",
    credit: "Rafael Hideki Tamanaha / Pexels",
    alt: "Chureito Pagoda with Mount Fuji behind cherry blossoms in spring",
  },
  {
    src: photos.heroNight,
    title: "Yozakura · night pavilion",
    meta: "Illuminated cherry blossoms over still water",
    credit: "Guohua Song / Pexels",
    alt: "Illuminated cherry blossom trees reflected in still water at night",
  },
  {
    src: photos.pilot,
    title: "Kyoto lantern study",
    meta: "Editorial portrait · persona placeholder",
    credit: "YI REN / Pexels",
    alt: "A person in a red floral kimono resting beside a lit stone lantern",
  },
];

export function Lightbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [index, setIndex] = useState(0);
  const restore = useRef<HTMLElement | null>(null);
  const shot = gallery[index];

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    setZoom(1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % gallery.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + gallery.length) % gallery.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Photography gallery">
      <button className="absolute inset-0 cursor-zoom-out bg-black/82 backdrop-blur-md anim-fade-in" onClick={onClose} aria-label="Close gallery" />
      <div className="anim-fade-up relative flex w-full max-w-[980px] flex-col overflow-hidden rounded-[16px] border border-white/[0.12] bg-[#0E0B10] shadow-[0_50px_120px_-30px_rgba(0,0,0,.95)]">
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">Imagery · real photography</span>
          <Chip tone="neutral" className="hidden sm:inline-flex">{index + 1} / {gallery.length}</Chip>
          <div className="ml-auto flex items-center gap-0.5 rounded-[6px] border border-white/[0.08] p-0.5">
            {[1, 1.5, 2].map((z) => (
              <button key={z} onClick={() => setZoom(z)} aria-pressed={zoom === z} className={cn("h-6 w-8 rounded-[4px] font-mono text-[8.5px] transition-colors", zoom === z ? "bg-white/[0.1] text-ink" : "text-ink-mute hover:text-ink-dim")}>
                {z}×
              </button>
            ))}
          </div>
          <IconButton icon="x" label="Close gallery" onClick={onClose} />
        </div>
        <div className="relative max-h-[62vh] overflow-auto bg-[#08070A]">
          <img
            key={shot.src}
            src={shot.src}
            alt={shot.alt}
            className="mx-auto block max-h-[62vh] w-auto origin-top saturate-[0.9] brightness-[0.96] transition-transform duration-300 ease-out anim-fade-in"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] text-ink">{shot.title}</p>
            <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-mute">{shot.meta}</p>
            <p className="mt-1 font-mono text-[8px] text-ink-mute/60">Photo · {shot.credit} · free licence, locally hosted</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {gallery.map((g, i) => (
                <button
                  key={g.src}
                  onClick={() => { setIndex(i); setZoom(1); }}
                  aria-label={`View ${g.title}`}
                  aria-pressed={i === index}
                  className={cn("h-9 w-9 overflow-hidden rounded-[5px] border transition-all", i === index ? "border-blush/60 opacity-100" : "border-white/10 opacity-55 hover:opacity-90")}
                >
                  <img src={g.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <span className="hidden items-center gap-1.5 font-mono text-[8px] text-ink-mute sm:flex">← →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Panel };
