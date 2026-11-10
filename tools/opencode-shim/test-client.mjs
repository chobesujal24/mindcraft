import { GPT } from '../../src/models/gpt.js';

const url = process.env.OPENCODE_SHIM_URL || 'http://127.0.0.1:4011/v1';
const system = 'You are ForemanBot, a friendly Minecraft bot. Reply very briefly and use !commands when asked.';
const user = process.argv[2] || 'ForemanBot, say hello and check your stats.';

const model = new GPT('opencode/deepseek-v4.1-flash-free#high', url);
const started = Date.now();
const response = await model.sendRequest([{ role: 'user', content: user }], system);
console.log(JSON.stringify({ elapsed_ms: Date.now() - started, response }, null, 2));

const embedder = new GPT('local-hash', url);
const embedding = await embedder.embed('oak log wood');
console.log(JSON.stringify({ embedding_dimensions: embedding.length, embedding_sample: embedding.slice(0, 3) }, null, 2));
