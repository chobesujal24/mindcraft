export function hasFreshTelemetry(timestamp: unknown, maxAgeMs = 15_000, now = Date.now()): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  return age >= 0 && age <= maxAgeMs;
}
