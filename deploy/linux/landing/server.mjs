/**
 * Static server for the Mindcraft / Yozakura landing page.
 *
 * Runs unprivileged on loopback only. The Cloudflare Tunnel `mindcraft-web`
 * publishes it at https://qyvera.qzz.io. No dependencies, no directory
 * listing, no fallback routing: a missing file is a 404.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, 'public');
const HOST = process.env.LANDING_HOST || '127.0.0.1';
const PORT = Number(process.env.LANDING_PORT || 8094);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

function headersFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const isHtml = ext === '.html';
  return {
    ...SECURITY_HEADERS,
    'Content-Type': MIME.get(ext) || 'application/octet-stream',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=604800, immutable',
  };
}

function notFound(res, pathname) {
  const body = `<!doctype html><meta charset="utf-8"><title>Not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0e0c;color:#efe9de;font:15px/1.6 system-ui,sans-serif;text-align:center}a{color:#e2b0b5}</style>
<main><p style="font:11px/1 monospace;letter-spacing:.2em;color:#8e857a">404 · YOZAKURA</p>
<h1 style="font-weight:400;margin:16px 0 10px">Nothing grows at <code>${escapeHtml(pathname)}</code>.</h1>
<p><a href="/">Return to the garden</a></p></main>`;
  res.writeHead(404, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD', 'Content-Length': 0 });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return notFound(res, '/');
  }

  if (pathname === '/healthz') {
    const body = JSON.stringify({ ok: true, service: 'mindcraft-landing' });
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    });
    return res.end(body);
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Length': 0 });
    return res.end();
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res, pathname);

    const headers = headersFor(filePath);
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Length': 0 });
      }
      res.destroy();
    });
    stream.pipe(res);
  });
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(PORT, HOST, () => {
  console.log(`[landing] ${new Date().toISOString()} listening on http://${HOST}:${PORT} (root ${ROOT})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
