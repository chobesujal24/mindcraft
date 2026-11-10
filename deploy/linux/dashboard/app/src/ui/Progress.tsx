import { cx } from "../utils/cx";

type Tone = "accent" | "ok" | "warn" | "danger";

type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
  tone?: Tone;
  indeterminate?: boolean;
  className?: string;
  showMeta?: boolean;
  detail?: string;
};

export function Progress({
  value,
  max = 100,
  label,
  tone = "accent",
  indeterminate,
  className,
  showMeta = false,
  detail,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const safe = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const pct = Math.round((safe / safeMax) * 100);
  return (
    <div className={cx(className)}>
      <div
        className="progress"
        data-tone={tone === "accent" ? undefined : tone}
        data-indeterminate={indeterminate || undefined}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={indeterminate ? undefined : safe}
        aria-valuetext={indeterminate ? "In progress" : `${pct} percent`}
      >
        <span className="progress__fill" style={{ width: `${pct}%` }} />
      </div>
      {showMeta && (
        <div className="progress__meta">
          <span>{detail ?? label}</span>
          <span>{indeterminate ? "—" : `${pct}%`}</span>
        </div>
      )}
    </div>
  );
}

type RingProps = {
  value: number;
  max?: number;
  size?: number;
  label: string;
  center?: string;
  sub?: string;
  tone?: Tone;
};

export function ProgressRing({ value, max = 100, size = 108, label, center, sub, tone = "accent" }: RingProps) {
  const safeMax = max > 0 ? max : 100;
  const safe = Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0;
  const pct = safe / safeMax;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="job-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(pct * 100)} percent`}>
        <circle className="job-ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle
          className="job-ring__bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={tone === "accent" ? undefined : { stroke: `var(--${tone})` }}
        />
      </svg>
      <div className="job-ring__label">
        <span className="job-ring__value">{center ?? `${Math.round(pct * 100)}%`}</span>
        {sub && <span className="job-ring__sub">{sub}</span>}
      </div>
    </div>
  );
}
