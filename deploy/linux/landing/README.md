# Mindcraft landing page

The public one-pager at **https://qyvera.qzz.io**. It replaces the LMS app that
previously occupied the hostname; the LMS itself is untouched and still listens
on port `3000`, but it is no longer published.

## What ships

`public/` is a fully static site with no runtime dependencies: one HTML file,
three local WOFF2 fonts, the Yozakura crest, the night-pavilion hero, and the
agent avatars. All styling and interaction code is inline. There are no
external font, analytics, or image requests.

The design reuses the console's material palette and type system (Fraunces,
Plus Jakarta Sans, JetBrains Mono) so the landing page and the production
console read as one product. Motion is limited to a slow hero push, drifting
petals, scroll reveals, and a gentle pointer tilt on the console preview; all of
it is disabled under `prefers-reduced-motion`.

## Links

| Control | Destination |
| --- | --- |
| Launch the console / Open production console | `https://dash.qyvera.qzz.io/` |
| Read the source / Browse the repository | `https://github.com/chobesujal24/mindcraft` |
| Documentation | repository `README.md` |
| MIT license | repository `LICENSE` |

The console preview is labelled **Preview / Snapshot** and is decorative. It
does not claim to show live data and has no working controls.

## Serve locally

```bash
node server.mjs            # http://127.0.0.1:8094
LANDING_PORT=9000 node server.mjs
```

`server.mjs` serves only files under `public/`, sets a restrictive CSP and
security headers, returns `404` for unknown paths, and exposes `/healthz`.
It binds to `127.0.0.1` by default.

## Production topology

```
https://qyvera.qzz.io
  → Cloudflare TLS + tunnel mindcraft-web
  → 127.0.0.1:8094 (landing server, runs as sujal)
```

`https://dash.qyvera.qzz.io` keeps its own tunnel and Basic Auth gate. The two
hostnames are independent.

## Deploy

Copy this directory to the host, then run its deployment script:

```bash
bash deploy.sh
```

The script installs to `~/mindcraft-landing`, creates the `mindcraft-web`
tunnel if needed, writes `~/.cloudflared/mindcraft-web.yml` with an ingress
pointing at `127.0.0.1:8094`, overwrites the `qyvera.qzz.io` DNS route, stops
the old `lms` tunnel, restarts the landing server and tunnel, adds cron
supervision (`@reboot` plus every minute), and verifies the public hostname.
Set `DASH_USER` and `DASH_PASS` in the environment if you also want the script
to verify the authenticated dashboard.

## Persistence and rollback

`~/mindcraft-landing/start.sh` is idempotent and is run by cron every minute.
Logs live in `~/mindcraft-landing/server.log` and
`~/.cloudflared/mindcraft-web.log`.

To restore the LMS on the hostname, point the `mindcraft-web` ingress at
`http://127.0.0.1:3000` and restart the tunnel, or restart the old `lms` tunnel
after re-pointing DNS with `cloudflared tunnel route dns --overwrite-dns <lms-id>
qyvera.qzz.io`. Use the tunnel UUID from `cloudflared tunnel list`; the name
lookup in cloudflared 2026.9.1 resolved to the wrong tunnel in this account. Do
not run both tunnels against the same hostname.
