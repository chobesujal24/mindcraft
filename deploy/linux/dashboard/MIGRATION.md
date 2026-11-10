# Yozakura ENI-01 dashboard migration

This document covers the front-end rebuild that ships in
`deploy/linux/dashboard/public/index.html`. The Node supervisor in
`deploy/linux/dashboard/server.js` was not changed and remains the source of
truth for every API route.

## What ships

| Path | Purpose |
| --- | --- |
| `public/index.html` | Built, offline-capable single-file React SPA. This is the default dashboard. |
| `public/legacy.html` | The previous dashboard, kept intact for rollback. |
| `app/` | Vite + React + TypeScript source for the new dashboard. |
| `app/mock-server.mjs` | Fixture server used for design review and front-end regression checks. |
| `server.js` | Unchanged supervisor, API, auth, and legacy routing. |

`?tab=legacy` and `/legacy` are handled by `server.js` and serve `legacy.html`.
The new SPA is served for `/` and for any other non-API path.

## Build

Requirements: Node.js 20+, npm 10+.

```bash
cd deploy/linux/dashboard/app
npm ci
npm run build
```

`npm run build` runs `tsc --noEmit` and then Vite. The single-file plugin
inlines JavaScript, CSS, fonts, and image assets into
`deploy/linux/dashboard/public/index.html`. Expected output is roughly
981 kB raw / 483 kB gzip. No external asset requests are made by the page.

The sidebar brand mark and favicon are the 夜 seal in
`app/src/assets/eni-mark.png`, embedded at build time. Replace it with any
square raster mark and rebuild to swap both. The Fleet hero is data-driven:
it renders a seal watermark plus live p95 latency and request-throughput
sparklines from the existing telemetry poll, with no hero photograph or
generated portrait art. Agent and profile identity uses monogram tiles
derived from the profile name.

The app uses hash-based view routing (`#fleet`, `#grind`, `#build`, `#addons`,
`#providers`) so it works when served from `/` without a rewrite rule.

## Local review

Terminal 1:

```bash
cd deploy/linux/dashboard/app
npm run mock
```

Terminal 2:

```bash
cd deploy/linux/dashboard/app
npm run dev
```

The mock server serves the built `public/` directory on
`http://127.0.0.1:8093`; it is not a production component. `npm run dev`
starts Vite for source-level work. The dashboard itself expects the real
supervisor on the same origin in production.

## Deployment

1. Build the SPA as described above.
2. Confirm `public/index.html` and `public/legacy.html` both exist.
3. Restart the dashboard service so it opens the new file (the server reads
   from disk per request, but a service restart also clears any cached page).
4. Load `/` and verify the Fleet view, then open `/?tab=legacy` once.

No new runtime packages or API routes are required. The page authenticates
exactly like the old one: append `?token=...` to the URL when `DASHBOARD_TOKEN`
is set; the token is forwarded as a bearer header for API calls.

`DASHBOARD_HOST` now defaults to `127.0.0.1`. If the dashboard is reached
directly from another machine, set `DASHBOARD_HOST=0.0.0.0` and
`DASHBOARD_TOKEN`; otherwise keep the loopback default and use a reverse proxy
on the same host. A non-loopback host without a token rejects API calls from
non-local clients.

## Rollback

- Per session: open `/?tab=legacy` (or `/legacy`).
- To make the old page the default, first save the current `public/index.html`
  outside the deployed directory, copy `public/legacy.html` to
  `public/index.html`, then restart the dashboard service. Restore the saved
  file to return to the React dashboard.
- The supervisor and legacy page do not depend on the React source in `app/`.

## Preserved behavior

- All six views: Fleet, Grind, Build, Addons, Providers, Settings.
- Existing API contract, including `/api/status`, `/api/fleet`,
  `/api/telemetry`, `/api/config`, `/api/service/:name/:action`,
  `/api/addons`, `/api/addons/action`, `/api/grind`, `/api/schematic`,
  `/api/schematic/control`, `/api/providers`, `/api/providers/test`, and
  `/api/logs`.
- 8-second request timeout, correlation IDs, structured API errors, partial
  poll reporting, 5-second polling with exponential backoff (capped at 30
  seconds), and the offline fixture preview after repeated failures.
- Optimistic service, profile, addon, grind, and provider actions with
  pending locks and rollback on failure.
- Confirmation dialogs, toasts, terminal dock, command palette, lightbox,
  sound preference, and keyboard shortcuts.
- 13 seeded profiles in the fixture, all reachable in the scrollable profile
  rail; the live profile stays pinned above the list.
- CPS Booster accepts the full 1-30 cps range in both fixture and live UI.

## Local preferences

These keys are optional and only affect presentation:

| Key | Values |
| --- | --- |
| `yz.theme` | `"yozakura"` (dark) or `"hanami"` (light) |
| `yz.tab` | Last view (`fleet`, `grind`, `build`, `addons`, `providers`) |
| `yz.sound` | `true` / `false` |
| `yz.sidebar` | `collapsed` / `expanded` |

Clear them to return to the defaults (dark theme, Fleet view, expanded rail).

## Keyboard shortcuts

- `Ctrl/Cmd + K` or `?`: command palette
- `Ctrl/Cmd + J`: terminal dock
- `g f`, `g g`, `g b`, `g a`, `g p`: Fleet, Grind, Build, Addons, Providers
- `t`: toggle theme
- `s`: toggle sound
- `r`: refresh
- `Escape`: close the mobile drawer, dialog, palette, or terminal

## Verification checklist

Run this after deploying:

1. `/` loads with no console errors and the Fleet view is selected.
2. All six views render at 390 px, 768 px, 1024 px, and 1440 px without
   document-level horizontal overflow.
3. At 390 px, primary controls are at least 44 px tall; the navigation drawer
   opens from the menu button, closes with the scrim, the close button, and
   `Escape`.
4. Sidebar collapse persists across reloads and leaves a 78 px icon rail.
5. Theme toggle persists; the hero cluster pulse panel stays inside the hero
   at every desktop width, and flat telemetry series render as a centered
   line rather than sitting on the baseline.
6. Profile rail lists all 13 seeded profiles, the search field filters them,
   and switching opens the confirmation dialog and reports a success toast.
7. CPS Booster displays `max="30"` and can be set to 30.
8. `/?tab=legacy` still serves the old dashboard.
9. Requests carry an `x-correlation-id` and fail cleanly when the supervisor
   is stopped.

## Notes

- Root for the supervisor remains `/opt/mindcraft` when present, otherwise the
  repository root; this migration does not alter that resolution or any file
  paths used by `server.js`.
- The dashboard is intentionally dependency-light: React and React DOM are the
  only runtime dependencies. Fonts and artwork are embedded in the bundle.
- Keep `legacy.html` while you want the `/legacy` route and quick rollback page.
