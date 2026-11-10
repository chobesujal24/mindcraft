import { useEffect, useMemo, useRef, useState } from "react";
import { actions, useDashboard } from "../../state/store";
import { initials } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Icon } from "../../ui/icons";
import { Panel } from "../../ui/Panel";

function normalisePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isActive(profileFile: string, filename: string, activeProfile: string): boolean {
  if (!activeProfile) return false;
  const active = normalisePath(activeProfile);
  const file = normalisePath(profileFile);
  // Match the full path or a path segment. A plain substring match would let
  // "foreman.json" also select "foreman-alt.json".
  return active === file || active === filename || active.endsWith(`/${filename}`);
}

export function ProfilesPanel() {
  const state = useDashboard();
  const [query, setQuery] = useState("");
  const [atEnd, setAtEnd] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const profiles = state.fleet?.profiles ?? [];
  const activeProfile = state.fleet?.activeProfile ?? "";
  const showSearch = profiles.length > 4;

  const active = profiles.find((profile) => isActive(profile.file, profile.filename, activeProfile)) ?? null;

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles
      .filter((profile) => profile !== active)
      .filter((profile) => {
        if (!needle) return true;
        return `${profile.rawName} ${profile.filename} ${profile.model}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
        return a.rawName.localeCompare(b.rawName);
      });
  }, [profiles, active, query]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 2);
    setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 10);
  }, [candidates.length]);

  const trackScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 10);
  };

  const choose = async (file: string, name: string) => {
    const confirmed = await actions.requestConfirm({
      eyebrow: "Agent profile",
      title: `Restart ENI1 with ${name}?`,
      description:
        "The foreman restarts and reconnects with the selected profile. The current grind queue and schematic state are persisted.",
      confirmLabel: "Switch profile",
      danger: true,
    });
    if (confirmed) void actions.switchProfile(file);
  };

  return (
    <Panel
      eyebrow="Agent identity"
      title="Agent profiles"
      sub="One profile is live at a time. Switching restarts the foreman."
      flush
      tools={<Chip tone={profiles.length ? "neutral" : "warn"}>{profiles.length} total</Chip>}
    >
      {profiles.length === 0 ? (
        <div className="empty">
          <strong>No profiles discovered</strong>
          <p>Profile files are read from the local profiles directory when the cluster responds.</p>
        </div>
      ) : (
        <div className="profile-rail">
          {active && (
            <div className="profile-live">
              <span className="profile-live__monogram" aria-hidden="true">
                {initials(active.rawName)}
              </span>
              <div className="profile-live__body">
                <span className="eyebrow">Live profile</span>
                <strong>{active.rawName}</strong>
                <span className="profile-live__model" title={active.model}>
                  {active.model}
                </span>
              </div>
              <div className="profile-live__state">
                <Chip tone="accent" dot pulse>
                  Live
                </Chip>
                <span className="profile-live__file" title={active.filename}>
                  {active.filename}
                </span>
              </div>
            </div>
          )}

          {showSearch && (
            <div className="profile-search">
              <Icon name="search" size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${profiles.length} profiles…`}
                aria-label="Filter profiles by name, file, or model"
                spellCheck={false}
              />
              {query ? (
                <button type="button" aria-label="Clear profile filter" onClick={() => setQuery("")}>
                  <Icon name="x" size={12} />
                </button>
              ) : (
                <span className="profile-search__count">{candidates.length}</span>
              )}
            </div>
          )}

          <div className="profile-scroll-wrap" data-fade={overflowing && !atEnd ? "true" : undefined}>
            <div
              className="profile-scroll"
              role="list"
              aria-label="Available profiles"
              ref={listRef}
              onScroll={trackScroll}
            >
              {candidates.map((profile) => {
                const pending = state.pendingByAction[`profile:${profile.file}`];
                return (
                  <div className="profile-row" role="listitem" key={profile.file}>
                    <span className="profile-row__monogram" aria-hidden="true">
                      {initials(profile.rawName)}
                    </span>
                    <div className="profile-row__body">
                      <div className="profile-row__name">
                        {profile.rawName}
                        {profile.is_online && (
                          <span className="profile-row__online">
                            <i aria-hidden="true" /> Online
                          </span>
                        )}
                      </div>
                      <div className="profile-row__meta">
                        <span className="profile-row__file">{profile.filename}</span>
                        <span className="profile-row__sep" aria-hidden="true">
                          /
                        </span>
                        <span className="profile-row__model" title={profile.model}>
                          {profile.model}
                        </span>
                        {profile.hide_commands_in_chat && (
                          <span className="profile-row__quiet" title="Commands hidden in chat">
                            <Icon name="volume-x" size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="profile-row__action">
                      <Button
                        size="sm"
                        variant="secondary"
                        leading={<Icon name="play" size={11} />}
                        loading={pending?.status === "pending"}
                        loadingLabel="Switching"
                        onClick={() => void choose(profile.file, profile.rawName)}
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                );
              })}

              {candidates.length === 0 && (
                <div className="profile-empty">
                  <Icon name="search" size={16} />
                  <strong>{query ? "No matching profiles" : "This is the only profile"}</strong>
                  <span>{query ? "Try a different name or model." : "Add another profile file to the directory to switch."}</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-rail__foot">
            <span>
              {candidates.length} available · {profiles.length} total
            </span>
            <span>Switch restarts ENI1</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
