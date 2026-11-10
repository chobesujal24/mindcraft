# Mindcraft — ENI1 / Yozakura Field Console

A customized [Mindcraft](https://github.com/mindcraft-bots/mindcraft) 0.1.4 deployment built around **ENI1**, a Minecraft agent that runs on Mineflayer and an LLM backend. This fork adds a Linux control dashboard, a persistent grind/build worker surface, provider failover, protocol and movement hardening, and an offline regression suite.

- Repository: <https://github.com/chobesujal24/mindcraft>
- Runtime: Node.js + Mineflayer + an OpenAI-compatible LLM provider
- Checked-in target: Minecraft **26.1**, offline auth, `127.0.0.1:56730`
- Control UI: **Yozakura** dashboard on `127.0.0.1:8092` (Linux) and the built-in MindServer UI on `127.0.0.1:8080`

> [!WARNING]
> `settings.js` currently sets `allow_insecure_coding: true` and `code_timeout_mins: -1`. The model can write and execute code on the host, with no code timeout. Do not connect this bot to public servers with coding enabled, and do not expose the dashboard or MindServer to the internet without a token and a TLS-terminating reverse proxy.

---

## What this fork adds

| Area | Change |
| --- | --- |
| Dashboard | Six-view React/TypeScript SPA (Fleet, Grind, Build, Add-ons, AI providers, Settings) plus a legacy shell, served by a dependency-free Node supervisor. |
| Fleet control | Live agent cards, health/food, coordinates, ping, player radar, systemd service start/restart/stop, and a guarded **Restart foreman** action. |
| Work queues | Persistent Grind jobs and Sponge schematic builds with pause/resume/abort, progress reconciliation, material ledger, shortages, and history. |
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
| `code_timeout_mins` | `-1` | No code timeout. The dashboard's numeric field accepts 1–120 and requires a valid value before saving. |
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
- **Save & Restart** writes the table and restarts `mc-foreman`.

### Self-prompting

The agent supports continuous goal-driven self-prompting:

- `!goal <prompt>` starts a self-prompt loop. If a conversation is active, the goal is staged as paused.
- Each loop response must contain a command. After three consecutive responses without one, the loop stops and reports it in chat.
- `!endGoal` stops self-prompting and the current action.
- The loop uses a 2-second cooldown and restarts automatically when the agent is idle.
- The current goal is injected into the profile prompt through `$SELF_PROMPT`; self-prompt state is included in agent save data and restored when memory is loaded.

---

## Yozakura control dashboard

The dashboard is the Linux control plane for the deployed cluster. It is a single-file React SPA served by `deploy/linux/dashboard/server.js`; the supervisor uses only Node built-ins and reads `public/index.html` per request.

### Build

```bash
cd deploy/linux/dashboard/app
npm ci
npm run build
```

`npm run build` runs `tsc --noEmit` and Vite, then writes a single offline-capable HTML bundle to `deploy/linux/dashboard/public/index.html`. No external asset requests are made by the page.

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
http://127.0.0.1:8092/?token=replace-with-a-long-random-token#fleet
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
| `/#fleet` | Fleet. |
| `/#grind` | Grind. |
| `/#build` | Build. |
| `/#addons` | Add-ons. |
| `/#providers` | AI providers. |
| `/#settings` | Settings. |
| `/?tab=legacy` | Legacy dashboard (`public/legacy.html`). |
| `/legacy` | Same legacy dashboard. |

View changes use `history.replaceState` and stay on the same path, so the token query string is preserved. The SPA does not need a server-side rewrite rule.

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

- **Sidebar**: Yozakura brand, cluster status, agent/core/add-on counts, core availability meter, navigation, Settings, Console, Command palette, and Legacy shell.
- **Top bar**: current view breadcrumb, API status, last-update time, core service count, API p95, theme toggle, sound toggle, refresh, Command palette, notifications, and **Restart foreman**.
- **Tabs**: Fleet, Grind, Build, Add-ons, Providers, Settings.
- **Notifications**: service failures, build material shortages, active grind progress, pending action errors, offline state, and an all-clear state.
- **Confirmation dialogs**: destructive or restarting actions require confirmation, including service stop/restart, grind abort, build abort, provider save/restart, profile switch, add-on bulk changes, and foreman restart.
- **Offline behavior**: the SPA polls eight endpoints every 5 seconds. Partial failures show a degraded bar; repeated total failures show the last confirmed snapshot, an offline bar, and exponential backoff up to 30 seconds. Actions remain queued/persisted where the backend supports it.
- **Themes**: `yozakura` (dark) and `hanami` (daylight). Preferences are stored in `localStorage`.
- **Terminal dock**: per-service log tabs, 4-second log polling, CRT toggle, command history, quick commands, and direct dispatch.
- **Command palette**: navigation, refresh, terminal, restart `mc-foreman`/`mc-cluster`, theme, sound, and legacy interface.
- **Radar lightbox**: expanded player radar with range control and ENI1 coordinates.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+K` | Toggle the command palette. |
| `?` | Open the command palette. |
| `Ctrl/Cmd+J` | Toggle the terminal dock. |
| `g f` | Go to Fleet. |
| `g g` | Go to Grind. |
| `g b` | Go to Build. |
| `g a` | Go to Add-ons. |
| `g p` | Go to AI providers. |
| `g s` | Go to Settings. |
| `Escape` | Close the open dialog, palette, notification panel, mobile navigation drawer, or terminal overlay. |

`g` sequences must be pressed within 900 ms. Plain-key shortcuts are ignored while an input, textarea, select, or content-editable field has focus; modified shortcuts still work.

---

## Dashboard views

### Fleet — operations overview

**Purpose:** confirm the cluster is alive, inspect each agent, and control systemd services.

| Area | Controls and behavior |
| --- | --- |
| Command hero | Connection chip (`Bot connected`, `Telemetry stale`, `Bot offline`, `Offline snapshot`), agent/profile/radar summary, **Queue grind**, **Upload build**, **Open radar**. |
| Cluster pulse | API p95 latency and request throughput sparklines, success/error counts, last sweep. Measures dashboard API traffic, not LLM inference. |
| Summary metrics | Agents reporting, core services active, API p95, current grind progress. |
| Agents | One card per agent: name, dimension, health/food bars, coordinates, ping, current activity, state chip. Selecting a card targets the radar; **Show on radar** scrolls to it. |
| Player radar | Contacts relative to the selected agent, range selector, held item, sneak state, distance, **Expand**. Requires the **Player Radar** add-on and fresh telemetry; otherwise shows why it is unavailable. |
| Cluster services | Table of service, state, PID, CPU, memory, uptime, and actions. Start is immediate; restart and stop require confirmation. Optional services are labeled and excluded from core availability. |

Primary APIs: `GET /api/status`, `GET /api/fleet`, `GET /api/telemetry`, `POST /api/service/:name/:action`.

### Grind — collection queue

**Purpose:** queue resource collection and supervise the worker.

| Area | Controls and behavior |
| --- | --- |
| Queue a grind | Resource category filter (`All`, `Mining`, `Farming`), target grid, block-count stepper (1–128), **Queue N × resource**. The job is persisted and starts when the worker reconnects. |
| Active job | Status, progress ring, collected/requested, rate per minute, ETA, elapsed time, job ID, **Pause**, **Resume**, **Abort**. Abort preserves partial progress in history. |
| Queue | Maximum five waiting jobs. Each row shows target, radius, deposit, status, count, and a remove button. |
| Grind history | Last ten jobs with target, requested, collected, status, and finish time. Cancelled jobs keep their partial count. |
| Offline handling | If the agent is offline or telemetry is stale, a running job is reported as paused with a reconnect message. |

Primary APIs: `GET /api/grind`, `POST /api/grind` (`queue`, `pause`, `resume`, `cancel`).

### Build — schematic placement

**Purpose:** upload a Sponge schematic and track placement against its material ledger.

| Area | Controls and behavior |
| --- | --- |
| Load a structure | Dropzone or file picker for `.schem`; maximum 8 MB; empty files and non-`.schem` files are rejected. Litematica `.litematic` is not supported. |
| Insertion point | Optional `Origin X/Y/Z`. Leave blank to anchor to ENI1's position with an X/Z offset of +2; explicit coordinates allow ±29,999,984. |
| Placement options | Rotation `0° north`, `90° east`, `180° south`, `270° west`; **Preserve** or **Replace** existing blocks. |
| Upload | Progress meter with transfer speed and ETA; **Upload & begin build**. The server rejects a second build while one is queued/running/paused/blocked. |
| Current build | Status, progress ring/bar, size, rotation, preserve/replace mode, placed count, blocks/minute, ETA, elapsed, material ledger, and shortages. Shortages pause placement instead of skipping blocks. |
| Build actions | **Pause**, **Resume**, **Abort**. Abort stops after the current placement tick and archives the job as cancelled. |
| Build history | Last ten schematics with origin, rotation, placed/total, status, and finish time. |

Primary APIs: `GET /api/schematic`, `POST /api/schematic/upload` (`application/octet-stream`), `POST /api/schematic/control`.

### Add-ons — modules and dispatch

**Purpose:** arm deterministic helper modules and send single-packet actions without writing configuration.

| Area | Controls and behavior |
| --- | --- |
| Toolbar | Search modules/categories/risk, **Arm all**, **Standby all**, armed count, guarded count, total/switchable count. Bulk changes require confirmation. |
| Modules | Combat: Auto Totem, CPS Booster (4–30 cps slider), Cooldown Mode. Survival: Auto Gapple, Auto Armor, Panic Escape (guarded). Recon: Player Radar, Auto Loot. Economy: Shop GUI, Auto Sell (guarded). System: Schematic Builder and Grind Worker are **managed** and link to Build/Grind instead of toggling here. |
| Toggle behavior | Switches write through a 250 ms debounce. The UI keeps the last confirmed state on failure and offers an inline retry. |
| Dispatch groups | Survival: Equip totem, Eat gapple, Equip armour. Recon: Collect drops, Return to base (`/home base`), Return to spawn (`/spawn`). Economy: Open shop, Check balance, Sell surplus. Server travel: Connect to Lifesteal (`/server lifesteal`), Random TP (`/randomtp`), Set home (`/sethome`), Return home (`/home`). |
| Threat ledger | Contact, range, position, held item, and assessment (`Critical` at ≤10 m, `Caution` at ≤20 m, `Clear` beyond). |
| Player radar | Mini radar and **Open radar** lightbox; contacts refresh about once per second when Player Radar is armed. |

Primary APIs: `GET /api/addons`, `POST /api/addons`, `POST /api/addons/action`.

### AI providers — routing and failover

**Purpose:** control the LLM fallback chain and inspect provider readiness.

| Area | Controls and behavior |
| --- | --- |
| KPI shelf | Active routes, primary route, API keys ready/staged, average probed latency. |
| Filters | `All`, `Active`, `Bypassed`, `Needs Key`; search by name, model, or endpoint. |
| Add Provider | Dialog with quick presets, display name, model identifier, OpenAI-compatible base URL, API secret, environment key variable, timeout, and connection test. Maximum 20 routes. |
| Provider rows | Priority number, drag handle, enable/disable routing, endpoint copy, key state, latency/throughput/context metrics, endpoint health, **Test**, inline edit, move up/down, and remove. Reordering is disabled while filters are active. |
| Sticky commit bar | **Reset** and **Save & Restart**. Saving requires confirmation and restarts `mc-foreman`. |
| Key handling | Keys are staged in memory, written write-only with `0600` permissions, and never returned to dashboard clients. Clearing a key is a staged action. |
| Fallback rules | P1 first; on HTTP 429, 500, or timeout, try the next enabled route. Disabled routes receive no traffic. |

Primary APIs: `GET /api/providers`, `POST /api/providers`, `POST /api/providers/test`.

### Settings — runtime and profiles

**Purpose:** edit the settings that actually drive the running process and switch agent profiles.

| Area | Controls and behavior |
| --- | --- |
| Saved vs running | Compares `settings.js` with the service environment. `mc-cluster.env` wins; environment overrides are labeled `ENV`, and drift shows as “Restart pending.” |
| Network | Host, port, Minecraft version, authentication (`offline`/`microsoft`), and **ViaProxy bridge** toggle. Enabling ViaProxy reveals host, port, and bot client version fields. |
| Agent | Base profile, comma-separated chat allow-list, **Load memory at boot**, **Narrate behaviour in chat**. |
| Safety | **Allow insecure coding** (`Guarded`/`Elevated`), code timeout (1–120 minutes), spawn timeout (10–600 seconds), and **Open dashboard at spawn**. |
| Save behavior | **Save** writes changed fields without restarting. **Save & restart ENI1** confirms, writes, then restarts `mc-foreman` only. |
| Agent profiles | Live profile card, search, all discovered profiles, model/file metadata, and **Use**. Switching requires confirmation and restarts the foreman; grind and schematic state persist. |

Primary APIs: `GET /api/config`, `POST /api/config`, `GET /api/profiles`.

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
