# Mindcraft — ENI1 / Yozakura Field Console

A customized [Mindcraft](https://github.com/mindcraft-bots/mindcraft) 0.1.4 deployment built around **ENI1**, a Minecraft agent that runs on Mineflayer and an LLM backend. This fork adds a Linux control dashboard, a persistent grind/build worker surface, provider failover, protocol and movement hardening, and an offline regression suite.

- Repository: <https://github.com/chobesujal24/mindcraft>
- Live site: <https://qyvera.qzz.io>
- Production console: <https://dash.qyvera.qzz.io> (password-gated)
- Runtime: Node.js + Mineflayer + an OpenAI-compatible LLM provider
- Checked-in target: Minecraft **26.1**, offline auth, `127.0.0.1:56730`
- Control UI: **Yozakura** dashboard on `127.0.0.1:8092` (Linux) and the built-in MindServer UI on `127.0.0.1:8080`

> [!WARNING]
> `settings.js` currently sets `allow_insecure_coding: true` and `code_timeout_mins: -1`. The model can write and execute code on the host, with no code timeout. Do not connect this bot to public servers with coding enabled, and do not expose the dashboard or MindServer to the internet without a token and a TLS-terminating reverse proxy.

---

## What this fork adds

| Area | Change |
| --- | --- |
| Dashboard | Six-view React/TypeScript SPA (Fleet, Grind, Build, Add-ons, AI providers, Settings) plus a legacy shell, served by a dependency-free Node supervisor. Every view is driven by the live supervisor API. |
| Fleet control | Live agent rows with health/food, coordinates, ping, player radar, systemd service start/restart/stop, and a guarded **Restart foreman** action. |
| Work queues | Persistent Grind jobs and Sponge schematic builds with pause/resume/cancel, progress reconciliation, material ledger, shortages, and history. |
| Add-ons | Toggleable combat/survival/recon/economy modules, CPS slider, one-packet dispatch groups, and a threat ledger. |
| Providers | Priority-ordered fallback chain of up to 20 OpenAI-compatible providers, write-only API-key storage, endpoint tests, and hot restart. |
| Protocol fixes | `tick_end` is paired with movement packets, position writes are throttled, block searches are clamped and time-boxed, and placement refuses interactive support blocks. |
| Action safety | Generation-guarded action cancellation; a stuck action keeps the lock, triggers a clean restart, and falls back to a hard exit rather than overlapping work. |
| Security | Loopback-by-default MindServer and dashboard, mandatory tokens for non-loopback access, token-authenticated REST and Socket.IO, and secret files excluded from Git. |
| Testing | `npm test` runs offline checks for prompt ordering, mob hostility, block search, placement, action locking, and token enforcement. |

---

## Repository map

| Path | Purpose |
| --- | --- |
| `main.js` | Entry point. Loads `settings.js`, applies environment overrides, starts MindServer, and creates each profile's agent. |
| `settings.js` | Runtime settings used by `npm start`. |
| `settings.linux.js` | Linux-oriented settings template. The runtime still reads `settings.js`; copy or merge deliberately. |
| `profiles/` | Agent profiles. The checked-in active profile is `foreman.json` (ENI1); other profiles are templates. |
| `src/agent/` | Agent loop, action manager, self-prompting, skills, commands, and add-ons. |
| `src/mindcraft/` | MindServer, agent process management, and the built-in web UI. |
| `src/utils/mcdata.js` | Protocol compatibility, movement throttling, and the `tick_end` shim. |
| `deploy/linux/dashboard/` | Yozakura dashboard supervisor, built SPA, legacy page, and React source. |
| `deploy/linux/landing/` | Static Mindcraft landing page, dependency-free server, and deployment script. |
| `deploy/linux/dashboard/app/` | Vite + React + TypeScript dashboard source. |
| `addons_config.json` | Add-on defaults. |
| `ai-providers.json` | Provider routing table. Contains key **names**, never key values. |
| `keys.example.json` | Template for local `keys.json`. |
| `scripts/self-check.mjs` | Offline regression suite used by `npm test`. |
| `patches/` | Pinned dependency patches applied by `patch-package`. |

---

## Quick start (local)

### Requirements

- Node.js 20 or newer. Node 22 is recommended and is what the Docker image uses.
- npm 10+.
- A Minecraft server reachable from the host. The checked-in configuration expects `127.0.0.1:56730` and offline-mode auth.
- An LLM provider key or a local OpenAI-compatible endpoint.

### Install

```bash
npm install
```

`postinstall` applies `patch-package` patches and builds the bundled Prismarine viewer. Native dependencies such as `canvas` may require build tools on Linux; the Docker image includes them.

### Configure

Edit `settings.js` before the first run:

```js
{
    minecraft_version: "26.1",
    host: "127.0.0.1",
    port: 56730,
    auth: "offline",
    profile: "ENI1",
    profiles: ["./profiles/foreman.json"],
    mindserver_port: 8080,
    auto_open_ui: true
}
```

At minimum, set `host`, `port`, `auth`, and `minecraft_version` to match your server. `settings.linux.js` is a separate template with MindServer on `8091` and `auto_open_ui: false`; it is not read automatically.

### Add API keys

Create `keys.json` from the template and fill in only the keys you use:

```bash
cp keys.example.json keys.json
```

`keys.json`, `auth/`, `.env*`, `*.pem`, `*.key`, `*.p12`, and `*.pfx` are gitignored. Never commit them. Provider entries in `ai-providers.json` reference environment-variable names such as `OPENAI_API_KEY`; the actual secret can come from `keys.json` or the process environment.

### Run

```bash
npm start
```

This starts MindServer and opens the built-in UI at <http://127.0.0.1:8080> after three seconds if no listener is already connected.

On Windows, `start-foreman.cmd` starts the local OpenCode shim first and then runs `npm start`. Use it only if you depend on the local shim provider.

### Verify

```bash
npm test
```

The self-check does not contact Minecraft or an LLM. It verifies prompt ordering, neutral-mob classification, block-search limits, placement safety, action locking/restart behavior, and MindServer token enforcement.

---

## Configuration reference

### Checked-in behavior

These are the values currently in `settings.js`:

| Setting | Value | Effect |
| --- | --- | --- |
| `minecraft_version` | `"26.1"` | Protocol target pinned to the installed Mineflayer/minecraft-data stack. |
| `host` / `port` | `"127.0.0.1"` / `56730` | Minecraft server target. This is not the dashboard port. |
| `auth` | `"offline"` | Offline-mode login. No Microsoft account is used. |
| `profilesFolder` | `"auth"` | Microsoft login cache when `auth` is `"microsoft"`; gitignored. |
| `profile` | `"ENI1"` | Active profile name. |
| `profiles` | `["./profiles/foreman.json"]` | Only the ENI1 foreman profile is enabled by default. |
| `via_proxy.enabled` | `false` | Direct connection. ViaProxy is opt-in. |
| `mindserver_port` | `8080` | Built-in MindServer UI/API port. |
| `auto_open_ui` | `true` | Opens the MindServer UI on startup. |
| `base_profile` | `"assistant"` | Base behavior profile. |
| `load_memory` | `false` | Does not load prior session memory at boot. |
| `init_message` / `silent_spawn` | `""` / `true` | No greeting or spawn announcement. |
| `only_chat_with` | Three operator names | Chat allow-list. This filters conversation, not code execution or network access. |
| `chat_ingame` | `true` | Bot replies are shown in Minecraft chat. |
| `allow_insecure_coding` | `true` | Enables `newAction` and model-authored code execution. **Elevated risk.** |
| `code_timeout_mins` | `-1` | No code timeout. The dashboard's numeric field accepts `-1` for no timeout or 1–120 minutes, and requires a valid value before saving. |
| `blocked_actions` | Blueprint commands | Removes `!checkBlueprint`, `!checkBlueprintLevel`, `!getBlueprint`, and `!getBlueprintLevel` from the model's action surface. |
| `spawn_timeout` | `60` | Seconds to wait for spawn. |
| `narrate_behavior` | `true` | Narrates simple actions in chat. |
| `server_password` | Empty | Prefer `MC_SERVER_PASSWORD` or `keys.json` for LimboAuth/AuthMe-style servers. |
| `auto_lifesteal_pipeline` | `false` | When enabled: auto-login, wait 2 s, `/server lifesteal`, then `/randomtp` after world spawn. |

Environment overrides are applied in `main.js`: `MINECRAFT_PORT`, `MINDSERVER_PORT`, `PROFILES`, `INSECURE_CODING`, `BLOCKED_ACTIONS`, `MAX_MESSAGES`, `NUM_EXAMPLES`, `LOG_ALL`, and `SETTINGS_JSON`. `MINDSERVER_HOST` defaults to loopback.

### Authentication modes

- **`offline`** — for offline-mode or cracked servers. The bot does not authenticate with Mojang/Microsoft. This is the checked-in mode.
- **`microsoft`** — for premium servers. The login cache is written under `profilesFolder` (`auth/` by default), which is gitignored.
- **Server login password** — for LimboAuth/AuthMe/nLogin-style prompts. Set `server_password`, or preferably `MC_SERVER_PASSWORD`, or a `keys.json` entry. The agent detects `/login` prompts, rate-limits retries, and warns when no password is configured.

### ViaProxy behavior

ViaProxy is a separate bridge for servers whose version is newer than this Mindcraft install's protocol data. It is **disabled by default**.

When `via_proxy.enabled` is `true`:

1. Mindcraft validates `via_proxy.host`, `via_proxy.port` (1–65535), and `via_proxy.client_version`.
2. It checks that `client_version` is supported by the installed Mineflayer/minecraft-data stack.
3. Mineflayer connects to the ViaProxy host/port as a client on `client_version`.
4. ViaProxy must be running separately and configured to target `settings.host`, `settings.port`, and `settings.minecraft_version`.
5. The dashboard disables the `auth` selector in bridge mode. Configure the Microsoft account inside ViaProxy; Mindcraft does not send those credentials through the bridge.

If ViaProxy is enabled but unreachable, or its target does not match, the handshake fails before ENI1 joins. Keep `host`, `port`, and `minecraft_version` in sync with ViaProxy's `target-address` and `target-version`.

### Providers and failover

`ai-providers.json` defines a priority-ordered list of OpenAI-compatible routes. Each route has an `id`, display name, base URL, `keyName`, model, timeout, and `enabled` flag. Provider P1 is tried first; on HTTP 429, 500, or timeout, the next enabled route is tried.

- Maximum **20** providers per routing table.
- Provider IDs must be unique letters, numbers, dashes, or underscores.
- `keyName` must be an uppercase environment-variable name such as `OPENAI_API_KEY`.
- Timeouts must be 1000–120000 ms.
- The dashboard can add, remove, reorder, enable/disable, test, and save routes. API keys are staged in memory, written with `0600` permissions on Linux, and never returned over the wire.
- Each provider change posts the full table, which restarts `mc-foreman` so the new routing table is live.

### Self-prompting

The agent supports continuous goal-driven self-prompting:

- `!goal <prompt>` starts a self-prompt loop. If a conversation is active, the goal is staged as paused.
- Each loop response must contain a command. After three consecutive responses without one, the loop stops and reports it in chat.
- `!endGoal` stops self-prompting and the current action.
- The loop uses a 2-second cooldown and restarts automatically when the agent is idle.
- The current goal is injected into the profile prompt through `$SELF_PROMPT`; self-prompt state is included in agent save data and restored when memory is loaded.

---

## Yozakura control dashboard

The dashboard is the Linux control plane for the deployed cluster. It is a single-file React SPA served by `deploy/linux/dashboard/server.js`; the supervisor uses only Node built-ins and reads `public/index.html` per request. Every panel reads from the supervisor API and every control calls a real endpoint — where the API cannot do something, the control is absent rather than simulated. The refreshed console carries embedded world/hero art, provider identity marks, add-on SVG icons, a bearing compass, and a Build hero render, but no browser-side demo feed, PIN gate, or seeded state.

### Build

```bash
cd deploy/linux/dashboard/app
npm ci
npm run build
```

`npm run build` runs `tsc --noEmit` and Vite, then writes a single offline-capable HTML bundle to `deploy/linux/dashboard/public/index.html`. Fonts, artwork, and icons are embedded in the bundle, so no external asset requests are made by the page. `deploy/linux/dashboard/MIGRATION.md` records the port in detail.

### Run the supervisor

```bash
cd deploy/linux/dashboard
DASHBOARD_HOST=127.0.0.1 \
DASHBOARD_PORT=8092 \
DASHBOARD_ROOT=/opt/mindcraft \
DASHBOARD_TOKEN='replace-with-a-long-random-token' \
node server.js
```

Then open:

```text
http://127.0.0.1:8092/?token=replace-with-a-long-random-token#/fleet
```

The dashboard is designed for a Linux host managed by systemd. It expects these units:

```text
mc-shim  mc-cluster  mc-foreman  mc-dashboard  minecraft-server
```

`mc-shim`, `mc-cluster`, `mc-foreman`, and `mc-dashboard` count toward core availability; `minecraft-server` is optional. Service actions call `systemctl start|stop|restart`. If those units do not exist, Fleet will show service errors.

Expected filesystem layout under `DASHBOARD_ROOT` (default `/opt/mindcraft` when present, otherwise the repository root):

```text
/opt/mindcraft/
├── mindcraft-0.1.4/        # settings.js, profiles, addons_config.json, keys.json, ai-providers.json
├── bots/config.json
└── deploy/linux/mc-cluster.env
```

The dashboard is not a Windows service manager. On Windows, use the built-in MindServer UI or the dashboard mock server for front-end work.

### Routes

| Route | Serves |
| --- | --- |
| `/` | Yozakura SPA, default Fleet view. |
| `/#/fleet` | Fleet. |
| `/#/grind` | Grind. |
| `/#/build` | Build. |
| `/#/addons` | Add-ons. |
| `/#/providers` | AI providers. |
| `/#/settings` | Settings. |
| `/?tab=legacy` | Legacy dashboard (`public/legacy.html`). |
| `/legacy` | Same legacy dashboard. |

View changes only touch the hash, so the path and the token query string are preserved. The SPA does not need a server-side rewrite rule.

### Authentication and binding

- Default bind: `127.0.0.1:8092`.
- If `DASHBOARD_TOKEN` is **unset**, only loopback clients may call `/api/*`.
- If `DASHBOARD_TOKEN` is **set**, API calls must present `Authorization: Bearer <token>` or `?token=<token>`.
- The SPA reads `?token=...` from the page URL and forwards it as a bearer header for API and upload requests.
- A non-loopback `DASHBOARD_HOST` without a token is allowed to start, but API calls from non-local clients are rejected. The supervisor logs a warning at startup.
- Token protection covers `/api/*`. The HTML shell and static assets are served without authentication, so do not put secrets in the page.
- The dashboard has no TLS. For remote access, keep it on loopback and use a TLS-terminating reverse proxy, or set `DASHBOARD_TOKEN` and restrict network access.

### Front-end development

```bash
cd deploy/linux/dashboard/app
npm run mock     # fixture server on http://127.0.0.1:8093
npm run dev      # Vite dev server
```

The mock server is for design review and front-end checks only. It is not a production component.

### Shell and global controls

- **Sidebar**: Yozakura brand, live navigation with one status figure per view (agents reporting, jobs running or queued, build progress, add-ons armed, providers enabled), a live/reconnecting workspace footer with the snapshot age and version, and a collapse toggle that persists.
- **Top bar**: current view title and subtitle, connection pill (live with snapshot age, or retry countdown), search, notifications, refresh, sound toggle, theme toggle, and console toggle.
- **Mobile tab strip**: Fleet, Grind, Build, Add-ons, Providers, Settings. It is hidden on desktop, where the sidebar already does that job.
- **Notifications**: service failures, build material shortages, agents that need attention, close radar contacts, missing provider keys, insecure-coding and configuration-drift warnings, and an all-clear state.
- **Confirmation dialogs**: destructive or restarting actions require confirmation, including service stop/restart, grind cancel, build stop, profile switch, arming a guarded module, disarming every module, and foreman restart.
- **Offline behavior**: the SPA polls eight endpoints every 5 seconds. Partial failures are reported per endpoint in the console; repeated total failures keep the last confirmed snapshot on screen behind a reconnect banner and back off exponentially up to 30 seconds.
- **Themes**: `yozakura` (dark) and `hanami` (daylight). Preferences are stored in `localStorage`.
- **Terminal dock**: per-service log filters (foreman, cluster, shim, dashboard, server), console/api/warning filters, a pause toggle, scrollback clearing, a draggable and keyboard-resizable height, command history, and direct dispatch of server commands to ENI1.
- **Command palette**: navigation, agent inspection, refresh, theme, sound, console, keyboard shortcuts, pause/resume for a running job, and the disarm-all safety action.
- **Radar lightbox**: expanded player radar with range control and ENI1 coordinates.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+K` | Toggle the command palette. |
| `?` | Open the keyboard shortcut sheet. |
| `Ctrl/Cmd+J` | Toggle the terminal dock. |
| `g f` | Go to Fleet. |
| `g g` | Go to Grind. |
| `g b` | Go to Build. |
| `g a` | Go to Add-ons. |
| `g p` | Go to AI providers. |
| `g s` | Go to Settings. |
| `r` | Refresh the snapshot. |
| `t` | Toggle the theme. |
| `s` | Toggle interface sounds. |
| `Escape` | Close the open dialog, palette, notification panel, mobile navigation drawer, or terminal overlay. |

`g` sequences must be pressed within 900 ms. Plain-key shortcuts are ignored while an input, textarea, select, or content-editable field has focus; modified shortcuts still work.

---

## Dashboard views

### Fleet — operations overview

**Purpose:** confirm the cluster is alive, inspect each agent, and control systemd services.

| Area | Controls and behavior |
| --- | --- |
| Live summary hero | The headline states what needs attention (stopped unit, agent in trouble, running jobs) and links to the alert list. Beneath it: API latency p95 with a sparkline, requests per minute with a sparkline, API success rate, active service count, and the cluster target with uptime. Telemetry measures dashboard API traffic, not LLM inference. |
| Agents | One row per agent: portrait, name, role, current activity, health and food meters, state, and ping. Selecting a row opens the agent inspector: position, dimension, unit, ping, **Copy coordinates**, and **Recall to base**. Only ENI1 accepts dispatched commands; coordinator agents are read-only and say so. |
| Player radar | Contacts relative to ENI1 on a bearing compass, range selector (16/32/64 m), held item, sneak state, distance, and **Expand**. Requires the **Player Radar** add-on; otherwise it explains that and links to Add-ons. |
| Cluster services | One row per systemd unit: state, role, PID, uptime, CPU, memory, and actions. **Start** is immediate; **Restart** and **Stop** require confirmation. |

Primary APIs: `GET /api/status`, `GET /api/fleet`, `GET /api/telemetry`, `GET /api/addons`, `POST /api/service/:name/:action`.

### Grind — collection queue

**Purpose:** queue resource collection and supervise the worker.

| Area | Controls and behavior |
| --- | --- |
| Active job | Target, progress, collected/requested, rate per minute, time left, remaining blocks, status, **Pause**, and **Cancel**. Cancel asks for confirmation and keeps what was already collected. |
| Queue | The server's queue, at most five waiting jobs. Each row shows the target, count, status, and age, plus a remove button. The console does not reorder the queue. |
| Grind history | The last finished jobs with collected/requested, duration, and status. Cancelled jobs keep their partial count. **Re-run** queues the same target and count as a new job; the history itself is server-owned and read-only. |
| Queue a grind | Resource category (`Ores`, `Logs`, `Terrain`, `Crops`), block grid, block-count stepper (1–128) with 16/32/64/128 presets, and **Queue N × resource**. The button is disabled with a reason when the queue is full. |

Primary APIs: `GET /api/grind`, `POST /api/grind` (`queue`, `pause`, `resume`, `cancel`).

### Build — schematic placement

**Purpose:** upload a Sponge schematic and track placement against its material ledger.

| Area | Controls and behavior |
| --- | --- |
| Load a structure | Dropzone or file picker for `.schem`; maximum 8 MB; empty files and non-`.schem` files are rejected. Litematica `.litematic` is not supported. |
| Insertion point | Optional `Origin X/Y/Z`. Leave all three empty to build where the builder is standing; explicit coordinates allow ±29,999,984 and must be all-or-none. |
| Placement options | Rotation `0°`, `90°`, `180°`, `270°`, and **Replace existing blocks**. Off skips occupied cells. |
| Upload | Progress meter and **Upload and start build**. Only one build runs at a time: while a build is active the control is disabled and the reason is shown. |
| Current build | Status, progress, layer, placed/total, rate per minute, time left, skipped blocks, origin, **Pause**, and **Stop build**. Stop asks for confirmation and leaves placed blocks in the world. |
| Materials | The block counts ENI1 reports and which of them are missing. The API reports missing block names, not quantities, so **Open the grind planner** is the next step rather than a fake shortfall count. |
| Build history | The last finished schematics with placed/skipped counts, duration, and status. The list is server-owned and read-only. |

Primary APIs: `GET /api/schematic`, `POST /api/schematic/upload` (`application/octet-stream`), `POST /api/schematic/control`.

### Add-ons — modules and dispatch

**Purpose:** arm deterministic helper modules and send single-packet actions without writing configuration.

| Area | Controls and behavior |
| --- | --- |
| Module summary | Armed, guarded, and managed counts. |
| Toolbar | Module filter by name or description, and an `All` / `Armed` / `Guarded` filter. |
| Modules | Combat: Auto Totem, CPS Booster (4–30 cps slider), Cooldown Mode. Survival: Auto Gapple, Auto Armor, Panic Escape (guarded). Recon: Player Radar, Auto Loot. Economy: Shop GUI, Auto Sell (guarded). System: Schematic Builder and Grind Worker are **managed** and link to Build/Grind instead of toggling here. |
| Toggle behavior | Switching a module writes the add-on config immediately and pushes it to ENI1. Guarded modules ask for confirmation before they are armed, and conflicting modules turn each other off. A failed write restores the previous state. |
| Dispatch groups | Loadout: Equip totem, Eat gapple, Equip armour. Field: Collect drops, Return to base (`/home base`), Return to spawn (`/spawn`). Economy: Open shop, Check balance, Sell surplus. Travel: Connect to Lifesteal (`/server lifesteal`), Random TP (`/randomtp`), Set home (`/sethome`), Return home (`/home`). Actions that need Shop GUI are disabled until it is armed. |
| Kill switch | **Disarm all** turns off every switchable module at once, after a confirmation. |
| Threat ledger | Contact, range, position, held item, and assessment (`Critical` at ≤10 m, `Caution` at ≤20 m, `Clear` beyond). |

Primary APIs: `GET /api/addons`, `POST /api/addons`, `POST /api/addons/action`.

### AI providers — routing and failover

**Purpose:** control the LLM fallback chain and inspect provider readiness.

| Area | Controls and behavior |
| --- | --- |
| KPI shelf | Providers enabled, keys configured, average handshake latency, and models reachable. Latency and model counts appear only after a Test run in this session. **Test all** probes every keyed route. |
| Routing order | The fallback chain, in order, with a name/model/endpoint filter. Each row shows priority, detected provider mark, endpoint, key state, model, model count, latency, timeout, an enable switch, move up/down, **Test endpoint**, and **Edit**. |
| Add and edit | Dialog with display name, model identifier, OpenAI-compatible base URL, timeout, environment key variable, and API key. The base URL resolves the provider identity and can prefill its brand, key variable, and model defaults. The key variable is required and must match `^[A-Z][A-Z0-9_]{1,63}$`. Maximum 20 routes. |
| Save behavior | Every change posts the full table, which restarts `mc-foreman` so the new routing table is live. A failed save restores the previous order. |
| Key handling | Keys are staged in memory, written write-only with `0600` permissions, and never returned to dashboard clients. Clearing a key is a staged action. **Test endpoint** stays disabled until a key is stored. |
| Fallback rules | P1 first; on HTTP 429, 500, or timeout, try the next enabled route. Disabled routes receive no traffic. |

Primary APIs: `GET /api/providers`, `POST /api/providers`, `POST /api/providers/test`.

### Settings — runtime and profiles

**Purpose:** edit the settings that actually drive the running process and switch agent profiles.

| Area | Controls and behavior |
| --- | --- |
| Saved vs running | Compares `settings.js` with the values the running process reports. Drift shows as `restart to apply`, and **Restart ENI1 to apply** asks for confirmation. |
| Network | Host, port, Minecraft version, authentication (`offline`/`microsoft`), and the **ViaProxy bridge** toggle. Enabling ViaProxy reveals bridge host, port, and client version fields. |
| Agent | MindServer port, base profile, comma-separated chat allow-list, code timeout, spawn timeout, **Load memory on boot**, **Narrate behaviour**, **Open the console on boot**, and **Allow insecure coding**. |
| Save behavior | **Save** writes changed fields without restarting. **Save and restart ENI1** confirms, writes, then restarts `mc-foreman` only. **Discard** drops the local edits. |
| Agent profiles | Every profile the supervisor reports, with its model and file name. Switching asks for confirmation and restarts the foreman; grind and schematic state persist. |
| Maintenance | **Restart mc-foreman** (or **Start** when it is down) from a dedicated panel. |

Primary APIs: `GET /api/config`, `POST /api/config`.

---

## Dashboard API

All `/api/*` routes require the dashboard token when `DASHBOARD_TOKEN` is set; otherwise they are loopback-only. JSON errors use `{ "error": "..." }`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/state` | Legacy aggregate: service states, coordinator status, log tails, root, version, uptime. |
| `GET` | `/api/status` | Service summaries, agent count, uptime, effective target. |
| `GET` | `/api/fleet` | Agent fleet, profiles, active profile. |
| `GET` | `/api/telemetry` | Dashboard API hits/misses, p50/p95 latency, throughput, last sweep. |
| `GET` | `/api/config` | `settings.js`, `bots/config.json`, environment, effective values, profiles, active profile, version. |
| `POST` | `/api/config` | Patch settings/bots/env/profile; restart only affected services. |
| `GET` | `/api/profiles` | Discovered agent profiles. |
| `GET` | `/api/version` | Dashboard name, version, port, host, root. |
| `POST` | `/api/service/:name/:action` | `systemctl start|stop|restart` for an allowed service. Also accepts `POST /api/service` with `{ name, action }`. |
| `GET` | `/api/logs?service=…&lines=…` | Journal tail, 1–1000 lines. |
| `GET` | `/api/addons` | Per-agent add-on config and live telemetry. |
| `POST` | `/api/addons` | Patch add-on config; applies live or queues for reconnect. |
| `POST` | `/api/addons/action` | Dispatch an add-on action or raw command. |
| `GET` | `/api/grind` | Current job, queue, history, agent status, last seen. |
| `POST` | `/api/grind` | Queue, pause, resume, or cancel a grind job. |
| `GET` | `/api/schematic` | Current build and last ten archived builds. |
| `POST` | `/api/schematic/upload` | Upload `.schem` as `application/octet-stream`; query: `name`, `x`, `y`, `z`, `rotation`, `replace`. |
| `POST` | `/api/schematic/control` | Pause, resume, or cancel the current build. |
| `GET` | `/api/providers` | Provider table with `keyConfigured` flags. |
| `POST` | `/api/providers` | Replace the routing table, stage/clear keys, optionally restart foreman. |
| `POST` | `/api/providers/test` | Probe a provider `/models` endpoint, falling back to a minimal `/chat/completions` request. |

Schematic uploads are limited to 8 MB. Grind counts are limited to 1–128. The grind queue accepts at most five waiting jobs. Provider tables accept 1–20 entries.

---

## Ports

| Port | Service | Notes |
| --- | --- | --- |
| `56730` | Minecraft server target | Checked-in `settings.js` target, not a listener started by this repo. |
| `8080` | MindServer UI/API | Checked-in `settings.js`; loopback by default. |
| `8091` | MindServer in `settings.linux.js` | Linux template only. |
| `8092` | Yozakura dashboard | Default `DASHBOARD_PORT`; loopback by default. |
| `8093` | Dashboard mock server | Front-end development only. |
| `25568` | ViaProxy client-facing port | Used only when `via_proxy.enabled` is true. |
| `3005+` | Prismarine bot viewer | Base `render_bot_view_port`; disabled by default. |

---

## Reliability and security details

### Movement and protocol compatibility

`src/utils/mcdata.js` installs a movement shim:

- Position/look writes are throttled to at least 50 ms apart to avoid Paper/Spigot packet-rate kicks.
- The latest queued movement packet is never dropped.
- Every movement write is paired with a serverbound `tick_end` packet. Modern Paper versions use `tick_end` to reset their per-tick movement guard; older protocols where the packet does not exist are a no-op.
- Player hitbox width can be aligned with the server's reported value.

### Action locking

`src/agent/action_manager.js` generation-guards action state:

- An abandoned action cannot clear a newer action's `executing` flag or label.
- A stuck action keeps the lock held.
- The manager requests a clean restart; if `cleanKill()` throws, it falls back to a hard exit.
- The next action is refused while the old one is still alive, rather than overlapping work.

### Placement and block search

- `placeBlock` refuses interactive support blocks such as chests, hoppers, furnaces, brewing stands, decorated pots, and cauldrons, so placement does not open a GUI instead of placing.
- `getNearestBlocksWhere` clamps distance to 128 and count to 4000, and aborts a runaway scan after roughly 50 ms.

### Prompt and behavior fixes

- Stable prompt sections (`$COMMAND_DOCS`, `$EXAMPLES`) precede volatile sections (`$MEMORY`, `$STATS`, `$INVENTORY`, `$SELF_PROMPT`) to improve provider prompt caching.
- Endermen, zombified piglins, iron golems, and snow golems are no longer treated as hostile.
- The agent detects AuthMe/LimboAuth/nLogin login prompts, rate-limits `/login` retries, and warns when no password is configured.
- MindServer kills an agent process that stays disconnected but alive for 60 seconds, allowing the supervisor to restart it.

### Secrets

- `keys.json`, `auth/`, `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, local logs, jars, bot working directories, and release artifacts are gitignored.
- `ai-providers.json` stores key **names**, not values.
- Dashboard provider keys are written with `0600` permissions and are never returned to clients.
- The built-in MindServer UI accepts a token through `#token=…` or `?token=…` and sends it through Socket.IO `auth`. REST control endpoints require `Authorization: Bearer …` or `?token=…` when `MINDSERVER_TOKEN` is set.
- The same loopback rule applies to MindServer: a non-loopback `MINDSERVER_HOST` without `MINDSERVER_TOKEN` is forced back to `127.0.0.1`.

### What is not a security boundary

- `only_chat_with` limits who the bot converses with; it does not sandbox code or restrict network access.
- Offline auth is a login mode, not authentication.
- The dashboard token is a shared secret, not per-user authorization. Use a reverse proxy with TLS and network restrictions for remote access.
- `allow_insecure_coding: true` with `code_timeout_mins: -1` gives the model unrestricted code execution time. Change both before exposing the bot to untrusted input.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Bot cannot join | Confirm `host`, `port`, `minecraft_version`, and `auth`. For a newer server, configure ViaProxy and enable it in Settings. |
| `unsupported protocol` or handshake failure | The client protocol is pinned to 26.1. Use ViaProxy for newer targets, or install a compatible `minecraft-data` build. |
| Dashboard returns `401` | Add `?token=...` matching `DASHBOARD_TOKEN`, or access it from loopback when no token is set. |
| Dashboard says offline | Check the five systemd units, `DASHBOARD_ROOT` layout, and the supervisor logs. |
| Service buttons fail | The dashboard calls `systemctl`; the units must exist and the dashboard user needs permission. |
| Provider shows `Key missing` | Add the key in Providers, or define the named variable in `keys.json` / the process environment. |
| Build pauses with shortages | Restock the missing materials; the worker pauses instead of skipping blocks. |
| Build upload rejected | Use a Sponge `.schem` under 8 MB. `.litematic` is not supported. |
| Grind queue full | At most five waiting jobs; wait for the worker or remove one. |
| Keys not detected | `keys.json` is local and gitignored. Restart the process after adding a new environment variable. |

---

## Docker

The Docker image uses Node 22 and runs `npm start`:

```bash
docker build -t mindcraft .
docker run --rm -it \
  -e MINDSERVER_TOKEN='replace-me' \
  -v "$PWD/settings.js:/app/settings.js" \
  -v "$PWD/keys.json:/app/keys.json" \
  -v "$PWD/profiles:/app/profiles" \
  -v "$PWD/bots:/app/bots" \
  -p 127.0.0.1:8080:8080 \
  mindcraft
```

`docker-compose.yml` requires `MINDSERVER_TOKEN` and disables auto-open inside the container. The optional ViaProxy service is behind the `viaproxy` compose profile. Inside a container, the MindServer must bind `0.0.0.0` for published ports to work, so the token is mandatory.

---

## License and upstream

This project is a modified fork of Mindcraft by Kolby Nottingham and contributors, distributed under the MIT License. The original copyright notice is preserved in [`LICENSE`](LICENSE).

- Upstream: <https://github.com/mindcraft-bots/mindcraft>
- Upstream FAQ: <https://github.com/mindcraft-bots/mindcraft/blob/main/FAQ.md>
- This fork: <https://github.com/chobesujal24/mindcraft>

The dashboard, worker surfaces, provider routing, and hardening changes in this repository are deployment-specific. Upstream-compatible fixes should be proposed upstream; personal configuration, prompts, and infrastructure details should stay in this fork.
