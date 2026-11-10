/**
 * tools/run-when-world-up.js - start Mindcraft when the LAN world is reachable.
 *
 * "Open to LAN" picks a new port every time and the agent exits when the
 * world closes, so a Mindcraft that was started against a closed world stays
 * dead. This watcher waits for the Minecraft port, starts Mindcraft, and
 * restarts it if the world drops again.
 *
 * Usage: node tools/run-when-world-up.js [host] [port]
 */

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HOST = process.argv[2] || process.env.MC_HOST || '127.0.0.1';
const PORT = Number(process.argv[3] || process.env.MINECRAFT_PORT || process.env.MC_PORT || 56730);
const CHECK_INTERVAL_MS = 5000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let starting = false;

function worldIsUp() {
  return new Promise(resolve => {
    const socket = net.connect({ host: HOST, port: PORT });
    const done = value => {
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(value);
    };
    socket.setTimeout(2500, () => done(false));
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

function startMindcraft() {
  if (starting) return;
  starting = true;
  console.log(`[watcher] world is up on ${HOST}:${PORT} - starting Mindcraft`);
  const child = spawn(process.execPath, ['main.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MINECRAFT_PORT: String(PORT), MC_PORT: String(PORT) }
  });
  child.on('exit', code => {
    starting = false;
    console.log(`[watcher] Mindcraft exited (${code}); waiting for the world again`);
  });
}

async function loop() {
  while (true) {
    if (await worldIsUp()) {
      startMindcraft();
      while (starting) await new Promise(r => setTimeout(r, 2000));
    }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL_MS));
  }
}

console.log(`[watcher] waiting for the Minecraft LAN server on ${HOST}:${PORT}`);
// Keep the event loop alive even when the watcher is started detached.
setInterval(() => {}, 1 << 30);
loop().catch(err => {
  console.error('[watcher] loop error:', err);
  setTimeout(loop, CHECK_INTERVAL_MS);
});
