import type { ReactNode } from "react";
import { cx } from "../utils/cx";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "accent" | "gold";

type ChipProps = {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

const toneAttr = (tone: Tone) => (tone === "neutral" ? undefined : tone);

export function Chip({ children, tone = "neutral", dot, pulse, size = "md", className, title }: ChipProps) {
  return (
    <span
      className={cx("chip", size !== "md" && `chip--${size}`, className)}
      data-tone={toneAttr(tone)}
      data-dot={dot || undefined}
      title={title}
    >
      {dot && <span className={cx("dot", pulse && "dot--pulse")} data-tone={toneAttr(tone)} aria-hidden="true" />}
      <span className="chip__text">{children}</span>
    </span>
  );
}

export function StatusDot({ tone = "ok", pulse = true }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={cx("dot", pulse && "dot--pulse")}
      data-tone={tone}
      aria-hidden="true"
      style={{ color: `var(--${tone === "neutral" ? "mute" : tone})` }}
    />
  );
}
