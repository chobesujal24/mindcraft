import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../data/api";
import { actions, useDashboard } from "../state/store";
import { clock } from "../utils/format";
import { IconButton } from "../ui/Button";
import { Icon } from "../ui/icons";
import type { TerminalLine } from "../data/types";

let lineId = 1;

function makeLine(text: string, tone: TerminalLine["tone"] = "default", isLog = false): TerminalLine {
  return { id: lineId++, text, tone, time: clock(), isLog };
}

function toneForLog(line: string): TerminalLine["tone"] {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("panic")) return "warn";
  if (lower.includes("ok") || lower.includes("200") || lower.includes("completed")) return "ok";
  return "default";
}

function renderFormattedLine(text: string) {
  if (text.startsWith("❯ ")) {
    return (
      <>
        <span style={{ color: "var(--accent-hi)", fontWeight: 700, marginRight: 6 }}>❯</span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{text.slice(2)}</span>
      </>
    );
  }
  return <span>{text}</span>;
}

export function TerminalDock() {
  const state = useDashboard();
  const [service, setService] = useState("mc-foreman");
  const [crtMode, setCrtMode] = useState(true);
  const [lines, setLines] = useState<TerminalLine[]>([
    makeLine("Waiting for the first supervisor log response…", "muted"),
  ]);
  const [logStatus, setLogStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = useRef(false);
  const serviceRef = useRef(service);
  const logRequestId = useRef(0);
  serviceRef.current = service;

  const isDispatching = state.pendingByAction["terminal:command"]?.status === "pending";

  const append = (next: TerminalLine | TerminalLine[]) => {
    setLines((current) => [...current, ...(Array.isArray(next) ? next : [next])].slice(-220));
  };

  const loadLogs = async (requestedService = service) => {
    if (busy.current || document.hidden) return;
    busy.current = true;
    const requestId = ++logRequestId.current;
    try {
      const result = await api.logs(requestedService, 100);
      if (requestedService !== serviceRef.current || requestId !== logRequestId.current) return;
      setLines((current) => {
        const previousByText = new Map<string, TerminalLine[]>();
        for (const line of current) {
          if (!line.isLog) continue;
          const matches = previousByText.get(line.text) ?? [];
          matches.push(line);
          previousByText.set(line.text, matches);
        }
        const incoming = (result.lines ?? []).map((text) => {
          const existing = previousByText.get(text)?.shift();
          return existing ?? makeLine(text, toneForLog(text), true);
        });
        const userEntries = current.filter(
          (line) => !line.isLog && !line.text.startsWith("  log tail unavailable ·"),
        );
        return [...userEntries, ...incoming].slice(-250);
      });
      setLogStatus("live");
    } catch (error) {
      if (requestedService === serviceRef.current && requestId === logRequestId.current) {
        setLogStatus("error");
        setLines((current) => {
          if (current.some((line) => !line.isLog && line.text.startsWith("  log tail unavailable ·"))) return current;
          return [...current, makeLine(`  log tail unavailable · ${apiErrorMessage(error)}`, "warn")].slice(-250);
        });
      }
    } finally {
      busy.current = false;
      if (requestedService !== serviceRef.current) void loadLogs(serviceRef.current);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setLines([makeLine(`— switched to ${service} log stream —`, "muted")]);
    void loadLogs();
    const timer = window.setInterval(() => {
      void loadLogs();
    }, 4_000);
    // Polling pauses while the tab is hidden; refresh immediately on return
    // instead of waiting for the next four-second tick.
    const onVisibility = () => {
      if (!document.hidden) void loadLogs(service);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 90;
    if (nearBottom) node.scrollTop = node.scrollHeight;
  }, [lines]);

  const execute = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setHistory((current) => [value, ...current].slice(0, 40));
    setHistoryIndex(-1);
    setCommand("");
    append(makeLine(`❯ ${value}`, "accent"));
    const [head, ...rest] = value.split(/\s+/);

    if (value === "/help" || value === "help") {
      append([
        makeLine("Local Console Commands:", "muted"),
        makeLine("  /status              cluster snapshot & active telemetry", "muted"),
        makeLine("  /grind <target> <n>  queue autonomous grind job (1–128)", "muted"),
        makeLine("  /service <name> <start|stop|restart>", "muted"),
        makeLine("  /theme /sound /clear", "muted"),
        makeLine("  /<command>           dispatch raw packet to active bot", "muted"),
      ]);
      return;
    }
    if (value === "/clear" || value === "clear") {
      setLines([makeLine("Console buffer cleared.", "muted")]);
      return;
    }
    if (value === "/status" || value === "status") {
      const active = state.services.filter((item) => item.state === "active").length;
      const bot = state.fleet?.bots[0];
      const botState = state.offlinePreview
        ? "offline snapshot"
        : bot?.state === "active"
          ? "connected"
          : bot?.state === "stale"
            ? "telemetry stale"
            : bot?.state === "warning"
              ? "unavailable"
              : bot
                ? "offline"
                : "not reported";
      append([
        makeLine(`agent · ${bot?.name ?? "ENI1"} · ${botState}`, bot?.state === "active" && !state.offlinePreview ? "ok" : "warn"),
        makeLine(
          state.services.length
            ? `services · ${active}/${state.services.length} active`
            : "services · unavailable",
          state.services.length && active === state.services.length ? "ok" : "warn",
        ),
        makeLine(`grind · ${state.jobs?.current ? `${state.jobs.current.completed}/${state.jobs.current.requested} ${state.jobs.current.target}` : "idle"}`, "muted"),
        makeLine(`build · ${state.build?.current ? `${state.build.current.placed}/${state.build.current.totalBlocks} placed` : "idle"}`, "muted"),
      ]);
      return;
    }
    if (value === "/theme" || value === "theme") {
      actions.toggleTheme();
      append(makeLine(`theme switched → ${state.theme === "yozakura" ? "hanami (day)" : "yozakura (night)"}`, "ok"));
      return;
    }
    if (value === "/sound" || value === "sound") {
      actions.toggleSound();
      append(makeLine(`sound telemetry chimes → ${state.sound ? "disabled" : "enabled"}`, "ok"));
      return;
    }
    if (head === "/grind" || head === "grind") {
      const target = rest[0]?.toLowerCase();
      const count = Number(rest[1]);
      if (!target || !Number.isInteger(count) || count < 1 || count > 128) {
        append(makeLine("usage · /grind <target> <1-128>", "warn"));
        return;
      }
      const ok = await actions.queueGrind({ target, count });
      append(makeLine(ok ? `queued ${count} × ${target}` : `failed to queue ${target}`, ok ? "ok" : "warn"));
      return;
    }
    if (head === "/service" || head === "service") {
      const [name, action] = rest;
      if (!name || !["start", "stop", "restart"].includes(action)) {
        append(makeLine("usage · /service <name> <start|stop|restart>", "warn"));
        return;
      }
      const confirmed = await actions.requestConfirm({
        eyebrow: "Kyoto Supervisor",
        title: `${action} ${name}?`,
        description: "This command is dispatched directly to the systemd supervisor.",
        confirmLabel: `${action} ${name}`,
        danger: action !== "start",
      });
      if (!confirmed) {
        append(makeLine("operation cancelled", "muted"));
        return;
      }
      void actions.serviceAction(name, action as "start" | "stop" | "restart");
      append(makeLine(`supervisor · dispatched ${action} ${name}`, "ok"));
      return;
    }

    const ok = await actions.sendCommand(value.startsWith("/") ? value : `/${value}`);
    append(makeLine(ok ? "packet dispatched · awaiting telemetry acknowledgement" : "dispatch failed · see toast notification", ok ? "ok" : "warn"));
  };

  const quick = ["/status", "/help", "/home base", "/randomtp", "grind stone 32"];

  return (
    <section
      className="terminal"
      aria-label="Terminal dock"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.setTerminalOpen(false);
        }
      }}
    >
      <div className="terminal__head">
        <div
          className="terminal__led"
          data-busy={isDispatching ? "true" : undefined}
          data-state={logStatus}
          title={isDispatching ? "Packet dispatch in progress" : logStatus === "live" ? "Supervisor logs are polling" : logStatus === "error" ? "Supervisor logs are unavailable" : "Connecting to supervisor logs"}
        />
        <span className="terminal__title">
          <Icon name="terminal" size={14} />
          ENI-01 Console
        </span>
        <div
          className="terminal__tabs"
          role="tablist"
          aria-label="Log source"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : (index - 1 + tabs.length) % tabs.length;
            tabs[next]?.focus();
            tabs[next]?.click();
          }}
        >
          {(state.services.length ? state.services : [{ name: "mc-foreman" }]).map((item) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={service === item.name}
              className="terminal__tab"
              onClick={() => {
                setService(item.name);
              }}
            >
              <i aria-hidden="true" />
              {item.name.replace(/^mc-/, "")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="terminal__crt-btn"
          data-active={crtMode ? "true" : undefined}
          aria-pressed={crtMode}
          aria-label="CRT scanline effect"
          onClick={() => setCrtMode((v) => !v)}
          title="Toggle authentic CRT scanlines & phosphor glow"
        >
          <Icon name="sliders" size={11} />
          CRT {crtMode ? "ON" : "OFF"}
        </button>
        <span className="mono mute" style={{ marginLeft: 6, fontSize: 9.5 }} aria-hidden="true">
          {isDispatching ? "DISPATCHING" : logStatus === "live" ? "POLLING" : logStatus === "error" ? "LOGS OFFLINE" : "CONNECTING"}
        </span>
        <IconButton label="Close terminal" onClick={() => actions.setTerminalOpen(false)}>
          <Icon name="x" size={14} />
        </IconButton>
      </div>
      <div
        className={crtMode ? "terminal__body terminal__body--crt" : "terminal__body"}
        ref={bodyRef}
        role="log"
        aria-live="polite"
      >
        {lines.map((line) => (
          <div className="term-line" key={line.id} data-tone={line.tone === "default" ? undefined : line.tone}>
            <span className="term-line__time">
              {line.text.startsWith("❯") ? "[CMD]" : `[${(line.time || clock()).slice(0, 5)}]`}
            </span>
            {renderFormattedLine(line.text)}
          </div>
        ))}
      </div>
      <div className="terminal__quick" aria-label="Quick commands">
        {quick.map((item) => (
          <button key={item} type="button" onClick={() => void execute(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="terminal__input-row">
        <span className="terminal__prompt" aria-hidden="true">
          ❯
        </span>
        <input
          ref={inputRef}
          className="terminal__input"
          value={command}
          aria-label="Terminal command"
          placeholder="Type /help, /status, /grind, or a raw /command for ENI-01"
          onChange={(event) => setCommand(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void execute(command);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              if (history.length === 0) return;
              const next = Math.min(history.length - 1, historyIndex + 1);
              setHistoryIndex(next);
              setCommand(history[next]);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              const next = Math.max(-1, historyIndex - 1);
              setHistoryIndex(next);
              setCommand(next === -1 ? "" : history[next]);
            } else if (event.key === "Escape") {
              actions.setTerminalOpen(false);
            }
          }}
        />
        <span className="kbd" style={{ opacity: 0.75, pointerEvents: "none" }}>↵ EXEC</span>
      </div>
    </section>
  );
}
