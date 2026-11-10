# OpenCode CLI shim for Mindcraft

A local OpenAI-compatible server that lets Mindcraft use OpenCode's free
`opencode/deepseek-v4.1-flash-free#high` model. The shim runs the official
OpenCode CLI for each request and returns the CLI response as an OpenAI
`chat.completion`.

This exists because `opencode-llm-proxy` is rejected by OpenCode's free-tier
check: the proxy removes the tools and system prompt that OpenCode requires. The
official CLI is accepted, so the shim invokes it instead.

## Behavior

- Listens on `http://127.0.0.1:4011/v1`.
- Converts each OpenAI chat request into one prompt file.
- Runs `opencode-cli run` with `--model opencode/deepseek-v4.1-flash-free#high`
  and the locked-down `minecraft-relay` agent.
- Returns the latest assistant text for both normal and streaming responses.
- Serves deterministic local embeddings at `/v1/embeddings`; no external
  embedding API is used.
- Handles one model request at a time by default (`OPENCODE_SHIM_CONCURRENCY=1`).

The `minecraft-relay` agent denies all tools except reading the prompt folder and
an exact harmless `echo SAFE` shell rule. The shell tool must remain available
for OpenCode's free-tier client check.

## Requirements

- Minecraft Java Edition 26.1, reachable at `127.0.0.1:25565` with offline auth.
  These are the same values as `bots/config.json`; Mindcraft `settings.js` is
  aligned to them.
- If you use Open to LAN or a different server, change the host/port/version in
  both `bots/config.json` and `mindcraft-0.1.4/settings.js`. Do not use 26.3
  with the installed protocol stack.
- The official OpenCode CLI. The default path is
  `C:\Users\ADMIN\AppData\Roaming\ai.opencode.desktop\cli\2.1.0-x64\opencode-cli.exe`;
  override it with `OPENCODE_CLI` if your installation uses another version.
- The free model variant `high`, specified as `provider/model#high`.
- `canvas` and `gl` are not needed. Vision and the browser viewer are disabled;
  enabling either requires a working native `gl` build.

## Start

Install Mindcraft dependencies once:

```powershell
cd D:\ANDROIDAPP\mindcraft-0.1.4\mindcraft-0.1.4
npm install
```

Start the shim:

```powershell
node tools\opencode-shim\server.mjs
```

Or double-click `tools\opencode-shim\start-shim.cmd`.

In a second terminal, start Mindcraft:

```powershell
npm start
```

Or double-click `start-foreman.cmd` in the project root. It starts the shim
minimized, waits two seconds, then runs Mindcraft.

Restart the shim after changing its code, default model, or environment. A
running process does not reload the file.

## Verify

```powershell
Invoke-RestMethod http://127.0.0.1:4011/health
```

The response includes the active model and the CLI path. It should report
`opencode/deepseek-v4.1-flash-free#high`.

End-to-end checks:

```powershell
node tools\opencode-shim\test-http.mjs
node tools\opencode-shim\test-client.mjs
```

`test-client.mjs` exercises the same `GPT` wrapper Mindcraft uses; `test-http.mjs`
checks the raw OpenAI endpoint and local embeddings.

## Configuration

Mindcraft profile: `profiles/foreman.json` (`ForemanBot`).

| Setting | Value |
| --- | --- |
| Endpoint | `http://127.0.0.1:4011/v1` |
| Model | `opencode/deepseek-v4.1-flash-free#high` |
| API key | Dummy `opencode-cli-shim` from `keys.json` |
| Embeddings | `local-hash`, handled locally by the shim |

Environment variables:

| Variable | Default |
| --- | --- |
| `OPENCODE_SHIM_HOST` | `127.0.0.1` |
| `OPENCODE_SHIM_PORT` | `4011` |
| `OPENCODE_CLI` | OpenCode CLI 2.1.0-x64 path shown above |
| `OPENCODE_MODEL` | `opencode/deepseek-v4.1-flash-free#high` |
| `OPENCODE_SHIM_AGENT` | `minecraft-relay` |
| `OPENCODE_SHIM_TIMEOUT_MS` | `120000` |
| `OPENCODE_SHIM_INACTIVITY_MS` | `30000` |
| `OPENCODE_SHIM_SETTLE_MS` | `2500` |
| `OPENCODE_SHIM_CONCURRENCY` | `1` |
| `OPENCODE_SHIM_WORKDIR` | `tools/opencode-shim/workspace` |

To use a different free model, set `OPENCODE_MODEL` explicitly. The variant
suffix is part of the model reference; for this model the supported variants
are `low`, `high`, and `max`. The cluster is configured for `high`.

## Limitations

- Every model call starts a short-lived CLI request. Expect roughly 2-5 seconds
  per decision, plus Mindcraft's profile cooldown and any queue wait.
- The free tier is subject to OpenCode rate limits and can change without
  notice.
- The shim is text-only; vision is disabled.
- The official CLI path changes across OpenCode updates. Set `OPENCODE_CLI` if
  the default is missing.
- The shim is local-only. Do not expose port 4011 to the network.
