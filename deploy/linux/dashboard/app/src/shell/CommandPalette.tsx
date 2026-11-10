import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { actions, useDashboard } from "../state/store";
import type { View } from "../data/types";
import { Icon, type IconName } from "../ui/icons";
import { cx } from "../utils/cx";
import { shortcutLabel } from "../utils/platform";

type Command = {
  id: string;
  group: "Navigate" | "Actions" | "Supervisor" | "Interface";
  label: string;
  detail?: string;
  icon: IconName;
  shortcut?: string;
  run: () => void | Promise<void>;
};

const VIEW_COMMANDS: { view: View; label: string; icon: IconName }[] = [
  { view: "fleet", label: "Go to Fleet", icon: "fleet" },
  { view: "grind", label: "Go to Grind", icon: "activity" },
  { view: "build", label: "Go to Build", icon: "layers" },
  { view: "addons", label: "Go to Add-ons", icon: "sliders" },
  { view: "providers", label: "Go to AI providers", icon: "cpu" },
  { view: "settings", label: "Go to Settings", icon: "settings" },
];

function renderShortcut(shortcut: string) {
  // Keep word tokens such as "Ctrl" intact, but split glyph combinations
  // like "⌘⇧T" into individual keycaps.
  const symbols = shortcut.includes(" ") ? shortcut.split(/\s+/) : Array.from(shortcut);
  return (
    <span className="shortcut-group" style={{ display: "inline-flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
      {symbols.map((k, i) => (
        <span key={i} className="kbd">
          {k}
        </span>
      ))}
    </span>
  );
}

export function CommandPalette() {
  const theme = useDashboard((snapshot) => snapshot.theme);
  const sound = useDashboard((snapshot) => snapshot.sound);
  const paletteOpen = useDashboard((snapshot) => snapshot.paletteOpen);
  const offlinePreview = useDashboard((snapshot) => snapshot.offlinePreview);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);

  const close = () => actions.setPaletteOpen(false);

  const restartService = useCallback(async (name: string, action: "start" | "stop" | "restart") => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Service supervisor",
      title: `${action[0].toUpperCase()}${action.slice(1)} ${name}?`,
      description:
        action === "stop"
          ? `Stopping ${name} takes it out of the cluster until an operator starts it again.`
          : `The supervisor will ${action} ${name}. In-flight work is persisted by the agent.`,
      confirmLabel: `${action} ${name}`,
      danger: action !== "start",
    });
    if (confirmed) void actions.serviceAction(name, action);
  }, []);

  const commands = useMemo<Command[]>(() => [
    ...VIEW_COMMANDS.map((item) => ({
      id: `view-${item.view}`,
      group: "Navigate" as const,
      label: item.label,
      detail: `Panel ${String(["fleet", "grind", "build", "addons", "providers", "settings"].indexOf(item.view) + 1).padStart(2, "0")}`,
      icon: item.icon,
      run: () => actions.setView(item.view),
    })),
    {
      id: "refresh",
      group: "Actions",
      label: "Refresh all telemetry",
      detail: "Run the batched poll now",
      icon: "refresh",
      shortcut: "R",
      run: () => actions.refresh(),
    },
    {
      id: "terminal",
      group: "Actions",
      label: "Open terminal dock",
      detail: "Logs and direct bot commands",
      icon: "terminal",
      shortcut: shortcutLabel("J"),
      run: () => actions.setTerminalOpen(true),
    },
    {
      id: "restart-foreman",
      group: "Supervisor",
      label: "Restart mc-foreman",
      detail: "Guarded · ENI1 reconnects automatically",
      icon: "power",
      run: () => restartService("mc-foreman", "restart"),
    },
    {
      id: "restart-cluster",
      group: "Supervisor",
      label: "Restart mc-cluster",
      detail: "Guarded · worker cluster restarts",
      icon: "server",
      run: () => restartService("mc-cluster", "restart"),
    },
    {
      id: "theme",
      group: "Interface",
      label: theme === "yozakura" ? "Switch to Hanami daylight" : "Switch to Yozakura night",
      detail: "Theme follows the saved operator preference",
      icon: theme === "yozakura" ? "sun" : "moon",
      shortcut: "T",
      run: () => actions.toggleTheme(),
    },
    {
      id: "sound",
      group: "Interface",
      label: sound ? "Mute interface chimes" : "Enable interface chimes",
      detail: "Opt-in Web Audio pentatonic tones",
      icon: sound ? "volume-x" : "volume",
      run: () => actions.toggleSound(),
    },
    {
      id: "legacy",
      group: "Interface",
      label: "Open legacy interface",
      detail: "Rollback shell at /?tab=legacy",
      icon: "external",
      run: () => {
        window.location.href = "/?tab=legacy";
      },
    },
  ], [restartService, sound, theme]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.detail ?? ""} ${command.group}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!paletteOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActive(0);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = paletteRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === inputRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [paletteOpen]);

  useEffect(() => {
    setActive((value) => (filtered.length === 0 ? 0 : Math.min(value, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const [listFade, setListFade] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      setListFade(
        list.scrollHeight - list.clientHeight > 2 &&
          list.scrollHeight - list.scrollTop - list.clientHeight > 8,
      );
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    return () => list.removeEventListener("scroll", update);
  }, [filtered.length, paletteOpen]);

  if (!paletteOpen) return null;

  const runAt = (index: number) => {
    const command = filtered[index];
    if (!command) return;
    close();
    void command.run();
  };

  const groups = ["Navigate", "Actions", "Supervisor", "Interface"] as const;

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" ref={paletteRef}>
        <div className="palette__search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            autoFocus
            className="palette__input"
            placeholder="Search views, actions, services…"
            aria-label="Search commands"
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={filtered[active] ? `palette-${filtered[active].id}` : undefined}
            aria-autocomplete="list"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (filtered.length === 0) return;
                setActive((value) => Math.min(filtered.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                if (filtered.length === 0) return;
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runAt(active);
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="palette__list-wrap" data-fade={listFade || undefined}>
          <div className="palette__list" id="palette-list" role="listbox" ref={listRef}>
          {filtered.length === 0 && <div className="palette__empty">No command matches “{query}”.</div>}
          {groups.map((group) => {
            const items = filtered.filter((command) => command.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="palette__group">{group}</div>
                {items.map((command) => {
                  const index = filtered.indexOf(command);
                  return (
                    <button
                      key={command.id}
                      type="button"
                      id={`palette-${command.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === active}
                      data-active={index === active || undefined}
                      className={cx("palette__item")}
                      onMouseMove={() => setActive(index)}
                      onClick={() => runAt(index)}
                    >
                      <Icon name={command.icon} size={15} />
                      <span>{command.label}</span>
                      {command.detail && (
                        <span className="palette__hint" style={{ marginLeft: "auto", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {command.detail}
                        </span>
                      )}
                      {command.shortcut && renderShortcut(command.shortcut)}
                    </button>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
        <div className="palette__foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> run
          </span>
          <span>
            <span className="kbd">ESC</span> close
          </span>
          <span className="palette__foot-meta" style={{ marginLeft: "auto" }}>
            {filtered.length} {filtered.length === 1 ? "action" : "actions"} · {offlinePreview ? "Offline" : "Live"}
          </span>
        </div>
      </div>
    </div>
  );
}
