# Yozakura ENI-01 dashboard migration

This document covers the front-end rebuild that ships in
`deploy/linux/dashboard/public/index.html`. The Node supervisor in
`deploy/linux/dashboard/server.js` was not changed and remains the source of
truth for every API route.

The console is no longer a design prototype: every panel reads from the live
supervisor API and every control calls a real endpoint. Where the API cannot do
something, the control is absent rather than faked.

## UI refresh

The console was refreshed from the `fix-bugs-and-ui` design bundle without
changing the supervisor contract:

- Provider cards resolve the brand from the endpoint URL, show embedded provider
  marks, and add **Test all**, which sends one real test request per keyed
  route. Latency and model counts remain session-only.
- Add-ons use the embedded SVG icon set for modules and dispatch groups. The
  guarded-module confirmation and conflict handling are unchanged.
- Build gains the schematic hero render and material manifest, Grind shows stack
  counts and a one-click **Re-run** for finished jobs, and Fleet shows the
  cluster target, uptime, and a bearing compass for nearby players.
- World photography, hero art, provider marks, add-on icons, fonts, and block
  renders are all embedded in the single-file build.

The design bundle also carried a browser-side demo feed, a hardcoded PIN gate,
a landing page, seeded telemetry/loadout data, and sample-schematic actions.
None of it shipped. The console starts empty and reconnecting until the
supervisor answers; the API is the only source of state, and a control that the
API cannot service is absent.

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
1.64 MB raw / 907 kB gzip. No external asset requests are made by the page.

### Dependencies

Runtime: `react`, `react-dom`, `zustand` (state), `framer-motion` (view
transitions), `lucide-react` (icons), `clsx` + `tailwind-merge` (class
composition). Build time: `vite`, `@vitejs/plugin-react`,
`vite-plugin-singlefile`, `tailwindcss`, `@tailwindcss/vite`, `typescript`.

### Offline assets

- Fonts: `app/src/theme/fonts.css` carries Fraunces, Plus Jakarta Sans, and
  JetBrains Mono as inline `data:font/woff2` payloads. It is imported in
  `main.tsx` before `index.css`, so no font is fetched from the network.
- Art: `app/src/assets/embedded/*.ts` hold the crest, agent portraits, block
  renders, world/hero photographs, provider marks, and add-on SVG icons as text
  modules. `app/src/assets/index.ts` and `app/src/assets/world.ts` look them up
  at build time and every lookup is optional, so a missing module degrades to
  drawn artwork instead of a broken image.
- The binary originals under `app/src/assets/` (hero JPGs, avatar JPGs, block
  PNGs) stay in the repository as the editable source of those embedded
  modules; the bundle does not read them.

The Fleet and Build heroes render embedded photography behind their summary
panels, and fall back to drawn gradients when no art is embedded. On phones the
Fleet photo is narrowed to the right edge so the headline and telemetry tiles
stay legible.

## Routing

The app uses hash-based view routing (`#/fleet`, `#/grind`, `#/build`,
`#/addons`, `#/providers`, `#/settings`) so it works when served from `/`
without a rewrite rule. `#fleet` without the slash is also accepted.

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

`mock-server.mjs` also exposes `GET /api/mock/fail?on=1` and
`GET /api/mock/fail-next?count=1`, which make the API fail so the reconnect
banner, the retry countdown, and the backoff can be exercised without
stopping a service.

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

- All six views: Fleet, Grind, Build, Add-ons, Providers, Settings.
- Existing API contract, including `/api/status`, `/api/fleet`,
  `/api/telemetry`, `/api/config`, `/api/service/:name/:action`,
  `/api/addons`, `/api/addons/action`, `/api/grind`, `/api/schematic`,
  `/api/schematic/upload`, `/api/schematic/control`, `/api/providers`,
  `/api/providers/test`, and `/api/logs`.
- 8-second request timeout (120 s for schematic uploads), correlation IDs,
  structured API errors, partial poll reporting, 5-second polling with
  exponential backoff (capped at 30 seconds), and the last good snapshot kept
  on screen while the supervisor is unreachable.
- Optimistic service, profile, addon, grind, and provider actions with
  pending locks and rollback on failure.
- Confirmation dialogs, toasts, terminal dock, command palette, and keyboard
  shortcuts.
- CPS Booster accepts the full 1-30 cps range in both fixture and live UI.

## How the console maps onto the API

The supervisor owns every decision. The console only renders what the API
reports and sends the parameters the API expects.

| Console surface | Endpoint | Notes |
| --- | --- | --- |
| Fleet services | `GET /api/status`, `POST /api/service/:name/:action` | The five units the supervisor reports: `mc-shim`, `mc-cluster`, `mc-foreman`, `mc-dashboard`, `minecraft-server`. |
| Fleet agents and radar | `GET /api/fleet`, `GET /api/addons` | The first bot is ENI1 on `mc-foreman`. The rest are coordinator agents on `mc-cluster` and are read-only: dispatch buttons are disabled for them and say why. |
| Fleet hero and KPIs | `GET /api/telemetry` | p50/p95 latency, throughput, and hit rate. Telemetry measures dashboard request health, not inference. |
| Grind | `GET/POST /api/grind` | The planner sends `{ target, count }`. The queue is server-owned and capped at five waiting jobs. Pause and resume take no job ID; cancel takes `jobId`. |
| Build | `GET /api/schematic`, `POST /api/schematic/upload`, `POST /api/schematic/control` | Sponge `.schem` only, 8 MB max, rotation 0/90/180/270. The builder runs one schematic at a time, so the upload control is disabled while a build is active and states the reason. |
| Add-ons | `GET/POST /api/addons`, `POST /api/addons/action` | Module switches write the add-on config; dispatch actions are sent to ENI1. |
| Providers | `GET/POST /api/providers`, `POST /api/providers/test` | Every change posts the full provider list, which restarts `mc-foreman` so the new routing table is live. |
| Settings | `GET/POST /api/config` | `Save` posts `{ settings, restart: false }`, `Save and restart ENI1` posts `{ settings, restart: "eni" }`, and the reconciliation button posts `{ restart: "eni" }`. A profile swap posts `{ active_profile, restart: "eni" }`. |
| Console dock | `GET /api/logs`, `POST /api/addons/action` | The dock tails the five known services and de-duplicates repeats per service. Anything typed is sent to ENI1 as a server command; `help`, `status`, and `clear` are handled in the browser. |

### Deliberately absent controls

The supervisor API has no endpoint for these, so the console does not show
them:

- Reordering or clearing the grind queue and the grind/build history. Both
  lists are read-only in the UI.
- A build queue. Only one schematic build can be active at a time.
- Clearing long-term memory. Settings instead offers a real `mc-foreman`
  start/restart maintenance panel.
- A "mark key configured" switch. Provider keys are real: `keyName` is
  required and matches the server's `^[A-Z][A-Z0-9_]{1,63}$` pattern, and a
  keyless provider is rejected by the server. The Test button stays disabled
  until a key is stored, and its latency and model count are session-only.

## Local preferences

These keys are optional and only affect presentation:

| Key | Values |
| --- | --- |
| `yz.theme` | `"yozakura"` (dark) or `"hanami"` (light) |
| `yz.sound` | `"on"` / `"off"` |
| `yz.sidebar` | `collapsed` / `expanded` |
| `yz.dock` | `open` / `closed` |
| `yz.dock.h` | Console height in pixels, 140-460 |

Clear them to return to the defaults (dark theme, Fleet view, expanded rail).

## Keyboard shortcuts

- `Ctrl/Cmd + K`: command palette
- `Ctrl/Cmd + J`: open or collapse the console
- `g f`, `g g`, `g b`, `g a`, `g p`, `g s`: Fleet, Grind, Build, Add-ons,
  Providers, Settings
- `r`: refresh
- `t`: toggle theme
- `s`: toggle interface sounds
- `?`: keyboard shortcut sheet

Shortcuts stand down while a dialog owns the keyboard or a text field has
focus. The console dock can also be resized by dragging its top edge, by
arrow keys while the resize handle is focused, or by double-clicking the
handle to reset it to 208 px.

## Verification checklist

Run this after deploying:

1. `/` loads with no console errors and the Fleet view is selected.
2. All six views render at 390 px, 768 px, 1024 px, and 1440 px without
   document-level horizontal overflow.
3. At 390 px, primary controls are at least 44 px tall; the navigation drawer
   opens from the menu button, closes with the scrim, the close button, and
   `Escape`.
4. Sidebar collapse persists across reloads and leaves a 78 px icon rail.
5. Theme toggle persists; the hero photograph stays behind the right edge of
   the hero on narrow screens and flat telemetry series render as a centered
   line rather than sitting on the baseline.
6. The profile list is populated from `/api/config`; switching opens the
   confirmation dialog and reports a success toast.
7. CPS Booster displays `max="30"` and can be set to 30.
8. Queueing a grind job, pausing and resuming it, and cancelling it all
   change `/api/grind` on the server.
9. Uploading a `.schem` file starts a build; while a build is active the
   upload control is disabled and says why.
10. Toggling an add-on module changes `/api/addons`; the Disarm-all button
    asks for confirmation first.
11. Reordering, enabling, editing, and removing a provider all persist
    through `/api/providers`; Test reports latency and model count for the
    session only, and Test all probes every keyed route.
12. Saving settings writes `/api/config` without a restart; "Save and restart
    ENI1" and the reconciliation button request the restart.
13. `/?tab=legacy` still serves the old dashboard.
14. Requests carry an `x-correlation-id` and fail cleanly when the supervisor
    is stopped.
15. With no supervisor attached, the console shows the reconnect banner and
    empty/last-known state only. There is no demo feed, PIN gate, seeded
    telemetry, or sample schematic action.

## Notes

- Root for the supervisor remains `/opt/mindcraft` when present, otherwise the
  repository root; this migration does not alter that resolution or any file
  paths used by `server.js`.
- The interface-sound switch is real: new toasts play a short WebAudio cue.
- Keep `legacy.html` while you want the `/legacy` route and quick rollback page.
