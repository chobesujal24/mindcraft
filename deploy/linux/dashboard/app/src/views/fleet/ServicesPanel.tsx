import { actions, useDashboard } from "../../state/store";
import type { Service } from "../../data/types";
import { memory, titleCase, uptime } from "../../utils/format";
import { IconButton } from "../../ui/Button";
import { Chip, type Tone } from "../../ui/Chip";
import { Panel } from "../../ui/Panel";
import { Table, type Column } from "../../ui/Table";
import { PendingInline } from "../shared";
import { Icon } from "../../ui/icons";
import { isCoreService, serviceHealth } from "../../utils/services";

function stateTone(state: string): Tone {
  if (state === "active") return "ok";
  if (state === "activating" || state === "deactivating" || state === "stopping") return "warn";
  if (state === "failed") return "danger";
  return "neutral";
}

export function ServicesPanel() {
  const state = useDashboard();
  const health = serviceHealth(state.services);

  const act = async (name: string, action: "start" | "stop" | "restart") => {
    if (action !== "start") {
      const confirmed = await actions.requestConfirm({
        eyebrow: "Service supervisor",
        title: `${action[0].toUpperCase()}${action.slice(1)} ${name}?`,
        description:
          action === "stop"
            ? `Stopping ${name} removes it from the cluster until an operator starts it again.`
            : `${name} restarts through systemd. In-flight state is persisted by the agent.`,
        confirmLabel: `${action} ${name}`,
        danger: true,
      });
      if (!confirmed) return;
    }
    void actions.serviceAction(name, action);
  };

  const columns: Column<Service>[] = [
    {
      key: "name",
      header: "Service",
      render: (service) => (
        <span className="row" style={{ gap: 7 }}>
          <Icon name="server" size={13} />
          <strong className="nowrap">{service.name}</strong>
          {!isCoreService(service.name) && <Chip tone="neutral" size="sm">Optional</Chip>}
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (service) => (
        <Chip tone={stateTone(service.state)} dot>
          {titleCase(service.state)}
        </Chip>
      ),
    },
    {
      key: "pid",
      header: "PID",
      numeric: true,
      hideBelow: "sm",
      render: (service) => <span className="mono">{service.pid ?? "—"}</span>,
    },
    {
      key: "cpu",
      header: "CPU",
      numeric: true,
      hideBelow: "sm",
      render: (service) => <span className="mono">{service.cpu === null ? "—" : `${service.cpu.toFixed(1)}%`}</span>,
    },
    {
      key: "mem",
      header: "Memory",
      numeric: true,
      hideBelow: "sm",
      render: (service) => <span className="mono">{memory(service.mem)}</span>,
    },
    {
      key: "uptime",
      header: "Uptime",
      numeric: true,
      hideBelow: "sm",
      render: (service) => <span className="mono">{uptime(service.uptime)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (service) => {
        const pending = state.pendingByAction[`service:${service.name}:restart`];
        const start = state.pendingByAction[`service:${service.name}:start`];
        const stop = state.pendingByAction[`service:${service.name}:stop`];
        return (
          <div className="table__actions">
            {service.state !== "active" && (
              <IconButton
                size="sm"
                label={`Start ${service.name}`}
                loading={start?.status === "pending"}
                onClick={() => void act(service.name, "start")}
              >
                <Icon name="play" size={12} />
              </IconButton>
            )}
            <IconButton
              size="sm"
              label={`Restart ${service.name}`}
              loading={pending?.status === "pending"}
              onClick={() => void act(service.name, "restart")}
            >
              <Icon name="refresh" size={12} />
            </IconButton>
            {service.state === "active" && (
              <IconButton
                size="sm"
                tone="danger"
                label={`Stop ${service.name}`}
                loading={stop?.status === "pending"}
                onClick={() => void act(service.name, "stop")}
              >
                <Icon name="stop" size={12} />
              </IconButton>
            )}
            <PendingInline entry={start?.status === "error" ? start : pending?.status === "error" ? pending : stop?.status === "error" ? stop : null} compact />
          </div>
        );
      },
    },
  ];

  return (
    <Panel
      className="services-panel"
      eyebrow="Supervisor"
      title="Cluster services"
      sub="systemd handles start, stop, and restart. Core availability excludes optional services, which are listed for control only."
      tools={<Chip tone={health.total === 0 ? "neutral" : health.active === health.total ? "ok" : "warn"}>
        {health.total ? `${health.active}/${health.total} core active` : "Status unavailable"}
      </Chip>}
      flush
    >
      <Table
        label="Cluster services"
        columns={columns}
        rows={state.services}
        rowKey={(service) => service.name}
        empty="No services reported yet. The supervisor is queried with each batch."
        compact
      />
    </Panel>
  );
}
