import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { photos } from "../images";
import { Icon, type IconName } from "./icons";

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */
export function Panel({
  children,
  className,
  flat,
  style,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  style?: React.CSSProperties;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag style={style} className={cn(flat ? "panel-flat" : "panel", className)}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}

export function PanelHead({
  eyebrow,
  title,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-[15px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
          {meta}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */
type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "sage";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-blush text-[#231318] border border-blush/60 shadow-[0_1px_0_rgba(255,255,255,.35)_inset,0_10px_24px_-16px_rgba(240,174,192,.9)] hover:bg-blush-hi hover:border-blush-hi",
  secondary:
    "bg-white/[0.035] text-ink border border-white/[0.09] hover:bg-white/[0.07] hover:border-white/[0.16]",
  ghost:
    "bg-transparent text-ink-dim border border-transparent hover:text-ink hover:bg-white/[0.045] hover:border-white/[0.07]",
  quiet:
    "bg-white/[0.02] text-ink-dim border border-white/[0.06] hover:text-ink hover:bg-white/[0.05]",
  sage:
    "bg-sage/[0.13] text-sage border border-sage/25 hover:bg-sage/[0.2] hover:border-sage/35",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  className,
  active,
  ...rest
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  active?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-[9px] font-medium whitespace-nowrap transition-all duration-200 ease-[cubic-bezier(.16,1,.3,1)] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-8 px-2.5 text-[12px]",
        size === "md" && "h-9 px-3.5 text-[12.5px]",
        size === "lg" && "h-11 px-5 text-[13.5px]",
        buttonStyles[variant],
        active && "!border-blush/30 !bg-blush/[0.12] !text-blush-hi",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 13 : 15} />}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className,
  size = 16,
  ...rest
}: {
  icon: IconName;
  label: string;
  size?: number;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent text-ink-mute transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.045] hover:text-ink",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chips / status                                                      */
/* ------------------------------------------------------------------ */
export type ChipTone = "ok" | "warn" | "idle" | "down" | "blush" | "neutral";

const chipTone: Record<ChipTone, string> = {
  ok: "text-sage border-sage/20 bg-sage/[0.07]",
  warn: "text-amber border-amber/20 bg-amber/[0.07]",
  idle: "text-ink-dim border-white/[0.08] bg-white/[0.03]",
  down: "text-rose border-rose/25 bg-rose/[0.08]",
  blush: "text-blush-hi border-blush/25 bg-blush/[0.09]",
  neutral: "text-ink-dim border-white/[0.07] bg-white/[0.02]",
};

export function Chip({
  children,
  tone = "neutral",
  dot,
  className,
  mono = true,
}: {
  children: ReactNode;
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-[10.5px] leading-none whitespace-nowrap",
        mono && "font-mono uppercase tracking-[0.1em]",
        chipTone[tone],
        className,
      )}
    >
      {dot && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" /></span>}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "ok", size = 6 }: { tone?: ChipTone; size?: number }) {
  const color =
    tone === "ok" ? "bg-sage" : tone === "warn" ? "bg-amber" : tone === "down" ? "bg-rose" : tone === "blush" ? "bg-blush" : "bg-ink-mute";
  return <span className={cn("shrink-0 rounded-full", color)} style={{ width: size, height: size }} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-250 disabled:opacity-40",
        checked ? "border-blush/50 bg-blush/85" : "border-white/[0.1] bg-white/[0.055] hover:bg-white/[0.09]",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full transition-all duration-250 ease-[cubic-bezier(.16,1,.3,1)]",
          checked ? "left-[18px] bg-[#231318]" : "left-[3px] bg-ink-dim",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Data viz                                                            */
/* ------------------------------------------------------------------ */
export function Sparkline({
  data,
  color = "#F0AEC0",
  width = 150,
  height = 40,
  area = true,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  area?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fill = `${line} L${width - pad},${height} L${pad},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={fill} fill={`url(#sg-${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="spark-path" />
    </svg>
  );
}

export function Meter({
  value,
  max = 100,
  tone = "blush",
  className,
}: {
  value: number;
  max?: number;
  tone?: "blush" | "sage" | "amber" | "dim";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    tone === "sage" ? "bg-sage" : tone === "amber" ? "bg-amber" : tone === "dim" ? "bg-ink-dim" : "bg-blush";
  return (
    <div className={cn("h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 2,
  color = "#F0AEC0",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {label && <span className="absolute font-mono text-[9px] tracking-tight text-ink-dim">{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented filter                                                    */
/* ------------------------------------------------------------------ */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("hide-scrollbar flex items-center gap-1 overflow-x-auto rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-1", className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12px] transition-all duration-200",
              active ? "bg-white/[0.08] text-ink shadow-[0_1px_0_rgba(255,255,255,.06)_inset]" : "text-ink-mute hover:text-ink-dim",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("font-mono text-[9.5px]", active ? "text-blush" : "text-ink-mute/70")}>{String(o.count).padStart(2, "0")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */
/** @deprecated use AvatarPhoto from components/Photo for real photography */
export function Avatar({ size = 36, className, ring }: { size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-[10px] bg-raise",
        ring && "ring-1 ring-blush/25 ring-offset-2 ring-offset-void",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img src={photos.blossom} alt="Mt. Fuji, primary agent" className="h-full w-full object-cover saturate-[0.85]" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Key hint                                                            */
/* ------------------------------------------------------------------ */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-white/[0.1] bg-white/[0.04] px-1 font-mono text-[9.5px] text-ink-mute">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-white/[0.055]", className)} />;
}
