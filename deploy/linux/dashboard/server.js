/**
 * deploy/linux/dashboard/server.js - control panel for the bot cluster.
 *
 * Lets you start/stop ENI1 and the rest of the stack, edit the Minecraft and
 * Mindcraft settings, and watch the live state - all from a browser.
 *
 * Endpoints:
 *   GET  /                     the dashboard page
 *   GET  /api/state            service states, coordinator status, log tails
 *   POST /api/service          { name, action }  -> systemctl start|stop|restart
 *   GET  /api/config           current settings.js and bots/config.json
 *   POST /api/config           { settings, bots } -> patch the files, restart
 *
 * No external dependencies, it only uses node built-ins.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PORT = Number(process.env.DASHBOARD_PORT || 8092);
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
const TOKEN = process.env.DASHBOARD_TOKEN || '';
const VERSION = process.env.DASHBOARD_VERSION || '0.1.4';
const ROOT = process.env.DASHBOARD_ROOT || 
  (fs.existsSync('/opt/mindcraft') ? '/opt/mindcraft' : path.resolve(__dirname, '../../../'));

const FOREMAN_DIR = path.join(ROOT, 'mindcraft-0.1.4');
const BOTS_DIR = path.join(ROOT, 'bots');
const SETTINGS_FILE = path.join(FOREMAN_DIR, 'settings.js');
const BOTS_CONFIG = path.join(BOTS_DIR, 'config.json');
const ENV_FILE = path.join(ROOT, 'deploy', 'linux', 'mc-cluster.env');
const PROFILES_DIR = path.join(FOREMAN_DIR, 'profiles');
const ADDONS_CONFIG_FILE = path.join(FOREMAN_DIR, 'addons_config.json');
const ADDONS_LIVE_FILE = path.join(FOREMAN_DIR, 'addons_live.json');
const AI_PROVIDERS_FILE = path.join(FOREMAN_DIR, 'ai-providers.json');
const KEYS_FILE = path.join(FOREMAN_DIR, 'keys.json');
const DEFAULT_ADDONS_CONFIG = {
  auto_totem: false,
  auto_gapple: false,
  auto_armor: false,
  cps_booster: false,
  cps_value: 12,
  cps_cooldown_mode: false,
  panic_escape: false,
  player_radar: false,
  auto_loot: false,
  shop_gui: false,
  auto_sell: false
};
const GRIND_TARGETS = new Set([
  'stone', 'cobblestone', 'dirt', 'gravel', 'sand', 'netherrack',
  'coal_ore', 'copper_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore',
  'diamond_ore', 'emerald_ore', 'nether_quartz_ore', 'nether_gold_ore', 'ancient_debris',
  'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
  'mangrove_log', 'cherry_log', 'wheat', 'carrots', 'potatoes', 'beetroots', 'sugar_cane'
]);

function readJsonSafe(file, defaultVal = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (_) {}
  return defaultVal;
}

// A small in-process sample window backs /api/telemetry. It measures this
// dashboard's own request health - it never invents agent inference numbers.
const telemetry = { samples: [], lastSweep: null };
function recordTelemetry(ms, statusCode) {
  const at = Date.now();
  telemetry.samples.push({ ms, ok: statusCode < 400, at });
  if (telemetry.samples.length > 200) telemetry.samples.shift();
  telemetry.lastSweep = at;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] * 10) / 10;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`;
  return `${total}s`;
}

function parseSystemctlShow(text) {
  const values = {};
  for (const line of String(text || '').split('\n')) {
    const split = line.indexOf('=');
    if (split > 0) values[line.slice(0, split)] = line.slice(split + 1).trim();
  }
  return values;
}

async function serviceSummary(name) {
  const active = await serviceState(name);
  const shown = await run('systemctl', [
    'show', name,
    '--property=MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp'
  ]);
  const props = parseSystemctlShow(shown.stdout);
  const pid = Number(props.MainPID);
  const memory = Number(props.MemoryCurrent);
  const cpuNs = Number(props.CPUUsageNSec);
  const entered = Date.parse(props.ActiveEnterTimestamp || '');
  const uptimeSeconds = Number.isFinite(entered) ? Math.max(0, (Date.now() - entered) / 1000) : null;
  const cpu = Number.isFinite(cpuNs) && Number.isFinite(uptimeSeconds) && uptimeSeconds > 1
    ? Math.round((cpuNs / 1e9 / uptimeSeconds) * 1000) / 10
    : null;
  return {
    name,
    state: active.state,
    pid: Number.isInteger(pid) && pid > 0 ? pid : null,
    cpu: Number.isFinite(cpu) ? Math.min(cpu, 999) : null,
    mem: Number.isFinite(memory) && memory >= 0 ? memory : null,
    uptime: formatDuration(uptimeSeconds)
  };
}

async function coordinatorStatus() {
  try {
    const raw = await run('curl', ['-s', '--max-time', '4', 'http://127.0.0.1:8090/status']);
    return JSON.parse(raw.stdout);
  } catch (_) {
    return null;
  }
}

async function liveAgent(agentName) {
  try {
    const live = await requestMindserver(`/api/addons/live?agent=${encodeURIComponent(agentName)}`);
    if (live && !live.agents && typeof live === 'object') return live;
  } catch (_) {}
  const file = agentScopedFile(ADDONS_LIVE_FILE, agentName);
  return readJsonSafe(file, null);
}

async function fleetBots() {
  const agentName = activeAgentName();
  const coordinator = await coordinatorStatus();
  const live = await liveAgent(agentName);
  const foreman = await serviceState('mc-foreman');
  const lastSeen = Number(live?.timestamp) || null;
  const telemetryAge = lastSeen ? Date.now() - lastSeen : Number.POSITIVE_INFINITY;
  const fresh = Boolean(lastSeen && telemetryAge >= 0 && telemetryAge <= 6500);
  const position = live?.position && typeof live.position === 'object' ? live.position : {};
  const x = Number(live?.x ?? position.x);
  const y = Number(live?.y ?? position.y);
  const z = Number(live?.z ?? position.z);
  const status = fresh ? 'active' : foreman.state === 'active' ? 'stale' : 'offline';
  const bots = [{
    id: agentName,
    name: agentName,
    health: Number.isFinite(Number(live?.health)) ? Number(live.health) : null,
    food: Number.isFinite(Number(live?.food)) ? Number(live.food) : null,
    x: Number.isFinite(x) ? x : null,
    y: Number.isFinite(y) ? y : null,
    z: Number.isFinite(z) ? z : null,
    dimension: typeof live?.dimension === 'string' ? live.dimension : null,
    ping: Number.isFinite(Number(live?.ping)) ? Number(live.ping) : null,
    activity: String(live?.activity || live?.task || live?.message || (fresh ? 'Telemetry streaming' : 'Awaiting telemetry')),
    state: status
  }];
  const agents = Array.isArray(coordinator?.agents) ? coordinator.agents : [];
  for (const agent of agents) {
    const name = String(agent?.name || agent?.id || '').trim();
    if (!name || bots.some(bot => bot.name === name)) continue;
    bots.push({
      id: name,
      name,
      health: Number.isFinite(Number(agent?.health)) ? Number(agent.health) : null,
      food: Number.isFinite(Number(agent?.food)) ? Number(agent.food) : null,
      x: Number.isFinite(Number(agent?.x)) ? Number(agent.x) : null,
      y: Number.isFinite(Number(agent?.y)) ? Number(agent.y) : null,
      z: Number.isFinite(Number(agent?.z)) ? Number(agent.z) : null,
      dimension: typeof agent?.dimension === 'string' ? agent.dimension : null,
      ping: Number.isFinite(Number(agent?.ping)) ? Number(agent.ping) : null,
      activity: String(agent?.activity || agent?.status || 'Connected to the coordinator'),
      state: agent?.in_game === false || agent?.connected === false ? 'warning' : 'active'
    });
  }
  let activeProfile = '';
  try {
    const settings = readSettings();
    if (Array.isArray(settings.profiles) && settings.profiles.length) activeProfile = String(settings.profiles[0] || '');
  } catch (_) {}
  return { bots, profiles: readProfiles(), activeProfile: activeProfile || agentName };
}

function cleanBaseURL(raw) {
  let u = String(raw || '').trim().replace(/\/+$/, '');
  u = u.replace(/\/chat\/completions\/?$/i, '').replace(/\/completions\/?$/i, '');
  return u;
}

function probeEndpoint(targetUrl, method, headers, payload, timeoutMs = 8000) {
  const started = Date.now();
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(targetUrl); } catch (e) {
      return resolve({ ok: false, latencyMs: null, statusCode: null, error: 'Invalid URL: ' + targetUrl, raw: '' });
    }
    const transport = parsed.protocol === 'https:' ? https : http;
    const bodyBuffer = payload ? Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
    const reqHeaders = { ...headers };
    if (bodyBuffer) {
      reqHeaders['content-type'] = 'application/json';
      reqHeaders['content-length'] = bodyBuffer.length;
    }
    const req = transport.request(parsed, {
      method,
      timeout: timeoutMs,
      headers: reqHeaders,
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        raw += chunk;
        if (raw.length > 1024 * 1024) res.destroy();
      });
      res.on('error', err => resolve({ ok: false, latencyMs: Date.now() - started, statusCode: null, error: err.message, raw: '' }));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          latencyMs: Date.now() - started,
          statusCode: res.statusCode || null,
          raw,
        });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Connection timed out after 8s')));
    req.on('error', err => resolve({ ok: false, latencyMs: Date.now() - started, statusCode: null, error: err.message, raw: '' }));
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

async function probeProvider(baseURL, apiKey, model) {
  const cleaned = cleanBaseURL(baseURL);
  if (!cleaned) {
    return { ok: false, latencyMs: null, statusCode: null, modelCount: null, error: 'A base URL is required.' };
  }
  const headers = { accept: 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  // 1. Try GET <cleaned>/models
  const modelsRes = await probeEndpoint(`${cleaned}/models`, 'GET', headers, null);
  if (modelsRes.ok) {
    let body = null;
    try { body = JSON.parse(modelsRes.raw); } catch (_) {}
    const count = Array.isArray(body?.data) ? body.data.length
      : Array.isArray(body?.models) ? body.models.length
      : 1;
    return {
      ok: true,
      latencyMs: modelsRes.latencyMs,
      statusCode: modelsRes.statusCode,
      modelCount: count,
      error: undefined,
    };
  }

  // 2. If /models returns 404, 405, or 501, fallback to POST /chat/completions
  if (modelsRes.statusCode === 404 || modelsRes.statusCode === 405 || modelsRes.statusCode === 501 || !modelsRes.statusCode) {
    const chatPayload = {
      model: model || 'internvl3.5-latest',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
    };
    const chatRes = await probeEndpoint(`${cleaned}/chat/completions`, 'POST', headers, chatPayload);
    if (chatRes.ok) {
      return {
        ok: true,
        latencyMs: chatRes.latencyMs,
        statusCode: chatRes.statusCode,
        modelCount: 1,
        error: undefined,
      };
    }
    // If chat returned 400 or 422 with a model error, that means auth succeeded and endpoint is alive!
    if (chatRes.statusCode === 400 || chatRes.statusCode === 422) {
      let errBody = null;
      try { errBody = JSON.parse(chatRes.raw); } catch (_) {}
      const msg = errBody?.error?.message || errBody?.message || '';
      if (msg.toLowerCase().includes('model') || msg.toLowerCase().includes('tokens') || msg.toLowerCase().includes('parameter')) {
        return {
          ok: true,
          latencyMs: chatRes.latencyMs,
          statusCode: chatRes.statusCode,
          modelCount: 1,
          error: undefined,
        };
      }
    }
    if (chatRes.statusCode === 401 || chatRes.statusCode === 403) {
      return {
        ok: false,
        latencyMs: chatRes.latencyMs,
        statusCode: chatRes.statusCode,
        modelCount: null,
        error: 'Authentication failed (Invalid API key)',
      };
    }
    if (chatRes.statusCode) {
      return {
        ok: false,
        latencyMs: chatRes.latencyMs,
        statusCode: chatRes.statusCode,
        modelCount: null,
        error: `Endpoint returned HTTP ${chatRes.statusCode}`,
      };
    }
  }

  // Otherwise return modelsRes error
  if (modelsRes.statusCode === 401 || modelsRes.statusCode === 403) {
    return {
      ok: false,
      latencyMs: modelsRes.latencyMs,
      statusCode: modelsRes.statusCode,
      modelCount: null,
      error: 'Authentication failed (Invalid API key)',
    };
  }

  return {
    ok: false,
    latencyMs: modelsRes.latencyMs,
    statusCode: modelsRes.statusCode,
    modelCount: null,
    error: modelsRes.error || `Provider returned HTTP ${modelsRes.statusCode}`,
  };
}

function activeAgentName() {
  try {
    const settings = readSettings();
    const activeProfile = Array.isArray(settings.profiles) ? settings.profiles[0] : '';
    if (typeof activeProfile === 'string' && activeProfile) {
      const profilePath = path.resolve(FOREMAN_DIR, activeProfile);
      const relative = path.relative(PROFILES_DIR, profilePath);
      if (relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
        const profile = readJsonSafe(profilePath, {});
        if (typeof profile.name === 'string' && profile.name.trim()) return profile.name.trim();
      }
    }
  } catch (_) {}
  return 'ENI1';
}

function agentScopedFile(file, agentName) {
  const parsed = path.parse(file);
  const suffix = String(agentName || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(parsed.dir, `${parsed.name}_${suffix}${parsed.ext}`);
}

function agentActionQueueDir(agentName) {
  const suffix = String(agentName || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(FOREMAN_DIR, `addons_actions_${suffix}`);
}

function readPendingAgentActions(agentName) {
  const dir = agentActionQueueDir(agentName);
  try {
    return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => {
      const file = path.join(dir, name);
      const action = readJsonSafe(file, null);
      return action && typeof action === 'object' ? { file, action } : null;
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function queueAgentAction(agentName, actionData) {
  const dir = agentActionQueueDir(agentName);
  fs.mkdirSync(dir, { recursive: true });
  const pending = fs.readdirSync(dir).filter(name => name.endsWith('.json')).length;
  if (pending >= 32) throw new Error('The agent action queue is full; wait for ENI1 to reconnect.');
  const id = actionData.id || crypto.randomUUID();
  const queuedAt = Date.now();
  const file = path.join(dir, `${queuedAt}-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  writeJsonAtomic(file, { ...actionData, id, queuedAt });
  return { id, queuedAt, file };
}

function removePendingGrindAction(agentName, jobId) {
  const pending = readPendingAgentActions(agentName).find(entry =>
    entry.action.action === 'grind_start' && entry.action.params?.jobId === jobId
  );
  if (!pending) return false;
  try {
    fs.unlinkSync(pending.file);
    return true;
  } catch (_) {
    return false;
  }
}

function requestMindserver(pathname, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    let port = 8091;
    try { port = Number(readSettings().mindserver_port) || port; } catch (_) {}
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
      headers: {
        ...(process.env.MINDSERVER_TOKEN ? { authorization: `Bearer ${process.env.MINDSERVER_TOKEN}` } : {}),
        ...(payload ? {
          'content-type': 'application/json',
          'content-length': payload.length
        } : {})
      }
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        raw += chunk;
        if (raw.length > 4 * 1024 * 1024) response.destroy();
      });
      response.on('error', reject);
      response.on('end', () => {
        let result;
        try { result = JSON.parse(raw); } catch (_) { result = { error: raw || 'invalid MindServer response' }; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(result.error || `MindServer returned HTTP ${response.statusCode}`));
        } else {
          resolve(result);
        }
      });
    });
    req.setTimeout(1500, () => req.destroy(new Error('MindServer request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function writeJsonBackup(file, value, mode) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
    if (mode) fs.chmodSync(`${file}.bak`, mode);
  }
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, mode ? { mode } : undefined);
  fs.renameSync(temp, file);
  if (mode) fs.chmodSync(file, mode);
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function writeFileAtomic(file, content) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isKeyConfigured(keyName, keys) {
  return Boolean(keys?.[keyName] || process.env[keyName]);
}

const SERVICES = ['mc-shim', 'mc-cluster', 'mc-foreman', 'mc-dashboard', 'minecraft-server'];
const PUBLIC_DIR = path.join(__dirname, 'public');

function run(command, args, options = {}) {
  return new Promise(resolve => {
    execFile(command, args, { timeout: 20000, maxBuffer: 4 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err ? err.code || 1 : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

async function serviceState(name) {
  const result = await run('systemctl', ['is-active', name]);
  const state = result.stdout.trim() || 'unknown';
  const enabled = await run('systemctl', ['is-enabled', name]);
  return { state, enabled: enabled.stdout.trim() || 'unknown' };
}

async function logsFor(name, lines = 60) {
  const result = await run('journalctl', ['-u', name, '-b', '--no-pager', '-n', String(lines)]);
  let out = result.stdout.split('\n').filter(line => line && !line.startsWith('-- Boot '));
  if (!out.length) {
    const fallback = await run('journalctl', ['-u', name, '--no-pager', '-n', String(lines)]);
    out = fallback.stdout.split('\n').filter(line => line && !line.startsWith('-- Boot '));
  }
  return out.slice(-lines);
}

/** Read the settings object out of the ES module without executing it. */
function readSettings() {
  const text = fs.readFileSync(SETTINGS_FILE, 'utf8');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const body = text.slice(start, end + 1);
  // Strip comments and trailing commas, then quote the bare keys so the
  // object can be parsed as JSON.
  const cleaned = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(cleaned);
}

function findValueEnd(text, start) {
  const stack = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && (next === '/' || next === '*') && stack.length === 0) return i;
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (stack.length === 0 && (ch === ',' || ch === '}')) return i;
    if (ch === '[' || ch === '{' || ch === '(') stack.push(ch);
    else if (ch === ']' || ch === '}' || ch === ')') stack.pop();
  }
  return text.length;
}

/**
 * Replace the value of a key in settings.js while keeping the comment and the
 * rest of the file intact, properly balancing arrays and objects.
 */
function patchSettings(settings) {
  const original = fs.readFileSync(SETTINGS_FILE, 'utf8');
  let text = original;
  const changes = [];
  for (const [key, value] of Object.entries(settings)) {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(key)) continue;
    const pattern = new RegExp('(^\\s*["\']?' + escapeRegExp(key) + '["\']?\\s*:\\s*)', 'm');
    const match = pattern.exec(text);
    if (!match) {
      // Older settings.js files predate ViaProxy support. Let the dashboard
      // add only this known optional setting instead of silently dropping the
      // first save after upgrading the UI/code.
      if (key === 'via_proxy') {
        const settingsObject = /\b(?:const|let|var)\s+settings\s*=\s*\{/.exec(text);
        if (!settingsObject) throw new Error('Could not locate the settings object in settings.js');
        const objectStart = settingsObject.index + settingsObject[0].lastIndexOf('{') + 1;
        text = `${text.slice(0, objectStart)}\n    "via_proxy": ${JSON.stringify(value)},${text.slice(objectStart)}`;
        changes.push(key + ': added');
        continue;
      }
      changes.push('skipped ' + key + ' (not found)');
      continue;
    }
    const valueStart = match.index + match[0].length;
    let valueEnd = findValueEnd(text, valueStart);
    while (valueEnd > valueStart && /\s/.test(text[valueEnd - 1])) valueEnd--;
    text = text.slice(0, valueStart) + JSON.stringify(value) + text.slice(valueEnd);
    changes.push(key + ': updated');
  }
  writeFileAtomic(SETTINGS_FILE + '.bak', original);
  writeFileAtomic(SETTINGS_FILE, text);
  return changes;
}

function patchBotsConfig(bots) {
  const original = fs.readFileSync(BOTS_CONFIG, 'utf8');
  const current = JSON.parse(original);
  const merged = deepMerge(current, bots);
  writeFileAtomic(BOTS_CONFIG + '.bak', original);
  writeFileAtomic(BOTS_CONFIG, JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = deepMerge(target[key] || {}, value);
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}

function patchEnv(values) {
  let text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_]+$/.test(key)) continue;
    const safeVal = String(value).replace(/[\r\n]/g, '');
    const line = `${key}=${safeVal}`;
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileAtomic(ENV_FILE, text);
}

/** The systemd env file wins over the JSON config, so the UI has to show it. */
function readEnv() {
  const env = {};
  if (!fs.existsSync(ENV_FILE)) return env;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = trimmed.indexOf('=');
    if (split < 1) continue;
    env[trimmed.slice(0, split).trim()] = trimmed.slice(split + 1).trim();
  }
  return env;
}

/** List the top-level agent profiles (profiles/*.json, not subfolders). */
function readProfiles() {
  const out = [];
  if (!fs.existsSync(PROFILES_DIR)) return out;
  for (const name of fs.readdirSync(PROFILES_DIR)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(PROFILES_DIR, name);
    if (!fs.statSync(full).isFile()) continue;
    let parsed = {};
    try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { /* ignore unreadable */ }
    const isOnline = name === 'foreman-online.json' || !!parsed.online_server_mode;
    const displayName = isOnline ? `${parsed.name || 'ENI1'} Online (${name})` : `${parsed.name || name.replace(/\.json$/, '')} (${name})`;
    out.push({
      file: `./profiles/${name}`,
      filename: name,
      name: displayName,
      rawName: parsed.name || '',
      is_online: isOnline,
      model: parsed.model && parsed.model.model ? parsed.model.model : '',
      hide_commands_in_chat: !!parsed.hide_commands_in_chat
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Rewrite the profiles array in settings.js so only the given profile file is active. */
function patchProfiles(activeFile) {
  if (typeof activeFile !== 'string') throw new Error('Invalid profile');
  const available = readProfiles();
  const valid = available.some(p => p.file === activeFile || p.filename === activeFile);
  if (!valid) throw new Error('Unknown profile: ' + activeFile);

  const original = fs.readFileSync(SETTINGS_FILE, 'utf8');
  let text = original;
  // Match both quoted ("profiles": [...],) and unquoted (profiles: [...],) key formats
  const block = text.match(/(["']?profiles["']?\s*:\s*\[[\s\S]*?\],)/);
  if (!block) return 'skipped (profiles block not found)';
  const replacement = `"profiles": [\n    ${JSON.stringify(activeFile)},\n],`;
  text = text.replace(block[0], replacement);
  writeFileAtomic(SETTINGS_FILE + '.bak', original);
  writeFileAtomic(SETTINGS_FILE, text);
  return `profiles -> ${activeFile}`;
}

/** The values the services actually run with, after the env overrides. */
function effectiveValues(env, settings, bots) {
  const server = bots.server || {};
  const safeguards = bots.safeguards || {};
  return {
    host: env.MC_HOST || server.host || settings.host,
    port: Number(env.MC_PORT || server.port || settings.port),
    version: env.MC_VERSION || server.version || settings.minecraft_version,
    auth: env.MC_AUTH || server.auth || settings.auth,
    startPaused: env.START_PAUSED !== undefined
      ? env.START_PAUSED === '1' || env.START_PAUSED === 'true'
      : Boolean(safeguards.startPaused),
    overrides: {
      host: env.MC_HOST ? 'env' : '',
      port: env.MC_PORT ? 'env' : '',
      version: env.MC_VERSION ? 'env' : '',
      auth: env.MC_AUTH ? 'env' : '',
      startPaused: env.START_PAUSED !== undefined ? 'env' : ''
    }
  };
}

function send(res, code, body, type = 'application/json') {
  let payload;
  if (Buffer.isBuffer(body)) {
    payload = body;
  } else if (typeof body === 'string') {
    payload = Buffer.from(body);
  } else {
    payload = Buffer.from(JSON.stringify(body));
  }
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-dashboard-version': VERSION
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      } else if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        const error = new Error(`Schematic is too large (maximum ${Math.floor(maxBytes / 1024 / 1024)} MB).`);
        error.statusCode = 413;
        reject(error);
      } else {
        resolve(Buffer.concat(chunks, size));
      }
    });
    req.on('error', reject);
  });
}

function isLoopbackRequest(req) {
  const address = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().replace(/^::ffff:/, '');
  if (forwarded && forwarded !== '127.0.0.1' && forwarded !== '::1') return false;
  return address === '127.0.0.1' || address === '::1';
}

function authorised(req, url) {
  // No token: only local clients may use the API. This keeps an accidentally
  // exposed dashboard from being fully open while still allowing local access.
  if (!TOKEN) return isLoopbackRequest(req);
  const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (safeCompare(header, TOKEN)) return true;
  const queryToken = url.searchParams.get('token') || '';
  return safeCompare(queryToken, TOKEN);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    if (url.pathname.startsWith('/api/')) recordTelemetry(ms, res.statusCode);
    if (url.pathname.startsWith('/api/') || res.statusCode >= 400) {
      console.log(`${new Date().toISOString()} ${req.method} ${url.pathname} -> ${res.statusCode} (${ms}ms)`);
    }
  });
  try {
    if (!url.pathname.startsWith('/api/')) {
      const wantsLegacy = url.searchParams.get('tab') === 'legacy' || url.pathname === '/legacy';
      const relativeFile = wantsLegacy
        ? 'legacy.html'
        : url.pathname === '/'
          ? 'index.html'
          : url.pathname.replace(/^\//, '');
      const file = path.resolve(PUBLIC_DIR, relativeFile);
      if ((file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (wantsLegacy) return send(res, 404, 'The legacy dashboard is not installed on this host.', 'text/plain');
        return send(res, 404, 'not found', 'text/plain');
      }
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8'
        : file.endsWith('.css') ? 'text/css'
        : file.endsWith('.js') ? 'text/javascript'
        : file.endsWith('.jpg') || file.endsWith('.jpeg') ? 'image/jpeg'
        : file.endsWith('.png') ? 'image/png'
        : file.endsWith('.svg') ? 'image/svg+xml'
        : file.endsWith('.webp') ? 'image/webp'
        : file.endsWith('.ico') ? 'image/x-icon'
        : 'application/octet-stream';
      return send(res, 200, fs.readFileSync(file), type);
    }

    if (!authorised(req, url)) return send(res, 401, { error: 'unauthorised' });

    if (url.pathname === '/api/state' && req.method === 'GET') {
      const services = {};
      for (const name of SERVICES) services[name] = await serviceState(name);
      const coordinator = await coordinatorStatus();
      const logs = {};
      for (const name of SERVICES) logs[name] = await logsFor(name, 40);
      return send(res, 200, { ok: true, services, coordinator, logs, host: ROOT, version: VERSION, uptime: process.uptime() });
    }

    if (url.pathname === '/api/status' && req.method === 'GET') {
      const services = [];
      for (const name of SERVICES) services.push(await serviceSummary(name));
      const coordinator = await coordinatorStatus();
      const agents = Array.isArray(coordinator?.agents) ? coordinator.agents : [];
      let settings = {};
      try { settings = readSettings(); } catch (_) {}
      const bots = readJsonSafe(BOTS_CONFIG, {});
      const effective = effectiveValues(readEnv(), settings, bots);
      return send(res, 200, {
        ok: services.some(service => service.state === 'active'),
        services,
        botCount: agents.length,
        uptime: Math.round(process.uptime()),
        target: `${effective.host || '127.0.0.1'}:${effective.port || 25565}`
      });
    }

    if (url.pathname === '/api/fleet' && req.method === 'GET') {
      return send(res, 200, await fleetBots());
    }

    if (url.pathname === '/api/telemetry' && req.method === 'GET') {
      const recent = telemetry.samples.slice(-100);
      const latencies = recent.map(sample => sample.ms);
      const cutoff = Date.now() - 60_000;
      return send(res, 200, {
        hits: recent.filter(sample => sample.ok).length,
        misses: recent.filter(sample => !sample.ok).length,
        latency: {
          p50: percentile(latencies, 50),
          p95: percentile(latencies, 95)
        },
        throughput: telemetry.samples.filter(sample => sample.at >= cutoff).length,
        lastSweep: telemetry.lastSweep
      });
    }

    if (url.pathname === '/api/schematic' && req.method === 'GET') {
      const agentName = activeAgentName();
      const stateFile = agentScopedFile(path.join(FOREMAN_DIR, 'schematic_jobs.json'), agentName);
      const saved = readJsonSafe(stateFile, { current: null, history: [] });
      return send(res, 200, {
        agentName,
        current: saved?.current || null,
        history: Array.isArray(saved?.history) ? saved.history.slice(0, 10) : []
      });
    }

    if (url.pathname === '/api/schematic/upload' && req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/octet-stream')) {
        return send(res, 415, { error: 'Upload the .schem file as application/octet-stream.' });
      }
      const sourceName = path.basename(String(url.searchParams.get('name') || 'schematic.schem')).slice(0, 100);
      if (!sourceName.toLowerCase().endsWith('.schem')) {
        return send(res, 415, { error: 'This builder currently accepts Sponge .schem files.' });
      }
      const parseCoordinate = axis => {
        const raw = url.searchParams.get(axis);
        if (raw === null || raw.trim() === '') return null;
        const value = Number(raw);
        if (!Number.isInteger(value) || Math.abs(value) > 29_999_984) throw new Error(`Invalid ${axis.toUpperCase()} coordinate.`);
        return value;
      };
      let origin;
      try {
        origin = { x: parseCoordinate('x'), y: parseCoordinate('y'), z: parseCoordinate('z') };
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
      const rotation = Number(url.searchParams.get('rotation') || 0);
      if (![0, 90, 180, 270].includes(rotation)) {
        return send(res, 400, { error: 'Rotation must be 0, 90, 180, or 270 degrees.' });
      }
      let bytes;
      try { bytes = await readRawBody(req, 8 * 1024 * 1024); }
      catch (error) { return send(res, error.statusCode || 400, { error: error.message }); }
      if (bytes.length < 4) return send(res, 400, { error: 'The schematic file is empty or invalid.' });

      const agentName = activeAgentName();
      const stateFile = agentScopedFile(path.join(FOREMAN_DIR, 'schematic_jobs.json'), agentName);
      const saved = readJsonSafe(stateFile, { current: null, history: [] });
      const current = saved?.current;
      if (current && ['queued', 'running', 'pausing', 'paused', 'blocked'].includes(current.status)) {
        return send(res, 409, { error: 'A schematic build is already active. Cancel it before uploading another.' });
      }
      const queuedBuild = readPendingAgentActions(agentName).some(entry => entry.action.action === 'schematic_start');
      if (queuedBuild) return send(res, 409, { error: 'A schematic build is already waiting for ENI1.' });

      const jobId = `schem-${crypto.randomUUID()}`;
      const fileName = `${jobId}.schem`;
      const schematicsDir = path.join(FOREMAN_DIR, 'schematics');
      const schematicPath = path.join(schematicsDir, fileName);
      fs.mkdirSync(schematicsDir, { recursive: true });
      fs.writeFileSync(schematicPath, bytes, { flag: 'wx' });
      const now = Date.now();
      const job = {
        id: jobId, fileName, sourceName, origin, rotation,
        replaceBlocks: url.searchParams.get('replace') === 'true',
        status: 'queued', totalBlocks: 0, nextIndex: 0, placed: 0, skipped: 0,
        size: null, materials: {}, missing: [],
        message: 'Upload received. ENI1 is validating the schematic.',
        createdAt: now, updatedAt: now
      };
      const actionData = {
        id: crypto.randomUUID(), createdAt: now, action: 'schematic_start',
        params: { jobId, fileName, sourceName, ...origin, rotation, replaceBlocks: job.replaceBlocks }
      };
      try {
        writeJsonAtomic(stateFile, { current: job, history: Array.isArray(saved?.history) ? saved.history.slice(0, 10) : [] });
        queueAgentAction(agentName, actionData);
      } catch (error) {
        try {
          writeJsonAtomic(stateFile, { current: current || null, history: Array.isArray(saved?.history) ? saved.history.slice(0, 10) : [] });
        } catch (_) {}
        fs.unlinkSync(schematicPath);
        return send(res, 503, { error: error.message });
      }
      let applied = false;
      try {
        const result = await requestMindserver('/api/addons/action', 'POST', { agentName, ...actionData });
        applied = result.success === true;
      } catch (_) {}
      return send(res, 202, {
        ok: true, jobId, agentName, applied, queued: !applied,
        message: applied ? 'Schematic sent to ENI1.' : 'Schematic saved for ENI1 to process when it reconnects.'
      });
    }

    if (url.pathname === '/api/schematic/control' && req.method === 'POST') {
      const body = await readBody(req);
      const requestedAction = String(body?.action || '').trim().toLowerCase();
      const action = ({ pause: 'schematic_pause', resume: 'schematic_resume', cancel: 'schematic_cancel' })[requestedAction];
      if (!action) return send(res, 400, { error: 'Action must be pause, resume, or cancel.' });
      const agentName = activeAgentName();
      const params = requestedAction === 'resume'
        ? { replaceBlocks: body?.replaceBlocks === true }
        : {};
      const actionData = { id: crypto.randomUUID(), createdAt: Date.now(), action, params };
      try { queueAgentAction(agentName, actionData); }
      catch (error) { return send(res, 503, { error: error.message }); }
      let applied = false;
      try {
        const result = await requestMindserver('/api/addons/action', 'POST', { agentName, ...actionData });
        applied = result.success === true;
      } catch (_) {}
      return send(res, 200, { ok: true, action: requestedAction, applied, queued: !applied });
    }

    if ((url.pathname === '/api/service' || url.pathname.startsWith('/api/service/')) && req.method === 'POST') {
      let name, action;
      if (url.pathname.startsWith('/api/service/')) {
        const parts = url.pathname.split('/').filter(Boolean);
        // /api/service/:name/:action -> parts = ['api', 'service', ':name', ':action']
        name = parts[2];
        action = parts[3];
      }
      if (!name || !action) {
        const body = await readBody(req).catch(() => ({}));
        name = name || String(body.name || '');
        action = action || String(body.action || '');
      }
      if (!SERVICES.includes(name) || !['start', 'stop', 'restart'].includes(action)) {
        return send(res, 400, { error: `bad service or action: service='${name}', action='${action}'` });
      }
      const result = await run('systemctl', [action, name]);
      return send(res, result.ok ? 200 : 500, { ok: result.ok, output: result.stdout + result.stderr });
    }

    if (url.pathname === '/api/config' && req.method === 'GET') {
      let settings = {};
      try { settings = readSettings(); } catch (e) { settings = {}; }
      const bots = readJsonSafe(BOTS_CONFIG, {});
      const env = readEnv();
      const profiles = readProfiles();
      const active = Array.isArray(settings.profiles) && settings.profiles.length
        ? settings.profiles[0]
        : '';
      return send(res, 200, {
        settings, bots, env, effective: effectiveValues(env, settings, bots),
        profiles, active_profile: active, version: VERSION
      });
    }

    if (url.pathname === '/api/profiles' && req.method === 'GET') {
      return send(res, 200, { profiles: readProfiles(), version: VERSION });
    }

    if (url.pathname === '/api/version' && req.method === 'GET') {
      return send(res, 200, {
        version: VERSION,
        name: 'ENI1 Ops',
        port: PORT,
        host: HOST,
        root: ROOT
      });
    }

    if (url.pathname === '/api/config' && req.method === 'POST') {
      const body = await readBody(req);
      const applied = { settings: [], bots: null, profiles: null };
      if (body.settings && typeof body.settings === 'object') {
        applied.settings = patchSettings(body.settings);
      }
      if (body.bots && typeof body.bots === 'object') {
        applied.bots = patchBotsConfig(body.bots);
      }
      if (body.env && typeof body.env === 'object') {
        patchEnv(body.env);
        applied.env = body.env;
      }
      if (body.active_profile) {
        applied.profiles = patchProfiles(body.active_profile);
      }
      // Only bounce the services the change actually affects. The env file is
      // read by both the foreman and the workers, so it touches both.
      const affected = new Set();
      if (body.settings) affected.add('mc-foreman');
      if (body.bots) affected.add('mc-cluster');
      if (body.env) { affected.add('mc-foreman'); affected.add('mc-cluster'); }
      if (body.active_profile) affected.add('mc-foreman');
      if (body.restart === 'all') for (const name of SERVICES) affected.add(name);
      if (body.restart === 'eni') { affected.clear(); affected.add('mc-foreman'); }
      if (body.restart === 'none') affected.clear();
      if (body.restart !== false && affected.size) {
        const order = SERVICES.filter(name => affected.has(name));
        for (const name of order) await run('systemctl', ['restart', name]);
        applied.restarted = order;
      }
      return send(res, 200, applied);
    }

    if (url.pathname === '/api/logs' && req.method === 'GET') {
      const name = String(url.searchParams.get('service') || 'mc-foreman');
      if (!SERVICES.includes(name)) return send(res, 400, { error: 'unknown service' });
      const rawLines = parseInt(url.searchParams.get('lines') || '100', 10);
      const lines = Number.isFinite(rawLines) ? Math.min(Math.max(rawLines, 1), 1000) : 100;
      return send(res, 200, { service: name, lines: await logsFor(name, lines) });
    }

    if (url.pathname === '/api/providers' && req.method === 'GET') {
      const saved = readJsonSafe(AI_PROVIDERS_FILE, { providers: [] });
      const keys = readJsonSafe(KEYS_FILE, {});
      const providers = (Array.isArray(saved.providers) ? saved.providers : []).map(provider => ({
        ...provider,
        keyConfigured: isKeyConfigured(String(provider.keyName || ''), keys)
      }));
      return send(res, 200, { providers });
    }

    if (url.pathname === '/api/providers/test' && req.method === 'POST') {
      const body = await readBody(req);
      const rawBaseURL = String(body?.baseURL || '').trim();
      const baseURL = cleanBaseURL(rawBaseURL);
      const keyName = String(body?.keyName || '').trim();
      const model = String(body?.model || '').trim();
      if (!baseURL) return send(res, 400, { ok: false, latencyMs: null, statusCode: null, modelCount: null, error: 'A base URL is required.' });
      const keys = readJsonSafe(KEYS_FILE, {});
      const clientKey = String(body?.apiKey || '').trim();
      const apiKey = clientKey || (keyName ? String(keys?.[keyName] || process.env[keyName] || '') : '');
      const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::|\/|$)/i.test(baseURL);
      if (!apiKey && !local) {
        return send(res, 200, {
          ok: false, latencyMs: null, statusCode: null, modelCount: null,
          error: keyName ? `No key is configured for ${keyName}. Enter or paste an API key.` : 'This provider has no API key.'
        });
      }
      const result = await probeProvider(baseURL, apiKey, model);
      return send(res, 200, { ...result, model: model || null, keyConfigured: Boolean(apiKey) });
    }

    if (url.pathname === '/api/providers' && req.method === 'POST') {
      const body = await readBody(req);
      if (!Array.isArray(body.providers) || body.providers.length < 1 || body.providers.length > 20) {
        return send(res, 400, { error: 'add between 1 and 20 providers' });
      }

      const ids = new Set();
      const providers = [];
      for (const item of body.providers) {
        const id = String(item?.id || '').trim();
        const name = String(item?.name || '').trim();
        const rawBaseURL = String(item?.baseURL || '').trim();
        const baseURL = cleanBaseURL(rawBaseURL);
        const keyName = String(item?.keyName || '').trim();
        const model = String(item?.model || '').trim();
        const timeoutMs = Number(item?.timeoutMs);
        let parsedURL;
        try { parsedURL = new URL(baseURL); } catch { /* handled below */ }

        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id) || ids.has(id)) {
          return send(res, 400, { error: 'provider IDs must be unique letters, numbers, dashes, or underscores' });
        }
        if (!name || name.length > 80) return send(res, 400, { error: `provider ${id || '(unnamed)'} needs a name under 80 characters` });
        if (!parsedURL || !['http:', 'https:'].includes(parsedURL.protocol) || !parsedURL.hostname) {
          return send(res, 400, { error: `provider ${id} needs a valid HTTP or HTTPS base URL` });
        }
        if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(keyName)) {
          return send(res, 400, { error: `provider ${id} needs an uppercase API key name (e.g. OPENAI_API_KEY)` });
        }
        if (!model && id !== 'nvidia-1') return send(res, 400, { error: `provider ${id} needs a model name` });
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
          return send(res, 400, { error: `provider ${id} timeout must be 1000–120000 ms` });
        }
        if (typeof item.enabled !== 'boolean') return send(res, 400, { error: `provider ${id} needs an enabled setting` });
        ids.add(id);
        providers.push({ id, name, baseURL, keyName, model, timeoutMs, enabled: item.enabled });
      }

      const providerById = new Map(providers.map(p => [p.id, p]));
      const providerByKeyName = new Map(providers.map(p => [p.keyName, p]));
      const validKeyIdentifiers = new Set([
        ...providers.map(p => p.keyName),
        ...providers.map(p => p.id)
      ]);

      const apiKeys = body.apiKeys && typeof body.apiKeys === 'object' && !Array.isArray(body.apiKeys)
        ? body.apiKeys
        : {};
      const clearKeys = Array.isArray(body.clearKeys) ? body.clearKeys : [];
      let currentKeys = {};
      try {
        if (fs.existsSync(KEYS_FILE)) currentKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      } catch {
        return send(res, 500, { error: 'the server key file could not be parsed; no changes were saved' });
      }
      if (!currentKeys || typeof currentKeys !== 'object' || Array.isArray(currentKeys)) {
        return send(res, 500, { error: 'the server key file is not a JSON object' });
      }
      let keysChanged = false;
      const nextKeys = { ...currentKeys };
      for (const [keyIdent, value] of Object.entries(apiKeys)) {
        if (!validKeyIdentifiers.has(keyIdent)) continue;
        const targetKey = providerByKeyName.get(keyIdent)?.keyName || providerById.get(keyIdent)?.keyName || keyIdent;
        if (typeof value !== 'string' || value.length > 4096) continue;
        const trimmed = value.trim();
        if (trimmed) {
          nextKeys[targetKey] = trimmed;
          keysChanged = true;
        }
      }
      for (const keyIdent of clearKeys) {
        if (typeof keyIdent !== 'string' || !validKeyIdentifiers.has(keyIdent)) continue;
        const targetKey = providerByKeyName.get(keyIdent)?.keyName || providerById.get(keyIdent)?.keyName || keyIdent;
        if (Object.prototype.hasOwnProperty.call(nextKeys, targetKey)) {
          delete nextKeys[targetKey];
          keysChanged = true;
        }
      }

      writeJsonBackup(AI_PROVIDERS_FILE, { providers });
      if (keysChanged) {
        writeJsonBackup(KEYS_FILE, nextKeys, 0o600);
        try { patchEnv(nextKeys); } catch (_) {}
      }

      if (body.restart === false) {
        return send(res, 200, { ok: true, providers: providers.map(provider => ({
          ...provider, keyConfigured: isKeyConfigured(provider.keyName, nextKeys)
        })) });
      }
      const restarted = await run('systemctl', ['restart', 'mc-foreman']);
      return send(res, restarted.ok ? 200 : 500, {
        ok: true,
        restarted: restarted.ok ? ['mc-foreman'] : [],
        error: restarted.ok ? '' : 'providers saved, but ENI1 could not be restarted'
      });
    }

    if (url.pathname === '/api/addons' && req.method === 'GET') {
      const agentName = activeAgentName();
      const configFile = agentScopedFile(ADDONS_CONFIG_FILE, agentName);
      const liveFile = agentScopedFile(ADDONS_LIVE_FILE, agentName);
      let config = readJsonSafe(configFile, readJsonSafe(ADDONS_CONFIG_FILE, DEFAULT_ADDONS_CONFIG));
      const savedLive = readJsonSafe(liveFile, readJsonSafe(ADDONS_LIVE_FILE, {}));
      let live = savedLive && typeof savedLive === 'object' && !Array.isArray(savedLive) ? savedLive : {};
      try {
        const current = await requestMindserver(`/api/addons/live?agent=${encodeURIComponent(agentName)}`);
        if (current && !current.agents && typeof current === 'object') {
          live = current;
          if (current.config && typeof current.config === 'object') config = { ...config, ...current.config };
        }
      } catch (_) {
        // The per-agent files remain a usable view when MindServer is offline.
      }
      return send(res, 200, { agentName, config, live });
    }

    if (url.pathname === '/api/addons' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return send(res, 400, { error: 'addon config must be an object' });
      }
      const agentName = activeAgentName();
      const configFile = agentScopedFile(ADDONS_CONFIG_FILE, agentName);
      const current = readJsonSafe(configFile, readJsonSafe(ADDONS_CONFIG_FILE, DEFAULT_ADDONS_CONFIG));
      const merged = { ...current, ...body };
      writeJsonBackup(configFile, merged);
      let applied = false;
      try {
        const result = await requestMindserver('/api/addons/config', 'POST', { agentName, config: body });
        applied = result.success === true;
      } catch (_) {}
      return send(res, 200, {
        ok: true,
        applied,
        queued: !applied,
        agentName,
        config: merged,
        message: applied ? 'Applied to the running agent' : 'Saved for the next agent start; MindServer did not dispatch it'
      });
    }

    if (url.pathname === '/api/addons/action' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || body.type || '');
      if (!action) return send(res, 400, { error: 'missing action' });
      const agentName = activeAgentName();
      const actionData = { id: crypto.randomUUID(), createdAt: Date.now(), action, command: body.command || '', params: body.params || {} };
      let applied = false;
      try {
        const result = await requestMindserver('/api/addons/action', 'POST', { agentName, ...actionData });
        applied = result.success === true;
      } catch (_) {}
      if (!applied) {
        try { queueAgentAction(agentName, actionData); }
        catch (error) { return send(res, 503, { error: error.message }); }
      }
      return send(res, 200, { ok: true, applied, queued: !applied, agentName, action });
    }

    if (url.pathname === '/api/grind' && req.method === 'GET') {
      const agentName = activeAgentName();
      const stateFile = agentScopedFile(path.join(FOREMAN_DIR, 'grind_jobs.json'), agentName);
      const hasSavedState = fs.existsSync(stateFile);
      let grind = readJsonSafe(stateFile, { current: null, queue: [], history: [] });
      if (!grind || typeof grind !== 'object' || Array.isArray(grind)) grind = { current: null, queue: [], history: [] };
      let agentStatus = 'unavailable';
      let lastSeen = null;
      const pendingGrindActions = readPendingAgentActions(agentName)
        .filter(entry => entry.action.action === 'grind_start' && entry.action.params)
        .map(entry => ({
          id: entry.action.params.jobId,
          target: entry.action.params.target,
          requested: Number(entry.action.params.count) || 0,
          completed: 0,
          status: 'submitted',
          createdAt: Number(entry.action.queuedAt) || Date.now(),
          updatedAt: Number(entry.action.queuedAt) || Date.now(),
          message: 'Waiting for ENI1 to receive this job.'
        }));
      try {
        const live = await requestMindserver(`/api/addons/live?agent=${encodeURIComponent(agentName)}`);
        if (!hasSavedState && live?.grind && typeof live.grind === 'object') grind = live.grind;
        lastSeen = Number(live?.timestamp) || null;
        const telemetryAge = lastSeen ? Date.now() - lastSeen : Number.POSITIVE_INFINITY;
        agentStatus = !lastSeen ? 'offline' : telemetryAge >= 0 && telemetryAge <= 5000 ? 'connected' : 'stale';
      } catch (_) {
        // Persisted per-agent state remains available when MindServer is offline.
        try {
          const foreman = await serviceState('mc-foreman');
          agentStatus = foreman.state === 'active' ? 'unavailable' : 'offline';
        } catch (_) {}
      }
      const knownIds = new Set([
        grind.current?.id,
        ...(Array.isArray(grind.queue) ? grind.queue.map(job => job.id) : []),
        ...(Array.isArray(grind.history) ? grind.history.map(job => job.id) : [])
      ].filter(Boolean));
      grind.queue = [...(Array.isArray(grind.queue) ? grind.queue : []), ...pendingGrindActions.filter(job => job.id && !knownIds.has(job.id))];
      if (['offline', 'stale'].includes(agentStatus) && ['running', 'pausing'].includes(grind.current?.status)) {
        grind.current = {
          ...grind.current,
          status: 'paused',
          message: 'ENI1 is offline or its telemetry is stale. Resume after the bot reconnects.'
        };
      }
      return send(res, 200, { agentName, grind, agentStatus, lastSeen });
    }

    if (url.pathname === '/api/grind' && req.method === 'POST') {
      const body = await readBody(req);
      const requestedAction = String(body?.action || '').trim().toLowerCase();
      const agentName = activeAgentName();
      let action;
      let params = {};
      if (requestedAction === 'queue' || requestedAction === 'start') {
        const target = String(body.target || '').trim().toLowerCase();
        const count = Number(body.count);
        if (!GRIND_TARGETS.has(target)) return send(res, 400, { error: 'Choose a supported block target' });
        if (!Number.isInteger(count) || count < 1 || count > 128) {
          return send(res, 400, { error: 'Block count must be a whole number from 1 to 128' });
        }
        const stateFile = agentScopedFile(path.join(FOREMAN_DIR, 'grind_jobs.json'), agentName);
        const savedState = readJsonSafe(stateFile, { current: null, queue: [], history: [] });
        const saved = savedState && typeof savedState === 'object' && !Array.isArray(savedState)
          ? savedState : { current: null, queue: [], history: [] };
        const knownIds = new Set([
          saved.current?.id,
          ...(Array.isArray(saved.queue) ? saved.queue.map(job => job.id) : []),
          ...(Array.isArray(saved.history) ? saved.history.map(job => job.id) : [])
        ].filter(Boolean));
        const pendingCount = readPendingAgentActions(agentName).filter(entry =>
          entry.action.action === 'grind_start' && !knownIds.has(entry.action.params?.jobId)
        ).length;
        if ((Array.isArray(saved.queue) ? saved.queue.length : 0) + pendingCount >= 5) {
          return send(res, 409, { error: 'The grind queue is full (maximum 5 waiting jobs)' });
        }
        action = 'grind_start';
        params = { target, count };
      } else if (requestedAction === 'pause') {
        action = 'grind_pause';
      } else if (requestedAction === 'resume') {
        action = 'grind_resume';
      } else if (requestedAction === 'cancel') {
        const jobId = String(body.jobId || '').trim();
        if (!jobId || jobId.length > 100) return send(res, 400, { error: 'A valid job ID is required to cancel a job' });
        removePendingGrindAction(agentName, jobId);
        action = 'grind_cancel';
        params = { jobId };
      } else {
        return send(res, 400, { error: 'Action must be queue, pause, resume, or cancel' });
      }

      const actionData = { id: crypto.randomUUID(), createdAt: Date.now(), action, params };
      if (action === 'grind_start') actionData.params.jobId = `grind-${actionData.id}`;
      try { queueAgentAction(agentName, actionData); }
      catch (error) { return send(res, 503, { error: error.message }); }
      let applied = false;
      try {
        const result = await requestMindserver('/api/addons/action', 'POST', { agentName, ...actionData });
        applied = result.success === true;
      } catch (_) {}
      return send(res, 200, {
        ok: true,
        applied,
        queued: !applied,
        persisted: true,
        agentName,
        action,
        jobId: action === 'grind_start' ? actionData.params.jobId : undefined,
        message: applied ? 'Sent to ENI1 and stored until processed' : 'Saved for ENI1 to process after reconnecting'
      });
    }

    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, err.statusCode || 500, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[dashboard] listening on http://${HOST}:${PORT} (root ${ROOT})`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1' && !TOKEN) {
    console.warn('[dashboard] DASHBOARD_HOST is not loopback and DASHBOARD_TOKEN is empty: API calls from non-local clients will be rejected.');
  }
});
