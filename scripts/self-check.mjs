// Offline smoke checks for the local fixes. Run with: npm test
// These do not connect to a Minecraft server or an LLM provider.

/* global process */
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.MINDSERVER_TOKEN = 'self-check-token';

const root = new URL('../', import.meta.url);
const readJson = url => JSON.parse(fs.readFileSync(url, 'utf8'));

async function main() {
    // Prompt ordering: stable instructions must precede volatile sections.
    {
        const profile = readJson(new URL('profiles/defaults/_default.json', root));
        const prompt = profile.conversing;
        const positions = ['$COMMAND_DOCS', '$EXAMPLES', '$MEMORY', '$STATS', '$INVENTORY', '$SELF_PROMPT']
            .map(key => [key, prompt.indexOf(key)]);
        for (const [key, index] of positions) {
            assert.ok(index >= 0, `${key} is missing from the default prompt`);
        }
        assert.ok(positions[0][1] < positions[2][1], 'command docs must precede memory');
        assert.ok(positions[1][1] < positions[2][1], 'examples must precede memory');
        console.log('ok - prompt sections are ordered for caching');
    }

    // Neutral mobs must not be treated as hostile.
    {
        const { isHostile } = await import(new URL('src/utils/mcdata.js', root));
        const cases = [
            ['enderman', 'hostile', false],
            ['zombified_piglin', 'hostile', false],
            ['iron_golem', 'mob', false],
            ['snow_golem', 'mob', false],
            ['zombie', 'hostile', true],
            ['creeper', 'hostile', true],
            ['ghast', 'mob', true],
            ['cow', 'animal', false],
        ];
        for (const [name, type, expected] of cases) {
            assert.equal(isHostile({ name, type }), expected, `isHostile(${name})`);
        }
        console.log('ok - neutral mobs are not hostile');
    }

    // Block searches must be clamped and time-boxed.
    {
        const { getNearestBlocksWhere } = await import(new URL('src/agent/library/world.js', root));
        const pos = (x, y, z) => ({
            x, y, z,
            clone() { return pos(x, y, z); },
            distanceTo(other) { return Math.hypot(x - other.x, y - other.y, z - other.z); },
        });
        const makeBot = findBlocks => ({
            entity: { position: pos(0, 64, 0) },
            findBlocks,
            blockAt: position => ({ position }),
        });

        const samples = [];
        let options = null;
        for (let i = 0; i < 3; i++) {
            const bot = makeBot(captured => {
                options = captured;
                while (true) captured.matching({ name: 'stone', position: null });
            });
            const started = Date.now();
            const result = getNearestBlocksWhere(bot, () => false, 999, 100000);
            samples.push(Date.now() - started);
            assert.equal(options.maxDistance, 128, 'distance must be clamped');
            assert.equal(options.count, 4000, 'count must be clamped');
            assert.equal(result.length, 0);
        }
        const best = Math.min(...samples);
        // The scan aborts itself after 50ms. Allow scheduler/JIT noise, but
        // require at least one run to land close to the stated budget.
        assert.ok(best < 250, `fastest block search took ${best}ms; the 50ms budget did not abort it`);
        console.log(`ok - block search is clamped and aborted after ${samples.join('/')}ms`);
    }

    // Placement must not right-click a clickable block instead of placing.
    {
        const { placeBlock } = await import(new URL('src/agent/library/skills.js', root));
        const Vec3 = (await import('vec3')).default;
        const target = Vec3(1, 64, 0);

        const tryPlace = async (supportName, botPosition) => {
            let clicked = false;
            const bot = {
                output: '',
                modes: { isOn: () => false },
                inventory: { findInventoryItem: () => ({ name: 'torch' }) },
                game: { gameMode: 'survival' },
                entity: { position: botPosition },
                blockAt: pos => pos.equals(target)
                    ? { name: 'air', position: target, shapes: [] }
                    : { name: supportName, position: pos, shapes: [[0, 0, 0, 1, 1, 1]] },
                equip: async () => { },
                lookAt: async () => { },
                placeBlock: () => { clicked = true; return Promise.resolve(); },
                chat: () => { },
            };
            return { placed: await placeBlock(bot, 'torch', 1, 64, 0, 'bottom'), clicked };
        };

        for (const support of ['chest', 'hopper', 'brewing_stand', 'furnace', 'decorated_pot', 'cauldron']) {
            const { placed, clicked } = await tryPlace(support, Vec3(10, 64, 0));
            assert.equal(placed, false, `${support} must not be used as placement support`);
            assert.equal(clicked, false, `placement must not interact with ${support}`);
        }

        // Positive control: a plain full cube must still be used, so the
        // negative cases cannot pass just because placement is broken.
        const safe = await tryPlace('stone', Vec3(3, 64, 0));
        assert.equal(safe.placed, true, 'a safe full-cube support must still be used');
        assert.equal(safe.clicked, true);
        console.log('ok - placement refuses clickable support blocks');
    }

    // Action state is generation-guarded, and a stuck action locks the agent
    // instead of overlapping the next one.
    {
        const { ActionManager } = await import(new URL('src/agent/action_manager.js', root));
        const makeAgent = () => ({
            bot: {
                interrupt_code: false,
                output: '',
                emit() { },
                stopDigging() { },
            },
            clearBotLogs() { },
            requestInterrupt() { },
            isIdle() { return true; },
            self_prompter: { isActive() { return false; } },
            cleanKill() { throw new Error('cleanKill must not be called'); },
        });

        const agent = makeAgent();
        const actions = new ActionManager(agent);

        let releaseOld;
        const oldAction = actions.runAction('old', () => new Promise(resolve => { releaseOld = resolve; }), { timeout: 0 });
        await new Promise(resolve => setTimeout(resolve, 20));

        actions._abandonAction();
        const newAction = actions.runAction('new', async () => {
            await new Promise(resolve => setTimeout(resolve, 80));
        }, { timeout: 0 });
        await new Promise(resolve => setTimeout(resolve, 20));

        releaseOld();
        await oldAction;
        assert.equal(actions.executing, true, 'abandoned action cleared the new action flag');
        assert.equal(actions.currentActionLabel, 'new', 'abandoned action cleared the new action label');

        await newAction;
        assert.equal(actions.executing, false);
        assert.equal(actions.currentActionLabel, '');
        console.log('ok - abandoned actions cannot clear newer action state');

        // Exercise the real timeout path: runAction() waits in stop(), the
        // grace period expires, cleanKill() throws, and _hardExit() is the
        // last resort. The lock must stay held and the next action refused.
        const stuckAgent = makeAgent();
        const stuckActions = new ActionManager(stuckAgent, { stopTimeoutMs: 60, stopPollMs: 10 });
        let hardExits = 0;
        let restartMessage = null;
        stuckAgent.cleanKill = message => {
            restartMessage = message;
            throw new Error('socket is already closed');
        };
        stuckActions._hardExit = () => { hardExits++; };

        // This path intentionally logs failures; capture them so the test
        // output stays readable and the diagnostics themselves are checked.
        const loggedErrors = [];
        const originalError = console.error;
        console.error = (...args) => { loggedErrors.push(args.map(String).join(' ')); };
        try {
            const stuckAction = stuckActions.runAction('stuck', () => new Promise(() => { }), { timeout: 0 });
            await new Promise(resolve => setTimeout(resolve, 20));

            let startedNewAction = false;
            const refused = await stuckActions.runAction('next', () => { startedNewAction = true; return Promise.resolve(); }, { timeout: 0 });
            assert.equal(refused.success, false, 'a stuck agent must refuse the next action');
            assert.match(refused.message, /stuck/i);
            assert.equal(startedNewAction, false, 'the next action ran while the old one was alive');

            // The action intentionally never settles; it does not hold the
            // process open and must not be awaited.
            void stuckAction;
        } finally {
            console.error = originalError;
        }

        assert.match(restartMessage, /restart/i, 'stuck action must restart the agent');
        assert.equal(hardExits, 1, 'a throwing cleanKill must fall back to a hard exit');
        assert.equal(stuckActions.stuck, true);
        assert.equal(stuckActions.executing, true, 'the lock must stay held when restart fails');
        assert.ok(loggedErrors.some(line => /did not stop after/.test(line)), 'timeout must be logged');
        assert.ok(loggedErrors.some(line => /Failed to restart the stuck agent cleanly/.test(line)), 'failed restart must be logged');
        console.log('ok - a stuck action locks the agent and requires a restart');
    }

    // Token enforcement for REST and local UI socket connections.
    {
        const { createMindServer } = await import(new URL('src/mindcraft/mindserver.js', root));
        const server = createMindServer(false, 0);
        await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        const port = server.address().port;
        try {
            const body = JSON.stringify({ command: 'say test' });
            const unauth = await fetch(`http://127.0.0.1:${port}/api/dispatch-command`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body,
            });
            const auth = await fetch(`http://127.0.0.1:${port}/api/dispatch-command`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: 'Bearer self-check-token' },
                body,
            });
            assert.equal(unauth.status, 401, 'REST must reject a missing token');
            assert.equal(auth.status, 200, 'REST must accept the configured token');

            const { io } = await import('socket.io-client');
            const connect = (auth) => new Promise((resolve, reject) => {
                const socket = io(`http://127.0.0.1:${port}`, {
                    transports: ['websocket'],
                    reconnection: false,
                    timeout: 3000,
                    auth,
                });
                socket.once('connect', () => { socket.close(); resolve(); });
                socket.once('connect_error', err => { socket.close(); reject(err); });
            });

            await assert.rejects(connect({}), /unauthorised/, 'socket must reject a missing token');
            await connect({ token: 'self-check-token' });
            console.log('ok - REST and Socket.IO require the configured token');
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    }

    console.log('\nall self-checks passed');
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
