import type { Provider } from "../../data/types";
import { Icon } from "../../ui/icons";
import { milliseconds } from "../../utils/format";

export function ProviderKPIs({
  providers,
  stagedKeyIds,
}: {
  providers: Provider[];
  stagedKeyIds: string[];
}) {
  const total = providers.length;
  const enabled = providers.filter((p) => p.enabled).length;
  const staged = new Set(stagedKeyIds);
  // Count readiness per actual provider so a staged key for a removed route
  // can never push the "ready" tally above the provider total.
  const readyKeys = providers.filter((p) => p.keyConfigured || staged.has(p.id)).length;
  const stagedProviderCount = providers.filter((p) => staged.has(p.id)).length;
  const primary = providers.find((p) => p.enabled);

  // Compute average latency among tested providers
  const testedLatencies = providers
    .map((p) => p.lastLatencyMs)
    .filter((ms): ms is number => typeof ms === "number" && ms > 0);
  const avgLatency =
    testedLatencies.length > 0
      ? Math.round(testedLatencies.reduce((a, b) => a + b, 0) / testedLatencies.length)
      : null;

  return (
    <div className="provider-kpi-grid">
      <div className="provider-kpi-card">
        <div className="provider-kpi-card__head">
          <span className="provider-kpi-card__label">Active routes</span>
          <div className="provider-kpi-card__icon" data-tone="accent">
            <Icon name="network" size={14} />
          </div>
        </div>
        <div className="provider-kpi-card__value">
          {enabled} <span className="provider-kpi-card__total">/ {total} active</span>
        </div>
        <div className="provider-kpi-card__meta">
          <span className="dot dot--pulse" data-tone="ok" />
          <span>{total - enabled > 0 ? `${total - enabled} bypassed` : "All routes enabled"}</span>
        </div>
      </div>

      <div className="provider-kpi-card">
        <div className="provider-kpi-card__head">
          <span className="provider-kpi-card__label">Primary Route</span>
          <div className="provider-kpi-card__icon" data-tone="ok">
            <Icon name="zap" size={14} />
          </div>
        </div>
        <div className="provider-kpi-card__value provider-kpi-card__value--truncate" title={primary?.name}>
          {primary ? primary.name : "None active"}
        </div>
        <div className="provider-kpi-card__meta">
          <span className="mono">{primary?.model || "No model mapped"}</span>
        </div>
      </div>

      <div className="provider-kpi-card">
        <div className="provider-kpi-card__head">
          <span className="provider-kpi-card__label">API keys</span>
          <div className="provider-kpi-card__icon" data-tone={stagedProviderCount > 0 ? "accent" : "ok"}>
            <Icon name="key" size={14} />
          </div>
        </div>
        <div className="provider-kpi-card__value">
          {readyKeys} <span className="provider-kpi-card__total">/ {total} ready</span>
        </div>
        <div className="provider-kpi-card__meta">
          {stagedProviderCount > 0 ? (
            <span style={{ color: "var(--accent)" }}>{stagedProviderCount} key staged to save</span>
          ) : (
            <span>All provider keys synced</span>
          )}
        </div>
      </div>

      <div className="provider-kpi-card">
        <div className="provider-kpi-card__head">
          <span className="provider-kpi-card__label">Provider latency</span>
          <div className="provider-kpi-card__icon" data-tone="ok">
            <Icon name="check-circle" size={14} />
          </div>
        </div>
        <div className="provider-kpi-card__value">
          {avgLatency !== null ? milliseconds(avgLatency) : "—"}
        </div>
        <div className="provider-kpi-card__meta">
          <span>
            {testedLatencies.length > 0
              ? `${testedLatencies.length} of ${total} routes probed`
              : `${total} routes configured · not probed`}
          </span>
        </div>
      </div>
    </div>
  );
}

