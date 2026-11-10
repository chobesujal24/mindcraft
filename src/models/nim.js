import OpenAIApi from 'openai';
import { readFileSync } from 'node:fs';
import { getKey, hasKey } from '../utils/keys.js';
import { strictFormat } from '../utils/text.js';

// Keep defaults so older installs continue to work until they create a provider
// configuration. The dashboard writes ai-providers.json to the app directory.
const DEFAULT_UPSTREAMS = [
  {
    id: 'dahl', name: 'Dahl', baseURL: 'https://inference.dahl.global/v1',
    keyName: 'DAHL_API_KEY', model: 'zai-org/GLM-5.3-Flash', timeoutMs: 30000
  },
  {
    id: 'nvidia-1', name: 'NVIDIA NIM', baseURL: 'https://integrate.api.nvidia.com/v1',
    keyName: 'NVIDIA_API_KEY', model: '', timeoutMs: 30000
  },
  {
    id: 'river-ai', name: 'River.ai', baseURL: 'https://api.river.ai/v1',
    keyName: 'RIVER_API_KEY', model: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', timeoutMs: 60000
  },
  {
    id: 'nvidia-2', name: 'NVIDIA NIM (key 2)', baseURL: 'https://integrate.api.nvidia.com/v1',
    keyName: 'NVIDIA_API_KEY_2', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeoutMs: 30000
  },
  {
    id: 'openrouter-1', name: 'OpenRouter (key 1)', baseURL: 'https://openrouter.ai/api/v1',
    keyName: 'OPENROUTER_API_KEY', model: 'nvidia/nemotron-3.5-lightning:free', timeoutMs: 45000
  },
  {
    id: 'openrouter-2', name: 'OpenRouter (key 2)', baseURL: 'https://openrouter.ai/api/v1',
    keyName: 'OPENROUTER_API_KEY_2', model: 'nvidia/nemotron-3.5-super-vl:free', timeoutMs: 60000
  },
  {
    id: 'local-shim', name: 'Local Shim', baseURL: 'http://127.0.0.1:4011/v1',
    keyName: 'OPENAI_API_KEY', model: 'opencode/deepseek-v4.1-flash-free#high', timeoutMs: 120000
  }
];

const DEFAULT_MAX_TOKENS = 4096;
const providerCooldowns = new Map();

function failureCooldownMs(error) {
  const status = Number(error?.status || error?.statusCode);
  if (status === 402) return 30 * 60 * 1000;
  if (status === 401 || status === 403) return 5 * 60 * 1000;
  if (status === 429) {
    const header = error?.headers?.get?.('retry-after') ?? error?.headers?.['retry-after'];
    const seconds = Number(header);
    return Math.min(Math.max(seconds > 0 ? seconds * 1000 : 60000, 1000), 5 * 60 * 1000);
  }
  if (status >= 500) return 15000;
  return 0;
}

function loadConfiguredUpstreams(profileModel, profileTimeout) {
  let configured = null;
  try {
    const parsed = JSON.parse(readFileSync('./ai-providers.json', 'utf8'));
    if (Array.isArray(parsed.providers)) configured = parsed.providers;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[nim] cannot read ai-providers.json; using built-in providers: ${err.message}`);
    }
  }

  const candidates = configured || DEFAULT_UPSTREAMS;
  const seen = new Set();
  return candidates
    .filter(provider => provider && provider.enabled !== false)
    .filter(provider => {
      const id = String(provider.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(provider => {
      const id = String(provider.id);
      return {
        id,
        name: String(provider.name || id),
        baseURL: String(provider.baseURL || ''),
        keyName: String(provider.keyName || ''),
        model: String(provider.model || (id === 'nvidia-1' ? profileModel : '')),
        timeoutMs: Number(provider.timeoutMs) || (id === 'nvidia-1' ? profileTimeout : 30000)
      };
    })
    .filter(provider => provider.baseURL && provider.keyName && provider.model);
}

/**
 * OpenAI-compatible model with dashboard-configurable failover ordering.
 * `ai-providers.json` order is the request priority order; providers that are
 * disabled or missing a key are skipped so the next configured provider runs.
 */
export class Nim {
  static prefix = 'nim';

  constructor(model_name, url, params) {
    this.model_name = model_name;
    this.params = params;
    this.maxTokens = (params && Number(params.max_tokens)) || DEFAULT_MAX_TOKENS;
    const profileTimeout = (params && Number(params.timeout_ms)) || 30000;
    this.upstreams = loadConfiguredUpstreams(model_name, profileTimeout);
    this.lastUsed = null;
  }

  get upstreamNames() {
    return this.upstreams.map(u => `${u.id}:${u.model}`).join(' -> ');
  }

  async sendRequest(turns, systemMessage, stop_seq = null) {
    const messages = strictFormat([{ role: 'system', content: systemMessage }, ...turns]);
    let lastError = null;

    for (const upstream of this.upstreams) {
      if (!hasKey(upstream.keyName)) {
        console.warn(`[nim] skipping ${upstream.id}: ${upstream.keyName} is not configured`);
        continue;
      }
      const cooldown = providerCooldowns.get(upstream.id);
      if (cooldown && cooldown.until > Date.now()) {
        if (Date.now() - cooldown.lastLoggedAt > 60000) {
          console.warn(`[nim] skipping ${upstream.id}: HTTP ${cooldown.status} cooldown, ${Math.ceil((cooldown.until - Date.now()) / 1000)}s remaining`);
          cooldown.lastLoggedAt = Date.now();
        }
        continue;
      }
      if (cooldown) providerCooldowns.delete(upstream.id);
      const started = Date.now();
      try {
        const api = new OpenAIApi({
          baseURL: upstream.baseURL,
          apiKey: getKey(upstream.keyName),
          timeout: upstream.timeoutMs,
          maxRetries: 0
        });
        const pack = {
          model: upstream.model,
          messages,
          max_tokens: this.maxTokens
        };
        if (stop_seq) pack.stop = stop_seq;

        const completion = await api.chat.completions.create(pack);
        const message = completion?.choices?.[0]?.message;
        const content = (message?.content || message?.reasoning_content || '').trim();
        if (!content) throw new Error('empty completion');

        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        providerCooldowns.delete(upstream.id);
        this.lastUsed = upstream.id;
        console.log(`[nim] ${upstream.id} (${upstream.model}) answered in ${seconds}s`);
        return content;
      } catch (err) {
        lastError = err;
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const status = Number(err?.status || err?.statusCode);
        const cooldownMs = failureCooldownMs(err);
        if (cooldownMs) {
          providerCooldowns.set(upstream.id, { until: Date.now() + cooldownMs, status, lastLoggedAt: Date.now() });
          console.warn(`[nim] ${upstream.id} failed after ${seconds}s (HTTP ${status}); cooling down for ${Math.ceil(cooldownMs / 1000)}s: ${err?.message || err}`);
        } else {
          console.warn(`[nim] ${upstream.id} failed after ${seconds}s: ${err?.message || err}`);
        }
      }
    }
    console.error('[nim] every upstream failed:', lastError?.message || lastError);
    // Do not return '??': it looks like a valid model reply and hides the
    // outage. Return the same explicit failure text the other providers use.
    return 'My brain disconnected, try again.';
  }

  async sendVisionRequest(messages, systemMessage, imageBuffer) {
    // OpenRouter is the only currently configured upstream expected to support
    // the image payload Mindcraft sends here.
    const upstream = this.upstreams.find(u => u.id.startsWith('openrouter'));
    if (!upstream || !hasKey(upstream.keyName)) {
      throw new Error('no vision capable upstream is configured');
    }
    const api = new OpenAIApi({
      baseURL: upstream.baseURL,
      apiKey: getKey(upstream.keyName),
      timeout: upstream.timeoutMs,
      maxRetries: 0
    });
    const visionMessages = [...messages];
    visionMessages.push({
      role: 'user',
      content: [
        { type: 'text', text: systemMessage },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` } }
      ]
    });
    const completion = await api.chat.completions.create({
      model: upstream.model,
      messages: visionMessages,
      max_tokens: this.maxTokens
    });
    return completion?.choices?.[0]?.message?.content || 'No response received.';
  }
}
