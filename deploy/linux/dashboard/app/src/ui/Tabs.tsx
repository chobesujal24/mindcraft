import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { cx } from "../utils/cx";

export type TabItem = {
  id: string;
  label: string;
  icon?: IconName;
  hint?: string;
};

type TabsProps = {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  syncHash?: boolean;
  className?: string;
};

export function Tabs({ items, active, onChange, label, syncHash = true, className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const overflow = list.scrollWidth - list.clientWidth;
      const start = list.scrollLeft > 2;
      const end = overflow - list.scrollLeft > 2;
      setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [items.length]);

  useEffect(() => {
    const list = listRef.current;
    const node = refs.current[active];
    if (!list || !node) return;
    const left = node.offsetLeft;
    const right = left + node.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [active]);

  const select = (id: string) => {
    onChange(id);
    if (syncHash) {
      const next = `${window.location.pathname}${window.location.search}#${id}`;
      window.history.replaceState(null, "", next);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let target = index;
    if (event.key === "ArrowRight") target = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = items.length - 1;
    else return;
    event.preventDefault();
    const item = items[target];
    refs.current[item.id]?.focus();
    select(item.id);
  };

  return (
    <div
      ref={listRef}
      className={cx("tablist", className)}
      role="tablist"
      aria-label={label}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      {items.map((item, index) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={selected ? `panel-${item.id}` : undefined}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => select(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.icon && <Icon name={item.icon} size={14} />}
            {item.hint && <span className="tab__num">{item.hint}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
