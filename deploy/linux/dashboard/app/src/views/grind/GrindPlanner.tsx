import { useEffect, useMemo, useRef, useState } from "react";
import { blockImage } from "../../assets/blocks";
import { grindTargets } from "../../data/fixtures";
import { actions, useDashboard } from "../../state/store";
import { clamp } from "../../utils/format";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/icons";
import { Panel } from "../../ui/Panel";
import { AgentOfflineNotice, PendingInline } from "../shared";

const CATEGORIES = ["All", "Mining", "Farming"] as const;

export function GrindPlanner() {
  const pending = useDashboard((state) => state.pendingByAction["grind:queue"]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [target, setTarget] = useState("ancient_debris");
  const [count, setCount] = useState(32);
  const [rawCount, setRawCount] = useState("32");
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const resources = useMemo(
    () => (category === "All" ? grindTargets : grindTargets.filter((item) => item.category === category)),
    [category],
  );

  const safeCount = clamp(count, 1, 128);
  const selected = grindTargets.find((item) => item.id === target);
  const valid = Boolean(selected) && Number.isInteger(safeCount) && safeCount >= 1 && safeCount <= 128;

  const pickCategory = (next: (typeof CATEGORIES)[number]) => {
    setCategory(next);
    const pool = next === "All" ? grindTargets : grindTargets.filter((item) => item.category === next);
    // Keep the selection reachable: the current target can belong to a
    // category the operator just filtered out.
    if (!pool.some((item) => item.id === target)) setTarget(pool[0]?.id ?? target);
  };

  useEffect(() => {
    const grid = gridRef.current;
    const tile = tileRefs.current[target];
    if (!grid || !tile) return;
    const gridRect = grid.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();
    if (tileRect.top < gridRect.top || tileRect.bottom > gridRect.bottom) {
      grid.scrollBy({ top: tileRect.top - gridRect.top - 8, behavior: "smooth" });
    }
  }, [target, category]);

  const stepCount = (delta: number) => {
    const next = clamp(count + delta, 1, 128);
    setCount(next);
    setRawCount(String(next));
  };

  const queue = () => {
    if (!valid) return;
    void actions.queueGrind({ target, count: safeCount });
  };

  return (
    <Panel
      className="planner-panel"
      eyebrow="Collection planner"
      title="Queue a grind"
      sub="Persistent across reconnects. The worker receives the selected block target and count, then uses its own safe search and tool selection."
      tools={
        <div className="row" style={{ gap: 6 }}>
          <Chip tone="accent" size="sm">
            {selected?.label ?? "No target"}
          </Chip>
          <Chip tone="neutral">{resources.length} shown</Chip>
        </div>
      }
    >
      <div>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="field__label" style={{ marginRight: "auto" }}>Resource</span>
          <div className="seg" role="group" aria-label="Resource category">
            {CATEGORIES.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => pickCategory(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="resource-grid" role="group" aria-label="Grind target" ref={gridRef}>
          {resources.map((item) => (
            <button
              key={item.id}
              ref={(node) => {
                tileRefs.current[item.id] = node;
              }}
              type="button"
              className="resource-tile"
              aria-pressed={target === item.id}
              onClick={() => setTarget(item.id)}
            >
              <span className="resource-tile__icon" aria-hidden="true">
                {blockImage(item.id) ? (
                  <img
                    src={blockImage(item.id)}
                    alt=""
                    width={32}
                    height={32}
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <Icon name={item.icon} size={16} />
                )}
              </span>
              <span className="resource-tile__label" title={item.label}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Block count"
        hint="1–128 per job. The supervisor rejects anything outside this range."
      >
        <div className="count-stepper">
          <button type="button" aria-label="Decrease block count" onClick={() => stepCount(-1)}>
            <Icon name="minus" size={13} />
          </button>
          <input
            aria-label="Block count"
            inputMode="numeric"
            value={rawCount}
            onChange={(event) => {
              const digits = event.currentTarget.value.replace(/[^\d]/g, "");
              setRawCount(digits);
              if (digits) {
                const parsed = parseInt(digits, 10);
                if (Number.isFinite(parsed)) setCount(clamp(parsed, 1, 128));
              }
            }}
            onBlur={() => {
              const parsed = parseInt(rawCount, 10);
              const resolved = Number.isFinite(parsed) ? clamp(parsed, 1, 128) : 32;
              setCount(resolved);
              setRawCount(String(resolved));
            }}
          />
          <button type="button" aria-label="Increase block count" onClick={() => stepCount(1)}>
            <Icon name="plus" size={13} />
          </button>
        </div>
      </Field>

      <AgentOfflineNotice action="The job is queued and starts as soon as the worker reconnects." />

      <Button
        variant="primary"
        block
        leading={<Icon name="play" size={13} />}
        onClick={queue}
        disabled={!valid}
        disabledReason="Choose a supported target and a count from 1 to 128."
        loading={pending?.status === "pending"}
        loadingLabel="Queuing job"
      >
        Queue {safeCount} × {selected?.label ?? "resource"}
      </Button>
      <PendingInline entry={pending} onRetry={queue} />
    </Panel>
  );
}
