const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const clockFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function number(value: unknown, fallback = "—"): string {
  return typeof value === "number" && Number.isFinite(value) ? integer.format(value) : fallback;
}

export function decimalNumber(value: unknown, fallback = "—"): string {
  return typeof value === "number" && Number.isFinite(value) ? decimal.format(value) : fallback;
}

export function compact(value: unknown, fallback = "—"): string {
  return typeof value === "number" && Number.isFinite(value) ? compactNumber.format(value) : fallback;
}

export function percent(value: unknown, max: unknown, fallback = "—"): string {
  if (typeof value !== "number" || typeof max !== "number" || !Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return fallback;
  }
  return `${Math.round((value / max) * 100)}%`;
}

export function ratio(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value > 1 ? value / 20 : value / 20));
}

export function healthRatio(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / 20));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function duration(totalSeconds: number | null | undefined): string {
  if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const seconds = Math.floor(totalSeconds);
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function uptime(value: number | string | null | undefined): string {
  if (typeof value === "string" && value.trim()) return value;
  return duration(typeof value === "number" ? value : null);
}

export function relative(timestamp: number | null | undefined): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function eta(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ${String(Math.ceil(seconds % 60)).padStart(2, "0")}s`;
  return `${Math.floor(seconds / 3_600)}h ${String(Math.floor((seconds % 3_600) / 60)).padStart(2, "0")}m`;
}

export function clock(timestamp: number | null | undefined = Date.now()): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return "--:--:--";
  return clockFormat.format(new Date(timestamp));
}

export function bytes(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${decimal.format(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${decimal.format(value / (1024 * 1024))} MB`;
  return `${decimal.format(value / (1024 * 1024 * 1024))} GB`;
}

export function milliseconds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value >= 1_000 ? `${decimal.format(value / 1_000)} s` : `${Math.round(value)} ms`;
}

export function memory(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return bytes(value);
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\w\s-]/g, "")
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "EN";
  return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
