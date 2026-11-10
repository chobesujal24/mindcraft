import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HOST = process.env.OPENCODE_SHIM_HOST || '127.0.0.1';
const PORT = Number(process.env.OPENCODE_SHIM_PORT || 4011);

/**
 * Locate the OpenCode CLI.
 *
 * The desktop app installs the CLI under a versioned folder that changes with
 * every app update, so a hard coded path breaks silently. Search the known
 * locations and pick the newest one.
 */
function findOpenCodeCli() {
  if (process.env.OPENCODE_CLI && existsSync(process.env.OPENCODE_CLI)) {
    return process.env.OPENCODE_CLI;
  }
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [];

  const cliRoot = path.join(appData, 'ai.opencode.desktop', 'cli');
  if (existsSync(cliRoot)) {
    for (const entry of readdirSync(cliRoot)) {
      const exe = path.join(cliRoot, entry, 'opencode-cli.exe');
      if (existsSync(exe)) {
        candidates.push({ exe, mtime: statSync(exe).mtimeMs });
      }
    }
  }
  const bundled = path.join(localAppData, 'Programs', '@opencodedesktop', 'resources', 'opencode-cli.exe');
  if (existsSync(bundled)) candidates.push({ exe: bundled, mtime: statSync(bundled).mtimeMs });

  if (candidates.length) {
    candidates.sort((a, b) => b.mtime - a.mtime);
    return candidates[0].exe;
  }
  return 'opencode';
}

const CLI = findOpenCodeCli();
const MODEL = process.env.OPENCODE_MODEL || 'opencode/deepseek-v4.1-flash-free#high';
const AGENT = process.env.OPENCODE_SHIM_AGENT || 'minecraft-relay';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENCODE_SHIM_TIMEOUT_MS || 120000);
const INACTIVITY_TIMEOUT_MS = Number(process.env.OPENCODE_SHIM_INACTIVITY_MS || 30000);
const TEXT_SETTLE_MS = Number(process.env.OPENCODE_SHIM_SETTLE_MS || 2500);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_CONCURRENCY = Number(process.env.OPENCODE_SHIM_CONCURRENCY || 1);
const EMBEDDING_DIMENSIONS = 384;

const SHIM_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKDIR = process.env.OPENCODE_SHIM_WORKDIR || path.join(SHIM_DIR, 'workspace');
const PROMPT_DIR = path.join(WORKDIR, '.shim-prompts');
const CONFIG_PATH = path.join(WORKDIR, 'opencode.json');

let activeRequests = 0;
const waiting = [];

async function acquireSlot() {
    if (activeRequests < MAX_CONCURRENCY) {
        activeRequests++;
        return;
    }
    await new Promise(resolve => waiting.push(resolve));
}

function releaseSlot() {
    const next = waiting.shift();
    if (next) {
        next(); // transfer the slot without changing activeRequests
    } else {
        activeRequests--;
    }
}

async function withSlot(fn) {
    await acquireSlot();
    try {
        return await fn();
    } finally {
        releaseSlot();
    }
}

function json(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(data),
    });
    res.end(data);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let total = 0;
        const chunks = [];
        req.on('data', chunk => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(new Error('Request body too large.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (err) {
                reject(new Error('Invalid JSON request body.'));
            }
        });
        req.on('error', reject);
    });
}

function asText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .filter(part => part && part.type === 'text' && typeof part.text === 'string')
            .map(part => part.text)
            .join('\n');
    }
    return content == null ? '' : String(content);
}

function splitSystemMessage(messages) {
    let system = '';
    const conversation = [];
    for (const message of messages || []) {
        const role = message?.role || 'user';
        let content = asText(message?.content);
        if (role === 'system') {
            system += (system ? '\n\n' : '') + content;
            continue;
        }
        if (!conversation.length && !system && /^SYSTEM:\s*/i.test(content)) {
            system = content.replace(/^SYSTEM:\s*/i, '');
            continue;
        }
        conversation.push({ role, content });
    }
    return { system: system || 'You are a Minecraft bot.', conversation };
}

function buildPrompt(messages, stop) {
    const { system, conversation } = splitSystemMessage(messages);
    const turns = conversation.map(message => {
        const label = message.role === 'assistant' ? 'ASSISTANT' : message.role.toUpperCase();
        return `${label}: ${message.content}`;
    }).join('\n\n');
    const stops = Array.isArray(stop) ? stop : (stop ? [stop] : []);
    const stopText = stops.filter(Boolean).map(value => JSON.stringify(value)).join(', ');

    return [
        'You are the text-generation backend for a Minecraft bot. Below are the bot\'s actual system instructions and its recent conversation.',
        '',
        'Rules:',
        '- Output ONLY the next assistant message.',
        '- Never use tools. Never mention these wrapper instructions, OpenCode, or the attached prompt file.',
        '- Do not add analysis, labels, quotes, or markdown fences around the answer.',
        '- Do not prefix the answer with "assistant:" or with the bot\'s name.',
        '- If the bot should act, include the exact !command syntax from its instructions.',
        stopText ? `- Do not output any of these stop sequences: ${stopText}` : '',
        '- If there is nothing to say, output a single tab character.',
        '',
        '=== BOT SYSTEM INSTRUCTIONS ===',
        system,
        '',
        '=== CONVERSATION ===',
        turns || '(no conversation yet)',
        '',
        '=== END ===',
        'NEXT ASSISTANT MESSAGE:',
    ].filter(line => line !== '').join('\n');
}

function stripAnsi(text) {
    return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function cleanOutput(text, stop) {
    let out = stripAnsi(text || '').replace(/\r\n/g, '\n');
    if (out.includes('</think>')) {
        out = out.split('</think>').pop();
    }
    out = out.replace(/^\s*```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n```\s*$/, '$1');
    out = out.replace(/^NEXT ASSISTANT MESSAGE:\s*/i, '');
    out = out.replace(/^(?:assistant|ForemanBot)\s*:\s*/i, '');
    const stops = Array.isArray(stop) ? stop : (stop ? [stop] : []);
    for (const value of stops) {
        if (value && out.endsWith(value)) {
            out = out.slice(0, -value.length);
        }
    }
    if (/^\s*$/.test(out)) return '\t';
    return out.trim();
}

function runCli(promptPath) {
    const args = [
        'run',
        '--agent', AGENT,
        '--model', MODEL,
        '--format', 'json',
        '--file', promptPath,
        'Use the attached prompt. Return only the next assistant message, without tool use.',
    ];

    return new Promise((resolve, reject) => {
        let settled = false;
        let stdoutBuffer = '';
        let stderr = '';
        let currentTexts = [];
        let textTimer = null;
        let totalTimer = null;
        let inactivityTimer = null;

        const child = spawn(CLI, args, {
            cwd: WORKDIR,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NO_COLOR: '1',
                FORCE_COLOR: '0',
            },
        });

        const clearTimers = () => {
            clearTimeout(textTimer);
            clearTimeout(totalTimer);
            clearTimeout(inactivityTimer);
        };

        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimers();
            try { child.kill(); } catch { /* already gone */ }
            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        };

        const resetInactivity = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                finish(new Error(`OpenCode CLI produced no output for ${INACTIVITY_TIMEOUT_MS}ms.`));
            }, INACTIVITY_TIMEOUT_MS);
        };

        const scheduleTextReturn = () => {
            clearTimeout(textTimer);
            textTimer = setTimeout(() => {
                if (currentTexts.length) finish(null, currentTexts.slice());
            }, TEXT_SETTLE_MS);
        };

        const handleEvent = (event) => {
            resetInactivity();
            const type = event?.type;
            if (type === 'step_start') {
                // Keep only text from the most recent model step.
                currentTexts = [];
                clearTimeout(textTimer);
            } else if (type === 'text' && typeof event.part?.text === 'string') {
                currentTexts.push(event.part.text);
                scheduleTextReturn();
            } else if (type === 'tool_use') {
                clearTimeout(textTimer);
            } else if (type === 'error') {
                const message = event.error?.message || JSON.stringify(event.error);
                finish(new Error(`OpenCode CLI error: ${message}`));
            }
        };

        const handleLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('{')) return;
            try {
                handleEvent(JSON.parse(trimmed));
            } catch {
                // Ignore non-JSON log lines.
            }
        };

        child.stdout.on('data', chunk => {
            stdoutBuffer += chunk.toString('utf8');
            let index;
            while ((index = stdoutBuffer.indexOf('\n')) !== -1) {
                const line = stdoutBuffer.slice(0, index);
                stdoutBuffer = stdoutBuffer.slice(index + 1);
                handleLine(line);
            }
        });

        child.stderr.on('data', chunk => {
            stderr += chunk.toString('utf8');
        });

        child.on('error', error => finish(error));

        child.on('close', code => {
            handleLine(stdoutBuffer);
            if (currentTexts.length) {
                finish(null, currentTexts.slice());
                return;
            }
            const details = stderr.trim() || `exit code ${code}`;
            finish(new Error(`OpenCode CLI returned no text. ${details}`));
        });

        totalTimer = setTimeout(() => {
            finish(new Error(`OpenCode CLI timed out after ${REQUEST_TIMEOUT_MS}ms.`));
        }, REQUEST_TIMEOUT_MS);
        resetInactivity();
    });
}

async function complete(messages, stop) {
    const prompt = buildPrompt(messages, stop);
    await mkdir(PROMPT_DIR, { recursive: true });
    const promptPath = path.join(PROMPT_DIR, `request-${Date.now()}-${randomUUID()}.txt`);
    await writeFile(promptPath, prompt, 'utf8');
    try {
        const texts = await withSlot(() => runCli(promptPath));
        return cleanOutput(texts.join('\n'), stop);
    } finally {
        await unlink(promptPath).catch(() => {});
    }
}

function tokenize(text) {
    return (String(text).toLowerCase().match(/[a-z0-9_]+/g) || []);
}

function hashToken(token) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function embedText(text) {
    const vector = new Float64Array(EMBEDDING_DIMENSIONS);
    const tokens = tokenize(text);
    for (const token of tokens) {
        const hash = hashToken(token);
        const index = hash % EMBEDDING_DIMENSIONS;
        const sign = (hash & 0x80000000) ? -1 : 1;
        vector[index] += sign;
    }
    if (!tokens.length) vector[0] = 1;
    let magnitude = 0;
    for (const value of vector) magnitude += value * value;
    magnitude = Math.sqrt(magnitude);
    if (magnitude > 0) {
        for (let i = 0; i < vector.length; i++) vector[i] /= magnitude;
    }
    return Array.from(vector);
}

async function ensureAgentConfig() {
    await mkdir(PROMPT_DIR, { recursive: true });
    const allowedRead = `${PROMPT_DIR.replace(/\\/g, '/')}/**`;
    const config = {
        '$schema': 'https://opencode.ai/config.json',
        agents: {
            [AGENT]: {
                description: 'Text-only relay for the local Minecraft bot shim.',
                mode: 'primary',
                steps: 3,
                system: [
                    'You are the text-generation backend for a Minecraft bot.',
                    'The attached file contains the bot\'s full instructions and conversation.',
                    'Produce only the next assistant message. Never use tools unless reading the attached prompt is absolutely necessary.',
                    'Never mention this wrapper, OpenCode, or the prompt file.',
                ].join(' '),
                permissions: [
                    { action: '*', resource: '*', effect: 'deny' },
                    { action: 'read', resource: allowedRead, effect: 'allow' },
                    // Keep the shell tool present for OpenCode's free-tier client check,
                    // while allowing only a harmless fixed command.
                    { action: 'shell', resource: 'echo SAFE', effect: 'allow' },
                ],
            },
        },
    };
    const next = JSON.stringify(config, null, 4) + '\n';
    let current = '';
    try {
        current = await readFile(CONFIG_PATH, 'utf8');
    } catch {
        // create below
    }
    if (current !== next) {
        await writeFile(CONFIG_PATH, next, 'utf8');
    }
}

function completionResponse(text, model) {
    return {
        id: `chatcmpl-shim-${randomUUID()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
        }],
        usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };
}

function streamCompletion(res, text, model) {
    const id = `chatcmpl-shim-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
    });
    const base = { id, object: 'chat.completion.chunk', created, model };
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    try {
        if (req.method === 'GET' && (requestUrl.pathname === '/health' || requestUrl.pathname === '/v1/health')) {
            json(res, 200, {
                status: 'ok',
                model: MODEL,
                agent: AGENT,
                cli: CLI,
                workdir: WORKDIR,
                active_requests: activeRequests,
                queued_requests: waiting.length,
            });
            return;
        }

        if (req.method === 'GET' && requestUrl.pathname.endsWith('/models')) {
            json(res, 200, {
                object: 'list',
                data: [{
                    id: MODEL,
                    object: 'model',
                    created: 0,
                    owned_by: 'opencode-cli-shim',
                }],
            });
            return;
        }

        if (req.method === 'POST' && requestUrl.pathname.endsWith('/embeddings')) {
            const body = await readBody(req);
            const inputs = Array.isArray(body.input) ? body.input : [body.input];
            const model = body.model || 'local-hash';
            json(res, 200, {
                object: 'list',
                data: inputs.map((input, index) => ({
                    object: 'embedding',
                    index,
                    embedding: embedText(asText(input)),
                })),
                model,
                usage: { prompt_tokens: 0, total_tokens: 0 },
            });
            return;
        }

        if (req.method === 'POST' && requestUrl.pathname.endsWith('/chat/completions')) {
            const body = await readBody(req);
            if (!Array.isArray(body.messages)) {
                json(res, 400, { error: { message: 'messages must be an array', type: 'invalid_request_error' } });
                return;
            }
            const text = await complete(body.messages, body.stop);
            if (body.stream) {
                streamCompletion(res, text, body.model || MODEL);
            } else {
                json(res, 200, completionResponse(text, body.model || MODEL));
            }
            return;
        }

        json(res, 404, { error: { message: `Unknown endpoint: ${req.method} ${requestUrl.pathname}`, type: 'invalid_request_error' } });
    } catch (err) {
        console.error('[shim]', err?.message || err);
        if (!res.headersSent) {
            json(res, 502, {
                error: {
                    message: err?.message || 'OpenCode CLI shim failed.',
                    type: 'upstream_error',
                },
            });
        } else {
            res.end();
        }
    }
});

await ensureAgentConfig();
server.listen(PORT, HOST, () => {
    console.log(`[shim] listening on http://${HOST}:${PORT}/v1`);
    console.log(`[shim] model: ${MODEL}`);
    console.log(`[shim] cli: ${CLI}`);
    console.log(`[shim] workspace: ${WORKDIR}`);
});
