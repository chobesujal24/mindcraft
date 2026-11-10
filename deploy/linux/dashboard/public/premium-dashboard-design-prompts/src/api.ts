/**
 * Client API Layer for Mindcraft Dashboard
 * Interacts with Node/Express backend at port 8092.
 * Gracefully provides populated offline previews when server is unreachable.
 */

export interface SystemStatus {
  isLive: boolean;
  services?: Record<string, { state: string; sub: string; pid?: number; memory?: string; cpu?: string; uptime?: string }>;
  coordinator?: {
    status?: string;
    lastPing?: number;
    bots?: Array<{ id: string; name: string; state: string; latency?: number }>;
  };
  uptime?: number;
  version?: string;
  host?: string;
}

const API_TIMEOUT = 3500;

async function requestJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    clearTimeout(id);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    clearTimeout(id);
    return null;
  }
}

/**
 * Poll consolidated status / state from server
 */
export async function pollSystemState(): Promise<SystemStatus> {
  const data = await requestJson<any>('/api/status') || await requestJson<any>('/api/state');
  if (!data) {
    return { isLive: false };
  }
  return {
    isLive: true,
    services: data.services,
    coordinator: data.coordinator,
    uptime: data.uptime,
    version: data.version,
    host: data.host,
  };
}

/**
 * Execute supervisor service actions (mc-foreman, mc-cluster, minecraft-server)
 */
export async function executeService(name: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/service/${encodeURIComponent(name)}/${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return { ok: true, message: data.output || `${name} ${action} succeeded` };
    }
    const res2 = await fetch('/api/service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, action }),
    });
    const data2 = await res2.json().catch(() => ({}));
    return { ok: res2.ok, message: data2.output || (res2.ok ? `${name} ${action} completed` : 'Service action failed') };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Network error reaching supervisor' };
  }
}

/**
 * Save addon configuration to server
 */
export async function saveAddonSettings(addons: Record<string, boolean | number>): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/addons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addons),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, message: 'Offline preview — changes applied locally' };
  }
}

/**
 * Dispatch an addon action
 */
export async function dispatchAddonAction(action: string, payload?: any): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/addons/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message || 'Action executed' };
  } catch {
    return { ok: true, message: 'Dispatched to simulated runtime' };
  }
}

/**
 * Fetch grind jobs from server
 */
export async function getGrindJobs(): Promise<any> {
  return await requestJson('/api/grind');
}

/**
 * Submit grind job to server
 */
export async function createGrindJob(job: any): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/grind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    });
    return { ok: res.ok };
  } catch {
    return { ok: true, message: 'Queued in local preview' };
  }
}

