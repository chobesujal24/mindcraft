import type { Service } from "../data/types";

/**
 * Fleet health is scoped to the four supervisor services that keep the
 * cluster running. Optional extras (for example a local minecraft-server)
 * stay visible in the table but must not drag the health percentage down.
 */
export const CORE_SERVICE_NAMES = ["mc-dashboard", "mc-foreman", "mc-cluster", "mc-shim"] as const;

export function isCoreService(name: string): boolean {
  return (CORE_SERVICE_NAMES as readonly string[]).includes(name);
}

export type ServiceHealth = {
  core: Service[];
  optional: Service[];
  active: number;
  total: number;
  percent: number | null;
};

export function serviceHealth(services: Service[]): ServiceHealth {
  const core = services.filter((service) => isCoreService(service.name));
  const scoped = core.length > 0 ? core : services;
  const optional = core.length > 0 ? services.filter((service) => !isCoreService(service.name)) : [];
  const active = scoped.filter((service) => service.state === "active").length;
  return {
    core: scoped,
    optional,
    active,
    total: scoped.length,
    percent: scoped.length > 0 ? Math.round((active / scoped.length) * 100) : null,
  };
}
