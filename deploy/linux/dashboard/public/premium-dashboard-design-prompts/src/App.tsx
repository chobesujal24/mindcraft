import { useCallback, useEffect, useRef, useState } from "react";
import { addons, agents, navGroups, pageMeta, type PageId } from "./data";
import { geminiPrompt, deepseekPrompt } from "./prompt";
import { Sidebar, TopBar, CommandPalette, TerminalDock, ToastStack, Lightbox, type PaletteAction, type TermLine, type ToastItem } from "./components/Shell";
import { pollSystemState, executeService, saveAddonSettings, type SystemStatus } from "./api";
import { Fleet } from "./pages/Fleet";
import { Grind } from "./pages/Grind";
import { Schematic } from "./pages/Schematic";
import { AddOns } from "./pages/AddOns";
import { Providers } from "./pages/Providers";
import { Profiles } from "./pages/Profiles";
import { Runtime } from "./pages/Runtime";
import { Log, type Dispatched } from "./pages/Log";
import { Brief } from "./pages/Brief";

const initialEnabled: Record<string, boolean> = Object.fromEntries(addons.map((a) => [a.id, a.enabled]));
const validPages: PageId[] = ["fleet", "grind", "build", "addons", "providers", "profiles", "runtime", "log", "brief"];

const readHash = (): PageId => {
  const h = window.location.hash.replace("#", "") as PageId;
  return validPages.includes(h) ? h : "fleet";
};

const clock = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Petals() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${(i * 7.3 + 4) % 100}%`,
            animationDuration: `${26 + (i % 5) * 9}s`,
            animationDelay: `${-i * 4.5}s`,
            opacity: 0.1 + (i % 4) * 0.045,
            transform: `scale(${0.55 + (i % 3) * 0.3})`,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<PageId>(readHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [ambience, setAmbience] = useState(true);
  const [sound, setSound] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(initialEnabled);
  const [dispatched, setDispatched] = useState<Dispatched[]>([]);
  const [theme, setTheme] = useState<"yozakura" | "hanami">(() => {
    return (localStorage.getItem("yozakura_theme") as "yozakura" | "hanami") || "yozakura";
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ isLive: false });
  const [termLines, setTermLines] = useState<TermLine[]>([
    { text: "Yozakura ENI-01 · supervisor shell", tone: "blush" },
    { text: "Attached to eni-01.internal · 8 agents responding", tone: "ok" },
    { text: "Type `help` for commands. System polling active (:8092).", tone: "mute" },
  ]);
  const toastId = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);

  /* 5-second consolidated polling with Page Visibility API */
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      const status = await pollSystemState();
      if (active) setSystemStatus(status);
    };

    poll();
    const timer = setInterval(poll, 5000);
    const onVisibility = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* theme persistence */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("yozakura_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "yozakura" ? "hanami" : "yozakura"));
    chime("tap");
    notify(
      theme === "yozakura" ? "Hanami Daylight applied" : "Yozakura Night applied",
      theme === "yozakura" ? "Porcelain & rosewater" : "Obsidian & neon sakura",
      "info"
    );
  };

  /* synthesized UI chime (opt-in) -------------------------------- */
  const chime = useCallback((kind: "tap" | "ok" | "warn" = "tap") => {
    if (!sound) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioRef.current ?? new Ctx();
      audioRef.current = ctx;
      const notes = kind === "ok" ? [659.25, 783.99, 987.77] : kind === "warn" ? [440, 392] : [587.33, 698.46];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 ? "triangle" : "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.055;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {
      /* audio is optional */
    }
  }, [sound]);

  const notify = useCallback((title: string, detail?: string, tone: "ok" | "warn" | "info" = "ok") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, title, detail, tone }]);
    if (tone === "warn") chime("warn");
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, [chime]);

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const pushLines = useCallback((lines: TermLine[]) => {
    setTermLines((prev) => [...prev, ...lines].slice(-120));
  }, []);

  const navigate = useCallback((p: PageId) => {
    setPage(p);
    if (window.location.hash !== `#${p}`) window.history.replaceState(null, "", `#${p}`);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    document.title = `${pageMeta[page].title} — Yozakura ENI-01`;
  }, [page]);

  useEffect(() => {
    const onHash = () => setPage(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.ambience = String(ambience);
  }, [ambience]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setMobileOpen(false);
        setLightbox(false);
      }
      if (!typing && e.key.toLowerCase() === "t" && !lightbox) {
        e.preventDefault();
        setTerminalOpen((t) => !t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const toggleAddon = (id: string, value: boolean) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: value };
      void saveAddonSettings(next);
      return next;
    });
  };

  const bulkAddons = (value: boolean) => {
    const next = Object.fromEntries(addons.map((a) => [a.id, value]));
    setEnabled(next);
    void saveAddonSettings(next);
    chime(value ? "ok" : "tap");
    notify(value ? "All subsystems enabled" : "Fleet moved to standby", value ? `${addons.length} modules armed · Mt. Fuji` : `${addons.length} modules disarmed · reversible`, value ? "ok" : "info");
  };

  const dispatch = (label: string) => {
    const time = clock();
    setDispatched((d) => [{ id: Date.now() + Math.random(), label, time }, ...d]);
    chime("ok");
    notify("Packet dispatched", `${label} · mc-foreman · acknowledged in 42ms`);
    pushLines([
      { text: `› dispatch ${label}`, tone: "blush" },
      { text: `  mc-foreman · acknowledged · ${time} · 42ms`, tone: "ok" },
    ]);
  };

  const supervisor = async (action: "start" | "workers" | "restart" | "stop") => {
    chime(action === "stop" ? "warn" : "ok");
    const copy = {
      start: ["ENI started", "Supervisor online · agents reattaching"],
      workers: ["Workers started", "4 cluster workers attached · login staggered 1.5s"],
      restart: ["ENI restarted", "Supervisor resumed in 4.2s · jobs preserved"],
      stop: ["ENI stopped", "All workers disconnected · state saved to disk"],
    }[action];
    notify(copy[0], copy[1], action === "stop" ? "warn" : "ok");

    const targetService = action === "workers" ? "mc-cluster" : "mc-foreman";
    const srvAction = action === "workers" ? "start" : action;
    const res = await executeService(targetService, srvAction);
    if (!res.ok) {
      notify("Supervisor Notice", res.message, "warn");
    }
  };

  const runCommand = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    pushLines([{ text: `› ${raw}`, tone: "blush" }]);
    chime("tap");
    if (cmd === "clear") return setTermLines([]);
    if (cmd === "help") {
      pushLines([
        { text: "  status        fleet health, latency, and incidents", tone: "ink" },
        { text: "  agents        roster of the eight workers", tone: "ink" },
        { text: "  enable all    arm every add-on", tone: "ink" },
        { text: "  disable all   move every add-on to standby", tone: "ink" },
        { text: "  fleet | grind | build | loadout | providers | runtime", tone: "ink" },
        { text: "  supervisor    start / workers / restart / stop", tone: "ink" },
        { text: "  clear         empty this buffer", tone: "ink" },
      ]);
      return;
    }
    if (cmd === "status") {
      const armed = Object.values(enabled).filter(Boolean).length;
      pushLines([
        { text: "  fleet        nominal · 8/8 responding", tone: "ok" },
        { text: "  latency      23ms median · relay-03 degraded 88ms", tone: "warn" },
        { text: `  add-ons      ${armed}/${addons.length} armed`, tone: "ink" },
        { text: "  incidents    0 open · 14d 06h uptime", tone: "ok" },
      ]);
      return;
    }
    if (cmd === "agents") {
      pushLines(agents.map((a) => ({ text: `  ${a.id.padEnd(15)} ${a.name.padEnd(18)} ${a.state.padEnd(8)} ${a.latency}ms`, tone: a.status === "warn" ? "warn" : "ink" })));
      return;
    }
    if (cmd === "enable all" || cmd === "arm all") return bulkAddons(true);
    if (cmd === "disable all" || cmd === "standby all") return bulkAddons(false);
    if (["fleet", "grind", "build", "addons", "loadout", "providers", "runtime", "providers", "brief"].includes(cmd)) {
      const target = (cmd === "loadout" ? "addons" : cmd) as PageId;
      navigate(target);
      pushLines([{ text: `  routing to ${pageMeta[target].title.toLowerCase()}…`, tone: "ink" }]);
      return;
    }
    if (cmd.startsWith("supervisor")) {
      const action = cmd.split(" ")[1] as "start" | "workers" | "restart" | "stop" | undefined;
      if (action && ["start", "workers", "restart", "stop"].includes(action)) {
        supervisor(action);
        pushLines([{ text: `  supervisor ${action} · queued`, tone: "warn" }]);
        return;
      }
      pushLines([{ text: "  usage: supervisor <start|workers|restart|stop>", tone: "mute" }]);
      return;
    }
    pushLines([{ text: `  command not found: ${raw.split(" ")[0]} · try help`, tone: "warn" }]);
  };

  const copyText = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(title, "Ready to paste into your model", "info");
    } catch {
      notify("Clipboard unavailable", "Open the upgrade brief to copy manually", "warn");
    }
  };

  const navActions: PaletteAction[] = navGroups.flatMap((g) =>
    g.items.map((i) => ({
      id: `nav-${i.id}`,
      label: i.label,
      hint: `${g.label} · ${pageMeta[i.id].sub}`,
      icon: i.icon as PaletteAction["icon"],
      group: "Navigate",
      run: () => navigate(i.id),
    })),
  );

  const actions: PaletteAction[] = [
    { id: "act-enable", label: "Enable all add-ons", hint: "Arm every module on Mt. Fuji", icon: "zap", group: "Actions", run: () => bulkAddons(true) },
    { id: "act-standby", label: "Move add-ons to standby", hint: "Disarm every module", icon: "pause", group: "Actions", run: () => bulkAddons(false) },
    { id: "act-job", label: "Queue a grind job", hint: "Open the deterministic collection planner", icon: "activity", group: "Actions", run: () => navigate("grind") },
    { id: "act-build", label: "Upload a schematic", hint: "Open the blueprint builder", icon: "box", group: "Actions", run: () => navigate("build") },
    { id: "act-runtime", label: "Runtime & cluster architecture", hint: "Targets, engine, safeguards", icon: "server", group: "Actions", run: () => navigate("runtime") },
    { id: "act-terminal", label: "Open terminal", hint: "Attach to the supervisor shell", icon: "terminal", group: "Actions", run: () => setTerminalOpen(true) },
    { id: "act-restart", label: "Restart ENI", hint: "Keeps worker sessions · jobs preserved", icon: "refresh", group: "Supervisor", run: () => supervisor("restart") },
    { id: "act-workers", label: "Start workers", hint: "Attach the four cluster workers", icon: "play", group: "Supervisor", run: () => supervisor("workers") },
    { id: "act-sync", label: "Refresh fleet telemetry", hint: "Re-ping all eight agents", icon: "refresh", group: "Actions", run: () => notify("Fleet synced", "8 agents · 3 shards · 23ms median") },
    { id: "act-sound", label: sound ? "Mute interface sound" : "Enable interface sound", hint: "Synthesized pentatonic chimes", icon: "spark", group: "Actions", run: () => setSound((s) => !s) },
    { id: "act-art", label: "Open the 4K key visual", hint: "Mt. Fuji · Sakura Valkyrie", icon: "external", group: "Actions", run: () => setLightbox(true) },
    { id: "act-gemini", label: "Copy the Gemini redesign prompt", hint: "Art direction + subagent orchestration", icon: "spark", group: "Brief", run: () => { void copyText(geminiPrompt, "Gemini prompt copied"); } },
    { id: "act-deepseek", label: "Copy the DeepSeek implementation prompt", hint: "Tokens, architecture, and quality gates", icon: "copy", group: "Brief", run: () => { void copyText(deepseekPrompt, "DeepSeek prompt copied"); } },
    ...agents.slice(0, 4).map((a, i) => ({
      id: `agent-${i}`,
      label: `${a.name} · ${a.role}`,
      hint: `${a.id} · ${a.region} · ${a.latency}ms · ${a.state}`,
      icon: "bot" as const,
      group: "Agents",
      run: () => {
        notify("Agent selected", `${a.name} · ${a.role} · ${a.load}% load`, "info");
        navigate("profiles");
      },
    })),
  ];

  return (
    <div className="relative min-h-screen">
      <Petals />
      <Sidebar
        page={page}
        onNavigate={navigate}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        addonCount={Object.values(enabled).filter(Boolean).length}
        onControl={supervisor}
      />
      <div className="lg:pl-[236px]">
        <TopBar
          page={page}
          onMenu={() => setMobileOpen(true)}
          onPalette={() => setPaletteOpen(true)}
          onTerminal={() => setTerminalOpen(true)}
          onNotify={() => notify("Relay jitter on shard 03", "88ms · auto-retry queued · not blocking", "warn")}
          ambience={ambience}
          onAmbience={() => {
            setAmbience((a) => !a);
            notify(ambience ? "Ambience softened" : "Artwork ambience raised", "Applied to the fleet hero", "info");
          }}
          sound={sound}
          onSound={() => {
            setSound((s) => !s);
            if (!sound) window.setTimeout(() => chime("ok"), 80);
            notify(sound ? "Interface sound muted" : "Interface sound enabled", sound ? "Silent mode" : "Subtle pentatonic chimes", "info");
          }}
          onRefresh={async () => {
            const st = await pollSystemState();
            setSystemStatus(st);
            notify("Dashboard refreshed", st.isLive ? "Live telemetry synced (:8092)" : "Offline preview active", st.isLive ? "ok" : "info");
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
          isLive={systemStatus.isLive}
        />
        <main key={page} className="anim-fade-in relative z-10">
          {page === "fleet" && <Fleet onNavigate={navigate} onTerminal={() => setTerminalOpen(true)} notify={notify} ambience={ambience} onArtwork={() => setLightbox(true)} />}
          {page === "grind" && <Grind notify={notify} />}
          {page === "build" && <Schematic notify={notify} />}
          {page === "addons" && (
            <AddOns
              enabled={enabled}
              onToggle={toggleAddon}
              onBulk={bulkAddons}
              onDispatch={dispatch}
              notify={notify}
              onTerminal={() => setTerminalOpen(true)}
              onArtwork={() => setLightbox(true)}
            />
          )}
          {page === "providers" && <Providers notify={notify} />}
          {page === "profiles" && <Profiles notify={notify} onNavigate={navigate} />}
          {page === "runtime" && <Runtime notify={notify} />}
          {page === "log" && <Log dispatched={dispatched} onTerminal={() => setTerminalOpen(true)} notify={notify} />}
          {page === "brief" && <Brief notify={notify} />}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={[...actions, ...navActions]} />
      <TerminalDock open={terminalOpen} onClose={() => setTerminalOpen(false)} lines={termLines} onCommand={runCommand} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <Lightbox open={lightbox} onClose={() => setLightbox(false)} />
    </div>
  );
}
