const url = process.env.OPENCODE_SHIM_URL || 'http://127.0.0.1:4011/v1/chat/completions';
const started = Date.now();
const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
        model: 'opencode/deepseek-v4.1-flash-free#high',
        messages: [
            { role: 'system', content: 'You are ForemanBot, a friendly Minecraft bot. Reply very briefly and use !commands when asked.' },
            { role: 'user', content: process.argv[2] || 'ForemanBot, say hello and check your stats.' },
        ],
        stop: '***',
    }),
});
const text = await response.text();
console.log(JSON.stringify({ status: response.status, elapsed_ms: Date.now() - started, body: text }, null, 2));
