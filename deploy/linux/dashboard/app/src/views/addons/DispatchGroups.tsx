import { actions, useDashboard } from "../../state/store";
import { Chip } from "../../ui/Chip";
import { Icon, type IconName } from "../../ui/icons";
import { PendingInline } from "../shared";

type Dispatch = { label: string; action: string; command?: string; icon: IconName };

const GROUPS: { name: string; note: string; items: Dispatch[] }[] = [
  {
    name: "Survival",
    note: "Immediate, non-destructive self-care packets.",
    items: [
      { label: "Equip totem", action: "totem", icon: "shield" },
      { label: "Eat gapple", action: "eat", icon: "heart" },
      { label: "Equip armour", action: "armor", icon: "sword" },
    ],
  },
  {
    name: "Recon",
    note: "Movement and collection commands sent to ENI1.",
    items: [
      { label: "Collect drops", action: "loot", icon: "spark" },
      { label: "Return to base", action: "send_command", command: "/home base", icon: "home" },
      { label: "Return to spawn", action: "send_command", command: "/spawn", icon: "map-pin" },
    ],
  },
  {
    name: "Economy",
    note: "Guarded transactions through the server shop GUI.",
    items: [
      { label: "Open shop", action: "shopgui", icon: "coin" },
      { label: "Check balance", action: "bal", icon: "database" },
      { label: "Sell surplus", action: "sell_all", icon: "coin" },
    ],
  },
  {
    name: "Server travel",
    note: "Common Lifesteal navigation commands.",
    items: [
      { label: "Connect to Lifesteal", action: "send_command", command: "/server lifesteal", icon: "radio" },
      { label: "Random TP to wild", action: "send_command", command: "/randomtp", icon: "compass" },
      { label: "Set home", action: "send_command", command: "/sethome", icon: "home" },
      { label: "Return home", action: "send_command", command: "/home", icon: "map-pin" },
    ],
  },
];

export function DispatchGroups() {
  const pending = useDashboard((state) => state.pendingByAction);
  return (
    <section className="dispatch-section" aria-labelledby="dispatch-title">
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h2 id="dispatch-title">Dispatch groups</h2>
          <p className="mute">Single-packet actions. No configuration is written; the bot acknowledges each request.</p>
        </div>
        <Chip tone="neutral">
          {GROUPS.length} groups · {GROUPS.reduce((total, group) => total + group.items.length, 0)} actions
        </Chip>
      </div>
      <div className="dispatch-grid">
        {GROUPS.map((group) => (
          <div className="dispatch-group" key={group.name}>
            <div className="dispatch-group__head">
              <div>
                <div className="dispatch-group__name">{group.name}</div>
                <div className="dispatch-group__note">{group.note}</div>
              </div>
              <Chip tone={group.name === "Economy" ? "warn" : "neutral"}>{group.items.length}</Chip>
            </div>
            <div className="dispatch-group__body">
              {group.items.map((item) => {
                const key = `dispatch:${item.action}${item.command ? `:${item.command}` : ""}`;
                const entry = pending[key];
                const isPending = entry?.status === "pending";
                return (
                  <div key={key}>
                    <button
                      type="button"
                      className="dispatch-btn"
                      disabled={isPending}
                      onClick={() =>
                        void (item.command
                          ? actions.dispatchAddon(item.action, item.label, item.command)
                          : actions.dispatchAddon(item.action, item.label))
                      }
                    >
                      <span className="row" style={{ gap: 7 }}>
                        <Icon name={item.icon} size={12} />
                        {item.label}
                      </span>
                      <code>{item.command ?? item.action}</code>
                    </button>
                    {entry?.status === "error" && <PendingInline entry={entry} compact />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
