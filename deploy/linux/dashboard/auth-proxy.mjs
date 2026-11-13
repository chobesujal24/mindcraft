/**
 * Optional HTTP Basic Auth gate for public dashboard access.
 *
 * Run it as the deployment user on 127.0.0.1 (never expose this port directly),
 * point a Cloudflare Tunnel ingress at it, and keep the supervisor behind it on
 * 127.0.0.1:8092. `auth.json` holds { username, salt, hash }, where hash is
 * scrypt(password, salt, 32). The proxy is dependency-free and forwards both
 * HTTP requests and WebSocket upgrades.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(here, 'auth.json');
const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = Number(process.env.AUTH_PROXY_PORT || 8093);
const UPSTREAM_HOST = '127.0.0.1';
const UPSTREAM_PORT = Number(process.env.AUTH_PROXY_UPSTREAM_PORT || 8092);

const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
if (!auth.username || !auth.salt || !auth.hash) {
  throw new Error('auth.json must contain username, salt and hash');
}
const expected = Buffer.from(auth.hash, 'hex');

const failures = new Map();
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 20;

function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  if (cf) return cf;
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.first > FAILURE_WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now - entry.first > FAILURE_WINDOW_MS) {
    failures.set(ip, { first: now, count: 1 });
  } else {
    entry.count += 1;
  }
  if (failures.size > 5000) failures.clear();
}

function checkBasic(header) {
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  if (user !== auth.username) return false;
  const candidate = crypto.scryptSync(pass, auth.salt, expected.length);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function unauthorized(req, res) {
  recordFailure(clientIp(req));
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Yozakura", charset="UTF-8"',
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end('Authentication required.\n');
}

function tooMany(res) {
  res.writeHead(429, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Retry-After': '600',
    'Cache-Control': 'no-store',
  });
  res.end('Too many failed attempts. Try again later.\n');
}

function authorized(req) {
  const ip = clientIp(req);
  if (rateLimited(ip)) return 'limited';
  if (checkBasic(req.headers.authorization)) return 'ok';
  return 'no';
}

function forwardHeaders(req) {
  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers['x-forwarded-for'];
  delete headers['x-forwarded-proto'];
  delete headers['x-forwarded-host'];
  return headers;
}

const server = http.createServer((req, res) => {
  const status = authorized(req);
  if (status === 'limited') return tooMany(res);
  if (status !== 'ok') {
    // Slow down guessing without blocking the event loop.
    setTimeout(() => unauthorized(req, res), 150);
    return;
  }
  const upstream = http.request({
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: req.url,
    method: req.method,
    headers: forwardHeaders(req),
  }, (upRes) => {
    res.writeHead(upRes.statusCode || 502, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`Upstream unavailable: ${err.message}\n`);
    } else {
      res.destroy(err);
    }
  });
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const status = authorized(req);
  if (status !== 'ok') {
    if (status === 'no') recordFailure(clientIp(req));
    socket.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="Yozakura", charset="UTF-8"\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  const upstream = http.request({
    hostname: UPSTREAM_HOST,
    port: UPSTREAM_PORT,
    path: req.url,
    method: req.method,
    headers: forwardHeaders(req),
  });
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n');
    for (const [key, value] of Object.entries(upRes.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) socket.write(`${key}: ${item}\r\n`);
      } else if (value != null) {
        socket.write(`${key}: ${value}\r\n`);
      }
    }
    socket.write('\r\n');
    if (upHead?.length) socket.write(upHead);
    if (head?.length) upSocket.write(head);
    socket.pipe(upSocket).pipe(socket);
    socket.on('error', () => upSocket.destroy());
    upSocket.on('error', () => socket.destroy());
  });
  upstream.on('response', (upRes) => {
    socket.write(`HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}\r\n`);
    for (const [key, value] of Object.entries(upRes.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) socket.write(`${key}: ${item}\r\n`);
      } else if (value != null) {
        socket.write(`${key}: ${value}\r\n`);
      }
    }
    socket.write('\r\n');
    upRes.pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[auth-proxy] ${new Date().toISOString()} listening on http://${LISTEN_HOST}:${LISTEN_PORT} -> ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
