export const critique = [
  {
    title: "One card shape for every job",
    body: "Settings, failure states, telemetry, dispatch and toggles all sit in the same magenta-haired rounded panel. When everything is a card, nothing is a priority. Introduce a surface hierarchy: canvas, panel, inset, control.",
  },
  {
    title: "Four primaries in the header",
    body: "Restart ENI, Terminal, Start Workers and the active tab all compete for attention, while Restart ENI is nearly invisible pink-on-pink. Choose one primary action per view and move supervisor controls into a single command cluster.",
  },
  {
    title: "Broken states are the loudest thing on screen",
    body: "Providers is 90% empty, Grind says 'Could not load job status', Profiles and the radar both read 'unavailable'. A control room must show its populated operating state, with failures as a precise inline status plus retry.",
  },
  {
    title: "Neon soup, not Hanami",
    body: "Magenta #DB2777, emerald green, violet, gold and rose all run at full saturation simultaneously. Sakura should be a single blush signature; gold belongs on one kintsugi detail, not every badge.",
  },
  {
    title: "Typography works against itself",
    body: "Fraunces is used at 16px for section titles while Plus Jakarta and mono clamour beside it, mostly at 11px with low-contrast muted text. A display serif needs size and air; telemetry mono needs to be rare and monospaced only.",
  },
  {
    title: "Structural debt shows through the UI",
    body: "An 8,700-line HTML monolith, 5,500 lines of inline CSS and DOM rebuilt by innerHTML explain the 1px palette jitter, header overflow and inconsistent spacing. Extract tokens and views before restyling.",
  },
];

export const coverage = [
  "Shell: brand, target line, 5 tabs with counters, tools, supervisor actions",
  "Fleet: commander HUD, profile rail, bot grid, radar, services, runtime config",
  "Grind: planner, active job, queue, recent history, all states",
  "Build: schematic upload, origin, rotation, progress, materials, pause/resume",
  "Add-ons: 12 modules, settings sliders, filters, bulk actions, threat table",
  "AI providers: priority ordering, keys, latency, token speed, add and test",
  "Overlays: ⌘K palette, terminal dock, 4K lightbox, toasts, UI sound",
  "Runtime: 5s visibility-aware polling, optimistic actions, no dead buttons",
  "Dual themes: Hanami Daylight and Yozakura Night from one token set",
  "Quality gates: WCAG AA, 60fps, 1440 / 1024 / 390, no regressions",
];

export const tokens = [
  { name: "Void", hex: "#0A090B", use: "night canvas" },
  { name: "Panel", hex: "#121014", use: "night surface" },
  { name: "Ink", hex: "#F3EDE8", use: "night text" },
  { name: "Blush", hex: "#F0AEC0", use: "signature" },
  { name: "Rose", hex: "#D4768F", use: "accent deep" },
  { name: "Gold", hex: "#F0B85A", use: "kintsugi" },
  { name: "Sage", hex: "#A9C9B4", use: "healthy" },
  { name: "Amber", hex: "#E4C690", use: "warning" },
  { name: "Porcelain", hex: "#FAF3F5", use: "day canvas" },
];

export const geminiPrompt = `ROLE
You are a principal product designer, design engineer, and front-end architect. Redesign the "Mindcraft Yozakura // ENI-01" dashboard into an award-winning, quiet-luxury control room. Work inside my existing repository and preserve every capability. Do not ask questions. Decide, build, document briefly.

PRODUCT CONTEXT
- It is a single-page operator console for autonomous Minecraft clusters: a foreman (mc-foreman) plus three to eight cluster workers, deterministic grind jobs, schematic builds, anarchy add-ons, and AI providers.
- Backend: Node/Express on port 8092, serving a static SPA. Endpoints: GET /api/status, GET /api/fleet, GET /api/telemetry, POST /api/service/:name/:action, POST /api/addons. No new services.
- Today the UI is a monolith (~8,700 lines HTML, 5,500 inline CSS) plus blossom-theme.css (~2,300 lines). The client runtime is inline JS: a state store, 5s consolidated polling, DocumentFragment rendering, canvas radar, Web Audio chimes, and a keyboard router.
- Themes: Hanami Daylight (porcelain, rosewater) and Yozakura Night (obsidian, neon sakura). Both must survive as designed themes.
- Tab views: 01 Fleet, 02 Grind, 03 Build, 04 Add-ons, 05 AI Providers. Overlays: command palette, terminal dock, 4K art lightbox, toast stack. Persistent supervisor actions: Restart ENI, Start ENI, Start Workers, Stop ENI, Terminal.

NON-NEGOTIABLE CONSTRAINTS
- Keep all five tabs, all overlays, all endpoints, all controls, and offline operation. No CDN-only dependencies.
- No destructive refactor of server contracts. UI actions call the existing endpoints; when the API is unavailable, show a populated preview state clearly labeled "offline preview" rather than a blocked screen.
- No dead buttons. Every control produces a pending state, a result toast, and an inline failure with retry.
- Artwork ships locally. No hotlinked images.
- Do not use emoji as icons, gradient text, or more than one outer glow per viewport.

AUDIT — FIX THESE EXACTLY
1. Card monotony: every region is the same rounded, pink-hovered panel. Introduce canvas, panel, inset and control surfaces. Panels get a 1px hairline, no gradient borders, one soft shadow.
2. Header overload: four primary-weight actions plus tab fill/underline. One primary per view. Supervisor actions become one compact "ENI" control cluster with Stop behind a confirm.
3. Failure-first composition: the Providers tab is almost entirely blank; the Grind current-job and Profiles cards are 400px of "unavailable". Design the populated state first, then compact inline errors.
4. Accent inflation: magenta, emerald, violet, gold and rose all at full saturation. Use blush #F0AEC0 as the only signature; gold #F0B85A only for one kintsugi divider or medal; sage/amber/red only for status meaning.
5. Type confusion: Fraunces at 16px, 11px low-contrast labels, mono used for prose. Establish a scale and stick to it.
6. DOM/motion defects: 1px hover jitter from rebuilt nodes, header overflow at 1366, glow-breathing on every card. Fix structurally with persistent nodes and shared easing.
7. Information density is inverted: forms are spacious, telemetry is cramped, and the most useful thing (runtime configuration) hides below errors. Put operational truth above settings.
8. Build/Add-ons controls look disabled: dim inputs, invisible placeholders, 38px toggles. Make affordances obvious and touch-safe.

ART DIRECTION — "HANAMI NOCTURNE / INSTRUMENT-GRADE"
Concept: a private Kyoto members' club crossed with a spacecraft ground station. Warm, exact, unhurried. Sakura appears as one photographic moment, one accent, and a whisper of blush light. No cyberpunk neon soup.

IMAGERY — REAL PHOTOGRAPHY ONLY
- Ban illustrated anime portraits, AI character art, and neon concept pieces. The pilot is represented by real editorial photography of a person in kimono at a Kyoto temple lantern; operators are represented by real landscape and architectural photography.
- Shoot list: (1) night cherry blossoms over still water for the fleet hero, (2) a portrait beside a lit stone or temple lantern for the pilot card, (3) Chureito Pagoda with Mount Fuji, (4) Osaka Castle at night, (5) Fushimi Inari torii, (6) a dark ocean wave, (7) Fushimi Inari or Yasaka lantern rows, (8) a single blossom cluster on near-black.
- Source: Pexels or Unsplash, free licence, downloaded locally at 1600–2000px, compressed to under 300KB each. Never hotlink. Keep a credits map and show photographer/source in the lightbox and a colophon.
- Grade in CSS for consistency: saturate 0.72–0.86, brightness 0.62–0.9 for night, one warm overlay at 45% soft-light, hairline inset white ring at 8%.
- Composition: photography is the emotional layer, never the information layer. One landscape hero and one portrait per screen maximum; anywhere text sits on a photo, apply a two-stop scrim and verify contrast.
- Crop with intent (object-position), keep faces above the fold of a card, and never stretch. Use object-cover everywhere. Lazy-load all but the hero and provide explicit width/height or aspect ratio to prevent layout shift.

Tokens, both themes (semantic, not per-component):
Night: canvas #0A090B; shell #0C0A0D; panel #121014; raise #17141A; hover #1C181E; line rgba(255,255,255,.07); line-soft #1E1A21; ink #F3EDE8; ink-dim #AAA2AB; ink-mute #837B86; blush #F0AEC0; blush-hi #FFD0DC; rose #D4768F; gold #F0B85A; sage #A9C9B4; amber #E4C690; danger #E38B95.
Day: canvas #FAF3F5; shell #F6EAEF; panel #FFFFFF; raise #FFF8FA; hover #FDF0F5; line rgba(58,30,44,.1); line-soft #EBD6DF; ink #2A161E; ink-dim #5A3D48; ink-mute #7C6670; blush #D9487F; rose #B03060; gold #9A6E14; sage #286B49; amber #9A5B06; danger #B42318.
Rules: accent on under 5% of pixels. Never colour alone to convey status. Use tokens in both themes rather than hardcoding.

Type:
- Display: Fraunces (variable, opsz 9–144), 400/500. Only at 28px and above. Page titles 36–48, hero statement 44–56, numbers 24–34. Tracking -0.02em.
- UI: Plus Jakarta Sans, 400/500/600. Body 13–14, section titles 15–16/600, buttons 12–13/600.
- Telemetry: JetBrains Mono, 400/500, 9–11px, uppercase 0.12–0.18em. IDs, coordinates, ports, timestamps, commands, versions. Never use mono for navigation or body prose.
- Layout tokens: 4px base, spacing 8/12/16/20/24/32/48; panel radius 14, inset 10, control 8, pill only for status chips; page padding 32–48 desktop, 20 mobile; max content width 1360.

Light and depth:
- One ambient blush radial at 82%/-8% and one cool rim; total opacity under 0.16.
- 2–3% monochrome grain fixed above the background, below content.
- Single shadow token: 0 24px 48px -36px rgba(0,0,0,.85) for night, 0 18px 40px -30px rgba(90,45,60,.35) for day.
- Surface lift on hover is 1px translate plus border lightening, never a glow.
- Artwork always masked with a two-stop gradient so text wins; optional ambience toggle (42% vs 22% art opacity).

SHELL
- 236px left rail on desktop: monogram, "Yozakura / ENI-01", target line, grouped nav (Operations: Fleet, Grind, Build, Add-ons, AI providers; Infrastructure: Agent profiles, Runtime & cluster, Command log; Workspace: Upgrade brief), bottom ENI supervisor cluster (Start / Start workers / Restart / Stop behind confirm) and a fleet-health card showing agents, uptime, version and build hash.
- 60px sticky top bar: breadcrumb with runtime and coordinator status pills (two lines of truth, not two buttons), theme switch (Hanami / Yozakura), sound switch, refresh, ⌘K search trigger, notifications, and one primary "Open terminal" action. Supervisor actions live in the rail or an overflow menu, not the bar.
- Tabs: 5 main views with numeric prefixes and small Japanese sublabels. Active state = one treatment only (fill OR underline). Preserve body[data-active-tab] for the runtime and hash routing so refresh keeps the tab.
- Mobile: rail becomes off-canvas with focus trap; top bar keeps palette, refresh and terminal; filters scroll horizontally; tap targets at least 44px.

SCREEN 1 — FLEET
- Blossom banner: 8/4 split. Left: eyebrow "Operations / Fleet overview", serif headline, one-sentence mission line, a commander HUD with the pilot avatar, name, role, dimension and live state. Right: 4/5 key numbers (agents, median ping, incidents, uptime) and one "Deploy agent" primary. Artwork 4K, masked, with an "Inspect" action that opens the lightbox.
- Agent profile rail: horizontally snap-scrolling persona cards (Athena-Combat, Kitsune-Gather, Shinobi-Stealth, Mount Fuji, Crimson Pagoda, Night Castle). Each shows name, role, current mount, and status; activate with a clear confirm and optimistic pending state; keyboard scroll buttons.
- Bot cluster grid: one card per bot with name + id, health/food icons, XYZ + dimension, ping, state-machine activity, and a mini sparkline. Warning state (e.g. Kanagawa Wave, 91% load) uses amber dot plus text, never red borders.
- 2D tactical radar: 280–340px SVG/canvas with concentric rings, degree ticks, cone sweep, origin pip, labeled bots, hostile markers, and a 32/52-block range switch. Pause drawing when hidden or inactive. Below it, a legend and "last sweep".
- Services table: mc-foreman, mc-cluster, minecraft-server. Columns service, PID, CPU, memory, uptime, actions. Hairline rows, mono numerics, warnings inline. No giant empty panel.
- Runtime & cluster architecture card, collapsible and domain-filtered (All domains / Network / Engine / Cluster). Three columns: Minecraft target (host, port, version, auth mode, proxy route), Mindcraft engine (MindServer port, init message, only chat with, base profile, language, auto open UI), Bot cluster (base origin X/Y/Z, login stagger ms, start paused, pathfinder engine, protect radius, builder auto start). Save-only vs Save & restart must be visually distinct; show a dirty-state chip and automatic .bak note.

SCREEN 2 — GRIND
- Header: "Grind jobs", one sentence, queue capacity chip (up to 5 waiting) and worker target selector.
- Plan-a-job card: resource select (stone, oak logs, ancient debris, wheat, gunpowder, etc.), block count stepper 1–128, collection radius, deposit destination, tool whitelist, danger note. Primary "Queue collection job". Validate inline.
- Current job: populated by default with a deterministic progress bar, collected/target, elapsed/ETA, current layer or radius, assigned bot, pause/resume/abort. Progress must be derived from start time so a reconnect restores it. Never a blank 400px card.
- Up next: ordered queue with reorder up/down, remove, and worker assignment.
- Recent jobs: last 10 completed or cancelled with duration, blocks, and outcome.
- States to design: empty (helpful, 120px max), queued, active, paused, cancelled, API error (single inline row + retry).

SCREEN 3 — BUILD (SCHEMATIC)
- Upload card: drag-and-drop plus picker accepting .schem and .litematic, 8MB cap with instant validation, file chip with remove.
- Controls: origin X/Y/Z (blank = beside ENI1, explain it), rotation segmented control 0/90/180/270, "replace mismatching blocks" as a proper checkbox with helper text.
- Primary "Upload & build". Then a build-progress card: stage, placed/total with percentage, layer x/y, ETA, material shortages, pause/resume/abort, and a calm paused reason (missing block, chest empty). Material list shows have/need and nearest chest counts.
- Format notes: limits and what is not copied, in a low-emphasis inset, not a warning banner.

SCREEN 4 — ADD-ONS
- Header: agent breadcrumb, title, status, "Arm combat suite" primary, "Enable all", "Standby all", search, and category chips: All, Combat, Survival, Economy, Recon, Movement, plus counts.
- Persist the pilot art card (sticky on desktop) with name, role, loadout tags, inspect artwork, and one sentinel note. Keep it one artwork moment, not a neon frame.
- Telemetry strip: vitality, saturation, totems, gapples, treasury, active seals; value + unit + thin meter + a note that is actually different per metric.
- Module cards/rows (12): auto-totem, cps booster, auto-gapple, auto-armor, shopgui auto-sell, panic escape, player radar, auto-loot, killaura, elytra fly, scaffold, esp. Each needs category, plain-language description, risk tag, state text, and a 44px switch. Modules with settings expose them inline: CPS 1–20, heal threshold 1–20 HP, radius, whitelist. Toggling updates counts and the local event log.
- Dispatch console: three labelled groups (economy, combat & gear, warp & shell) with 8–12 commands, one primary per group maximum, keyboard accessible, pending/ack feedback.
- Nearby players & threat table: radar thumbnail + columns player, distance, coordinates, held item, stance, threat. Populated with believable rows.

SCREEN 5 — AI PROVIDERS
- Header: "AI provider priority", explanation of top-to-bottom fallback, Reload, Add provider, and the primary "Save & restart ENI".
- Provider rows: enabled toggle, drag/move up-down, provider mark, name and model, masked key with reveal/copy, base URL, latency p50, tokens/sec, context usage, test-connection button with pending/success/fail, and a "Primary" chip on the first enabled. Include Gemini 3.8 Flash High, DeepSeek v4.1 Flash 1017, and a local critic.
- Add-provider form: base URL, model, API key (blank keeps saved key), capability tags. Validate URL and required fields.
- Side panels: routing summary, spend today/week with a small bar chart, key safety note. Loading, offline and empty states are compact and inline.
- Reordering changes save state; saving shows confirm, pending, success toast; failures restore previous order.

OVERLAYS & INTERACTION
- Command palette: ⌘K / Ctrl+K, grouped (Navigate, Actions, Agents, Views), arrow/enter/escape, focus trap, persistent list nodes so hover never reflows by 1px, empty state with one helpful line. Execute and close.
- Terminal dock: slide-up, 280–360px, ANSI parsing, command history with arrows, help/status/fleet/agents/enable/disable/clear, autoscroll, close on Esc. Looks like a designed panel, not a joke.
- Lightbox: avatar or artwork opens the 4K key visual; close/zoom/pan, Esc, focus restored to the trigger.
- Toasts: spring entry, max 3, 3.5s, hairline, icon plus message, progress timer, dismiss. aria-live polite.
- Sound: opt-in pentatonic chimes synthesized with Web Audio (toggle, dispatch, error). Off by default? Keep the last choice in localStorage. Never autoplay.
- Keyboard: ⌘K palette, T terminal, Esc closes top overlay, / focuses search, arrows navigate lists. All icon buttons have labels.

SYSTEM BEHAVIOUR
- Central store (or reducer) with view, theme, fleet, services, jobs, schematic, addons, providers, toasts and pending flags.
- One 5s poll for /api/status + /api/fleet + /api/telemetry; skip entirely when document.hidden; refresh on visibilitychange.
- Optimistic actions with pending/success/error; inline retry; never leave a spinner forever.
- Rendering: React (or persistent DOM updates). No innerHTML rebuilds for interactive lists. Batched updates in one frame. rAF-throttle canvas and drag.
- Persist theme, sound, active tab, and add-on settings in localStorage. Progress derives from timestamps.
- Format numbers with Intl; times in local timezone with JST reference where the product currently uses it.

ACCESSIBILITY & PERFORMANCE BARS
- WCAG AA: 4.5:1 body, 3:1 large text and UI glyphs; focus visible on every control; semantic landmarks and headings; aria-pressed/checked/live; no colour-only state.
- 44px touch targets; no horizontal scroll at 390; no clipped header at 1024 and 1366.
- Backdrop blur 10px max, saturate 120% max; no SVG convolution filters.
- 60fps radar idle; bundle under 400KB gzip if split; no layout shift above 0.05; fonts preloaded with display swap.

SUBAGENTS — RUN IN PARALLEL, RECONCILE CENTRALLY
Ownership map; no subagent edits another's files.
1. AUDIT agent (no code): produce the capability checklist (tabs, overlays, endpoints, controls, states) and a defect table mapping every audit item to a fix. Output as JSON fixtures for the rest.
2. DESIGN SYSTEM agent: tokens.css for both themes, type scale, primitives (Button, Panel, Chip, Field, Toggle, Slider, Table, Sparkline, Radar, Toast, Dialog, Tabs), state matrices. Ship a one-page reference.
3. SHELL agent: layout, rail, top bar, tab router with hash, command palette, terminal, lightbox, toasts, sound hook, responsive behaviour. Depends on tokens.
4. FLEET agent: banner, profile rail, bot grid, radar, services, runtime config. Use only design-system primitives.
5. OPS agent: Grind + Build screens and their state machines, with deterministic timers and live-restore.
6. ARMORY agent: Add-ons module catalog, sliders, bulk actions, dispatch console, threat table.
7. INTELLIGENCE agent: Providers priority list, keys, add/test flow, metrics, spend.
8. QA agent: after integration, screenshot 1440/1024/390, keyboard walkthrough, contrast check, capability parity checklist, and a defect list with file/line. Do not fix without approval.

WORKFLOW
Phase 1 — Audit and plan. Return the capability checklist, defect table, tokens, and component inventory. Under 500 words plus fixtures.
Phase 2 — Design system and shell, reviewed at three widths.
Phase 3 — Screens in parallel against one token contract; no new colours.
Phase 4 — Integrate and QA: parity, states, focus, overflow, performance.
Phase 5 — Polish: copy, optical alignment, empty/error states, remove any preview-only scaffolding.

ACCEPTANCE
- A new operator can say what the fleet is doing, which job is running, and the one next action within three seconds on every tab.
- No tab is mostly empty, no giant error card, no two loud primaries, no neon rainbow.
- Every endpoint-backed control has pending/success/error; every list has hover/focus/active; every toggle shows text state.
- Both themes pass AA and look intentional in screenshots.
- The result is portfolio-hero credible: one artwork moment, confident serif, precise telemetry, calm depth.

OUTPUT
Production-ready files, diff-style, plus a five-line rationale per file and a parity checklist. Ship the implementation. Do not stop at a plan.`;

export const deepseekPrompt = `TASK
Refactor the Mindcraft Yozakura ENI-01 dashboard from an 8,700-line HTML monolith plus 5,500 inline CSS and inline JavaScript into a maintainable, premium interface. Preserve the Node/Express backend on :8092, all five tabs, all overlays, all endpoints and offline operation. No redesign of the API. No visual placeholders.

ARCHITECTURE
- Keep the SPA deployable to public/. Preferred: Vite + React + TypeScript with vite-plugin-singlefile so the build is one offline-capable dist/index.html; otherwise ES modules with no external runtime deps.
- Move theme CSS out of index.html into blossom-theme.css (tokens + primitives), then component styles via utility classes or CSS modules. Delete the legacy dashboard-base.css link if unused; keep the file for reference only.
- Structure:
  src/theme/tokens.css                — both themes, semantic tokens only
  src/ui/{Button,Panel,Chip,Field,Toggle,Slider,Table,Sparkline,Radar,Toast,Dialog,Tabs,Progress}.tsx
  src/shell/{AppShell,Sidebar,TopBar,TabNav,CommandPalette,TerminalDock,Lightbox,ToastStack}.tsx
  src/views/{Fleet,Grind,Build,Schematic? (Build covers schematic),Addons,Providers}.tsx
  src/data/{fixtures.ts,api.ts,types.ts}
  src/hooks/{usePolling,useSound,useToasts,useLocalStorage,useKeyboardNav,useConfirm}.ts
  src/state/store.ts                  — single reducer or Zustand-free context
- Refactor one view at a time behind a feature flag (?tab=legacy) so a failed pass can be reverted.

TOKENS (implement both)
Night: --bg:#0A090B; --shell:#0C0A0D; --panel:#121014; --raise:#17141A; --hover:#1C181E; --line:rgba(255,255,255,.07); --line-soft:#1E1A21; --text:#F3EDE8; --dim:#AAA2AB; --mute:#837B86; --accent:#F0AEC0; --accent-hi:#FFD0DC; --rose:#D4768F; --gold:#F0B85A; --ok:#A9C9B4; --warn:#E4C690; --danger:#E38B95.
Day: --bg:#FAF3F5; --shell:#F6EAEF; --panel:#FFFFFF; --raise:#FFF8FA; --hover:#FDF0F5; --line:rgba(58,30,44,.10); --line-soft:#EBD6DF; --text:#2A161E; --dim:#5A3D48; --mute:#7C6670; --accent:#D9487F; --accent-hi:#B03060; --rose:#B03060; --gold:#9A6E14; --ok:#286B49; --warn:#9A5B06; --danger:#B42318.
Type: Fraunces display only ≥28px; Plus Jakarta Sans UI 12–16px; JetBrains Mono telemetry 9–11px uppercase. Radii 14/10/8. One shadow token per theme. 2.5% grain overlay. Accent under 5% of pixels. Sage/amber/danger carry status meaning and are accompanied by text.
Forbidden: saturated magenta #DB2777 at scale, emerald #22c55e, violet gradients, per-card glow, gradient text, nested bordered cards, emoji icons, rounded-full buttons (except status chips).

API CONTRACT (do not change)
GET /api/status -> { ok, services: [{name,state,pid,cpu,mem,uptime}], botCount, uptime, target }
GET /api/fleet -> { bots: [{id,name,health,food,x,y,z,dimension,ping,activity,state}], profiles, activeProfile }
GET /api/telemetry -> { hits, misses, latency:{p50,p95}, throughput, lastSweep }
POST /api/service/:name/:action  body {action: start|stop|restart}
POST /api/addons                 body {id, enabled, settings}
Provider routes already present: list/add/reorder/test/save-and-restart; keep their shapes, add types.
Wrap every call in api.ts with timeout (8s), typed errors, AbortController and a correlation id. Never throw into render.

STATE & BEHAVIOUR
- store: view, theme ('hanami'|'yozakura'), sound, fleet, services, telemetry, jobs, build, addons, providers, toasts, pendingByAction.
- One 5s poll (status+fleet+telemetry batched). Skip while document.hidden; refresh on visibilitychange; exponential backoff on failure to 30s; expose "offline preview" mode after two failures with a persistent retry button.
- Actions are optimistic: set pending -> request -> reconcile server response; on failure revert and show a toast plus an inline retry on the affected control. Disable only the affected control, not the page.
- Add-on toggles: debounce 250ms per module, persist successful state to POST /api/addons, keep last-known state on failure.
- Provider reorder: local order until Save; dirty chip; save posts order + restart and shows a blocking-free toast on success.
- Build/grind progress derives from startedAt + rate so a refresh restores the real value.
- Persist theme, sound, active tab in localStorage. Active tab mirrors location.hash (#fleet, #grind, #build, #addons, #providers) and restores on reload.
- Format with Intl.NumberFormat and Intl.DateTimeFormat. Use tabular numerals. Never show NaN or undefined.

PRIMITIVES — REQUIRED STATES
Button: primary, secondary, quiet, danger; sm/md/lg; loading spinner replacing the icon; disabled with reason title. Panel: hairline, optional inset header, no nested panel. Field: label, hint, error, required, disabled, mono for host/port. Toggle: 44px hit area, aria-checked, text state. Slider: value readout, keyboard support, min/max/step, aria-valuetext. Table: sticky header, row hover, empty row, numeric alignment. Toast: max 3, aria-live, auto-dismiss 3.5s. Dialog: focus trap, Esc, restore focus. Tabs: role=tablist, one active treatment, hash sync.

VIEW REQUIREMENTS
Fleet: banner + commander HUD; profile rail (snap scroll, activate with confirm); bot grid (health, food, XYZ, dimension, ping, activity, warning state); radar (canvas, 32/52 range, sweep, blips, hidden-tab pause, rAF throttling, DPR scaling); services table (PID, CPU, mem, uptime, actions with pending); runtime config (3 domain columns, dirty tracking, save / save & restart / save & restart all, .bak note).
Grind: planner (resource, count 1–128, radius, deposit, tools), queue, current job with determinate progress and pause/resume/abort, recent history. Deterministic and restored from state.
Build: file picker + drag/drop (.schem/.litematic, 8MB), origin XYZ blank=beside ENI1, rotation 0/90/180/270, replace checkbox, upload & build, progress (placed/total, layer, ETA, shortages), pause/resume/abort, format notes. Abort confirms.
Addons: 12 modules with categories, descriptions, risk, switch, optional settings slider; search + category filters; counts; enable/standby all with confirm; dispatch groups with pending/ack; threat table with radar thumbnail.
Providers: ordered list with enabled toggle, move up/down (and drag), masked key reveal/copy, base URL, model, latency, tokens/s, context %, test with pending/result, add form, save & restart ENI. Include Gemini 3.8 Flash High, DeepSeek v4.1 Flash 1017, local critic.
Shell: sidebar nav + ENI supervisor cluster, top bar with status pills, theme, sound, refresh, palette, notifications, one primary terminal action, off-canvas mobile nav. Terminal dock (help/status/fleet/agents/enable/disable/clear, history), palette (⌘K, grouped, keyboard), lightbox, toasts, optional synthesized chime via Web Audio (opt-in, persisted).

QUALITY GATES
- No regressions: every tab, button, endpoint and overlay in the audit checklist exists and works in preview mode.
- No dead buttons; all pending states resolve or time out with retry.
- AA contrast in both themes; focus-visible everywhere; icon buttons labelled; status includes text.
- No horizontal scroll at 390; header never overflows at 1024/1366; 44px targets.
- No 1px hover jitter: persistent DOM nodes, stable borders on base state, no innerHTML rebuilds for lists.
- Backdrop blur ≤10px; no SVG convolution; radar 60fps idle; no CLS above 0.05.
- npm run build (or node build task) passes; single-file output under 400KB gzip if feasible; fonts display=swap.

VERIFY BEFORE HANDOFF
1. Screenshot each tab in both themes at 1440, 1024, 390.
2. Keyboard walkthrough: tab order, palette, terminal, lightbox, toggles, sliders.
3. Simulate endpoint failure and confirm inline retry plus offline preview, no blank screens.
4. Confirm restart/stop confirmations and that disabling only affects the relevant control.
5. Run the capability checklist against the original UI. Report gaps with file and line.

OUTPUT
Commit-ready code in the structure above, types first, no new runtime dependencies beyond React. Keep components under 250 lines. Write a short MIGRATION.md with the view-by-view cutover, endpoint map, and rollback flag. Do not ask questions.`;

export const photography = [
  {
    title: "Use photographs, not illustrations",
    body: "Real documentary and editorial photography of Japan reads as a real product. Illustrated pilot art makes the console feel like a fan project. Remove AI anime artwork entirely.",
  },
  {
    title: "Grade every image the same way",
    body: "Saturate 0.72–0.86, brightness 0.62–0.9, one warm overlay at low opacity, and a hairline inset ring. A single grade is what makes disparate subjects feel commissioned.",
  },
  {
    title: "Photography earns one moment per screen",
    body: "A hero landscape, one pilot portrait, and small avatar crops. Never a photo behind dense telemetry without a two-stop scrim and a minimum 4.5:1 contrast check.",
  },
  {
    title: "Source locally and credit honestly",
    body: "Download from Pexels or Unsplash at 1600–2000px, compress to 150–300KB, host under /public/images. Keep photographer, source, and ID in a credits file and surface them in the UI.",
  },
  {
    title: "Respect the people in the frame",
    body: "Pexels permits commercial use without attribution, but you may not imply that an identifiable person endorses your product. Represent fictional agents with places and objects; if a portrait is used as atmosphere, label it a placeholder and never present the person as the bot.",
  },
];

export const research = [
  {
    area: "Instrument design",
    note: "Teenage Engineering, Braun, and Leica: one accent, labelled controls, no decoration that does not carry information.",
  },
  {
    area: "Operator consoles",
    note: "Linear, Vercel, and Grafana: dense tables are fine when rows are calm, numerics are tabular, and errors sit inline.",
  },
  {
    area: "Editorial luxury",
    note: "Kinfolk and Cereal: one photograph per spread, generous margins, a serif that is allowed to be large.",
  },
  {
    area: "Japanese visual language",
    note: "Ma (間, negative space), kintsugi gold as a repair accent, and a single sakura moment rather than a pattern.",
  },
  {
    area: "Dashboard craft",
    note: "Polaris and Material 3 state matrices: pending, empty, error, success and disabled designed before the happy path.",
  },
  {
    area: "Photography",
    note: "Pexels Kyoto collection — night blossoms, temple lanterns, castle and torii — downloaded locally, graded uniformly, credited in-app.",
  },
];

export const contrast = [
  ["Night canvas", "#0A090B", "Ink", "#F3EDE8", "17.8:1"],
  ["Night panel", "#121014", "Secondary", "#AAA2AB", "7.1:1"],
  ["Night canvas", "#0A090B", "Blush accent", "#F0AEC0", "10.4:1"],
  ["Blush fill", "#F0AEC0", "On-accent", "#211318", "8.9:1"],
  ["Day canvas", "#FAF3F5", "Ink", "#2A161E", "13.9:1"],
];
