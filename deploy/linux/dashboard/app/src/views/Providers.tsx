import { useEffect, useMemo, useRef, useState } from "react";
import type { Provider } from "../data/types";
import { actions, useDashboard } from "../state/store";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/icons";
import { Panel } from "../ui/Panel";
import { AddProviderDialog } from "./providers/AddProviderDialog";
import { ProviderKPIs } from "./providers/ProviderKPIs";
import { ProviderRow } from "./providers/ProviderRow";
import { EmptyState, PendingInline, ViewHead } from "./shared";

type FilterTab = "all" | "active" | "bypassed" | "needs-key";

const MAX_PROVIDERS = 20;
const SERVER_SYNC_WINDOW_MS = 30_000;

/** Stable signature of the fields the server persists, used to tell a stale
 * poll apart from the list we just saved. */
function providerFingerprint(list: Provider[]): string {
  return list
    .map((p) =>
      [p.id, p.name, p.baseURL, p.keyName, p.model, p.timeoutMs, p.enabled ? 1 : 0].join("\u0001"),
    )
    .join("\u0002");
}

export function Providers() {
  const state = useDashboard();
  const server = state.providers;
  const savePending = state.pendingByAction["providers:save"];
  const [drafts, setDrafts] = useState<Provider[]>(server ?? []);
  const [dirty, setDirty] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [clearKeys, setClearKeys] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const draftsRef = useRef(drafts);
  const syncGuardRef = useRef<{ fingerprint: string; until: number } | null>(null);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!server) return;
    // After a successful save the poll can still return the previous routing
    // table for a few seconds while the supervisor reloads. Keep the local
    // drafts until the server confirms them (or the guard window expires).
    const guard = syncGuardRef.current;
    if (guard) {
      if (providerFingerprint(server) === guard.fingerprint || Date.now() > guard.until) {
        syncGuardRef.current = null;
      } else {
        return;
      }
    }
    if (dirty) return;
    setDrafts(server);
  }, [server, dirty]);

  const stagedKeyCount = Object.keys(apiKeys).length;
  const hasChanges = dirty || stagedKeyCount > 0 || clearKeys.length > 0;
  const busy = savePending?.status === "pending";
  const enabledCount = drafts.filter((p) => p.enabled).length;
  const bypassedCount = drafts.length - enabledCount;
  const configuredCount = drafts.filter((p) => p.keyConfigured || apiKeys[p.id]).length;
  const missingKeysCount = drafts.filter((p) => !p.keyConfigured && !apiKeys[p.id]).length;
  const atProviderLimit = drafts.length >= MAX_PROVIDERS;
  const isFiltering = activeTab !== "all" || searchQuery.trim().length > 0;

  const patch = (id: string, next: Partial<Provider>) => {
    setDirty(true);
    setDrafts((current) => current.map((p) => (p.id === id ? { ...p, ...next } : p)));
  };

  const move = (id: string, direction: -1 | 1) => {
    if (isFiltering) return;
    setDrafts((current) => {
      const index = current.findIndex((p) => p.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const remove = (id: string) => {
    setDrafts((current) => current.filter((p) => p.id !== id));
    setApiKeys((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setClearKeys((current) => current.filter((key) => key !== id));
    setDirty(true);
  };

  const stageKey = (id: string, value: string) => {
    setApiKeys((current) => {
      const next = { ...current };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
    setClearKeys((current) => current.filter((key) => key !== id));
  };

  const markClear = (id: string) => {
    const willClear = !clearKeys.includes(id);
    setClearKeys((current) => (current.includes(id) ? current.filter((key) => key !== id) : [...current, id]));
    setApiKeys((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    // Undoing a pending clear restores the key state reported by the server
    // instead of leaving the row stuck on "Key missing".
    const serverProvider = server?.find((provider) => provider.id === id);
    patch(id, { keyConfigured: willClear ? false : Boolean(serverProvider?.keyConfigured) });
  };

  const reorder = (from: string, to: string) => {
    if (from === to || isFiltering) return;
    setDrafts((current) => {
      const fromIndex = current.findIndex((p) => p.id === from);
      const toIndex = current.findIndex((p) => p.id === to);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDirty(true);
  };

  const add = (provider: Provider, key: string) => {
    if (draftsRef.current.length >= MAX_PROVIDERS) {
      actions.notify(
        "Provider limit reached",
        `The server accepts at most ${MAX_PROVIDERS} routes. Remove one before adding another.`,
        "warn",
      );
      return;
    }
    setDrafts((current) => [...current, provider]);
    if (key) setApiKeys((current) => ({ ...current, [provider.id]: key }));
    setDirty(true);
    actions.notify("Provider Staged", `${provider.name} added to routing table. Click Save & restart to apply.`, "ok");
  };

  const reset = () => {
    syncGuardRef.current = null;
    setDrafts(server ?? []);
    setApiKeys({});
    setClearKeys([]);
    setDirty(false);
  };

  const save = async () => {
    if (!hasChanges || busy) return;
    const confirmed = await actions.requestConfirm({
      eyebrow: "Provider routing",
      title: "Save routing table and restart providers?",
      description:
        "The provider priority order, enabled routes, and staged API keys will be saved to the protected server keystore. The supervisor reloads with the new fallback chain.",
      confirmLabel: "Save & restart",
      danger: true,
    });
    if (!confirmed) return;

    const keysSnapshot = { ...apiKeys };
    const clearSnapshot = [...clearKeys];
    const submitted = drafts.map((provider) => ({ ...provider }));
    const submittedFingerprint = providerFingerprint(submitted);

    // Ensure keys and clear flags are mapped to both provider.keyName and provider.id
    const keysPayload: Record<string, string> = {};
    for (const [id, value] of Object.entries(keysSnapshot)) {
      const p = drafts.find((x) => x.id === id);
      if (p && p.keyName) {
        keysPayload[p.keyName] = value;
      }
      keysPayload[id] = value;
    }

    const clearPayload: string[] = [];
    for (const id of clearSnapshot) {
      const p = drafts.find((x) => x.id === id);
      if (p && p.keyName) {
        clearPayload.push(p.keyName);
      }
      clearPayload.push(id);
    }

    const ok = await actions.saveProviders(submitted, keysPayload, clearPayload);
    if (!ok) return;
    syncGuardRef.current = { fingerprint: submittedFingerprint, until: Date.now() + SERVER_SYNC_WINDOW_MS };
    // Only clear staged values that were part of this save. Anything the
    // operator staged while the request was in flight stays pending.
    setApiKeys((current) => {
      const next = { ...current };
      for (const [id, value] of Object.entries(keysSnapshot)) {
        if (next[id] === value) delete next[id];
      }
      return next;
    });
    setClearKeys((current) => current.filter((id) => !clearSnapshot.includes(id)));
    // Keep the draft dirty if it changed while the save was in flight.
    setDirty(providerFingerprint(draftsRef.current) !== submittedFingerprint);
  };

  // Filtered providers
  const filteredProviders = useMemo(() => {
    return drafts.filter((p) => {
      // Tab filter
      if (activeTab === "active" && !p.enabled) return false;
      if (activeTab === "bypassed" && p.enabled) return false;
      if (activeTab === "needs-key") {
        const hasK = p.keyConfigured || Boolean(apiKeys[p.id]);
        if (hasK) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const modelMatch = (p.model || "").toLowerCase().includes(q);
        const urlMatch = (p.baseURL || "").toLowerCase().includes(q);
        if (!nameMatch && !modelMatch && !urlMatch) return false;
      }

      return true;
    });
  }, [drafts, activeTab, searchQuery, apiKeys]);

  if (!server) {
    return (
      <>
        <ViewHead
          eyebrow="Operations · routing"
          title="AI providers"
          sub="Priority-ordered routing and automatic failover for agent inference."
        />
        <Panel>
          <EmptyState
            icon="cpu"
            title={state.offlinePreview ? "Provider registry unavailable" : "Connecting to provider registry"}
            action={<Button size="sm" variant="secondary" onClick={actions.refresh}>Retry connection</Button>}
          >
            {state.offlinePreview
              ? "The provider list is unknown while the dashboard is offline. No sample providers are shown."
              : "Connecting to the supervisor provider registry on the server..."}
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <ViewHead
        eyebrow="Operations · routing"
        title="AI providers"
        sub="Priority-ordered routing and automatic failover for agent inference. Review active routes, keys, and fallback order."
        aside={
          <div className="row" style={{ gap: 8 }}>
            <Chip tone={state.offlinePreview ? "warn" : "ok"} dot>
              {state.offlinePreview ? "Offline" : "Registry connected"}
            </Chip>
            <Chip tone={hasChanges ? "warn" : "neutral"} dot={hasChanges}>
              {hasChanges ? "Unsaved Draft" : "Synced"}
            </Chip>
          </div>
        }
      />

      {/* Top 4-KPI Overview Shelf */}
      <ProviderKPIs providers={drafts} stagedKeyIds={Object.keys(apiKeys)} />

      <div className="providers-layout mt-3">
        <Panel
          className="providers-panel"
          eyebrow="Routing order"
          title="Provider fallback chain"
          sub="Routes are evaluated in priority order from P1 down. If a provider errors or times out, the next route is tried."
          tools={
            <div className="row" style={{ gap: 8 }}>
              {hasChanges && (
                <Chip tone="warn" dot>
                  {drafts.length - (server?.length ?? 0) !== 0
                    ? `${drafts.length} routes`
                    : "Order modified"}
                </Chip>
              )}
              {stagedKeyCount > 0 && (
                <Chip tone="accent" dot>
                  {stagedKeyCount} key{stagedKeyCount === 1 ? "" : "s"} staged
                </Chip>
              )}
              <PendingInline entry={savePending} compact />
            </div>
          }
          flush
        >
          {/* Modern Filter & Search Toolbar */}
          <div className="providers-filter-toolbar">
            <div className="providers-filter-tabs">
              <button
                type="button"
                className={`providers-filter-tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All <span className="providers-tab-count">{drafts.length}</span>
              </button>
              <button
                type="button"
                className={`providers-filter-tab ${activeTab === "active" ? "active" : ""}`}
                onClick={() => setActiveTab("active")}
              >
                Active <span className="providers-tab-count">{enabledCount}</span>
              </button>
              <button
                type="button"
                className={`providers-filter-tab ${activeTab === "bypassed" ? "active" : ""}`}
                onClick={() => setActiveTab("bypassed")}
              >
                Bypassed <span className="providers-tab-count">{bypassedCount}</span>
              </button>
              <button
                type="button"
                className={`providers-filter-tab ${activeTab === "needs-key" ? "active" : ""}`}
                onClick={() => setActiveTab("needs-key")}
              >
                Needs Key{" "}
                <span className={`providers-tab-count ${missingKeysCount > 0 ? "warn" : ""}`}>
                  {missingKeysCount}
                </span>
              </button>
            </div>

            <div className="providers-toolbar-actions">
              <div className="providers-search-wrap">
                <Icon name="search" size={13} className="providers-search-icon" />
                <input
                  type="search"
                  className="input providers-search-input"
                  placeholder="Filter by name, model, endpoint…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="providers-search-clear"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              <Button
                size="sm"
                variant="primary"
                leading={<Icon name="plus" size={12} />}
                onClick={() => setAddOpen(true)}
                disabled={busy || atProviderLimit}
                disabledReason={
                  atProviderLimit
                    ? `The server accepts at most ${MAX_PROVIDERS} providers. Remove one first.`
                    : undefined
                }
              >
                Add Provider
              </Button>
            </div>
          </div>

          {/* Provider List */}
          {drafts.length === 0 ? (
            <EmptyState
              icon="cpu"
              title="No inference providers configured"
              action={
                <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                  Add First Provider
                </Button>
              }
            >
              The Foreman bot and worker agents require at least one active LLM endpoint to generate actions.
            </EmptyState>
          ) : filteredProviders.length === 0 ? (
            <div className="providers-empty-search">
              <Icon name="search" size={24} />
              <div className="providers-empty-search__title">No matching providers found</div>
              <div className="mute">
                No providers match the filter &quot;{searchQuery || activeTab}&quot;.
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("all");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="provider-list">
              {filteredProviders.map((provider, index) => {
                const actualIndex = drafts.findIndex((p) => p.id === provider.id);
                return (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    index={actualIndex >= 0 ? actualIndex : index}
                    total={drafts.length}
                    draftKey={apiKeys[provider.id] ?? ""}
                    clearKey={clearKeys.includes(provider.id)}
                    reorderDisabled={isFiltering}
                    dragging={dragging === provider.id}
                    dropTarget={dropTarget === provider.id && dragging !== provider.id}
                    onPatch={(next) => patch(provider.id, next)}
                    onKeyChange={(value) => stageKey(provider.id, value)}
                    onClearKey={() => markClear(provider.id)}
                    onMove={(direction) => move(provider.id, direction)}
                    onRemove={() => remove(provider.id)}
                    onDragStart={() => {
                      if (!isFiltering) setDragging(provider.id);
                    }}
                    onDragOver={() => {
                      if (!isFiltering && dragging && dragging !== provider.id) {
                        setDropTarget(provider.id);
                      }
                    }}
                    onDrop={() => {
                      if (!isFiltering && dragging) reorder(dragging, provider.id);
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Sticky Commit & Restart Bar */}
          <div className={`providers-bar ${hasChanges ? "providers-bar--dirty" : ""}`}>
            <div className="providers-bar__note">
              <Icon name={hasChanges ? "alert" : "check"} size={13} />
              <span>
                {hasChanges ? (
                  <>
                    <strong>Uncommitted changes staged:</strong> Click &quot;Save &amp; Restart&quot; to push
                    updates to the supervisor and hot-reload Foreman.
                  </>
                ) : (
                  <>
                    <strong>Routing table synchronized:</strong> All {drafts.length} provider routes match the active server configuration.
                  </>
                )}
              </span>
            </div>
            <div className="providers-bar__actions">
              <Button size="sm" variant="quiet" onClick={reset} disabled={!hasChanges || busy}>
                Reset
              </Button>
              <Button
                size="sm"
                variant="primary"
                leading={<Icon name="refresh" size={12} />}
                loading={busy}
                loadingLabel="Restarting providers…"
                onClick={() => void save()}
                disabled={!hasChanges}
                disabledReason="No local changes staged."
              >
                Save &amp; Restart
              </Button>
            </div>
          </div>
        </Panel>

        {/* Aside Sidebar */}
        <aside className="providers-aside">
          <Panel eyebrow="Routing" title="Fallback behavior" tight>
            <ol className="providers-rules">
              <li>
                <span className="mono">01</span>
                <span>Provider P1 is tried first. On HTTP 429, 500, or timeout, the next route in the chain is tried.</span>
              </li>
              <li>
                <span className="mono">02</span>
                <span>Disabled routes stay in the table but receive no traffic until re-enabled.</span>
              </li>
              <li>
                <span className="mono">03</span>
                <span>Latency, tokens/sec, and context usage are reported from active bot tasks.</span>
              </li>
              <li>
                <span className="mono">04</span>
                <span>Staged keys are verified in memory and written to the host protected store.</span>
              </li>
            </ol>
          </Panel>

          <Panel eyebrow="Credentials" title="API key storage" tight>
            <div className="providers-guard">
              <Icon name="lock" size={14} />
              <p>
                API keys are stored write-only with restricted permissions (0600) on the Linux server. Stored values
                are never returned over the wire to dashboard clients.
              </p>
            </div>
            <div className="providers-guard__meta">
              <Chip tone={configuredCount === drafts.length ? "ok" : "warn"} dot>
                {configuredCount}/{drafts.length} configured
              </Chip>
              {stagedKeyCount > 0 && <Chip tone="accent">{stagedKeyCount} Staged</Chip>}
              {clearKeys.length > 0 && <Chip tone="danger">{clearKeys.length} Clear Pending</Chip>}
            </div>
          </Panel>
        </aside>
      </div>

      <AddProviderDialog
        open={addOpen}
        existingIDs={drafts.map((p) => p.id)}
        onClose={() => setAddOpen(false)}
        onAdd={add}
      />
    </>
  );
}
