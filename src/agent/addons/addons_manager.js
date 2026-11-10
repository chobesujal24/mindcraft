/**
 * AddonsManager - Central Master Scheduler
 * Single unified tick loop coordinating all combat, survival, and economy modules.
 * Eliminates independent timer storms and multi-agent file collisions via Socket.IO IPC
 * and per-agent namespaced persistence.
 * ZERO LLM calls — 100% deterministic code to preserve RPM limits.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { AutoTotem } from './auto_totem.js';
import { AutoGapple } from './auto_gapple.js';
import { AutoArmor } from './auto_armor.js';
import { CpsBooster } from './cps_booster.js';
import { PanicEscape } from './panic_escape.js';
import { PlayerRadar } from './radar.js';
import { AutoLoot } from './auto_loot.js';
import { ShopGui } from './shop_gui.js';
import { SchematicBuilder } from './schematic_builder.js';
import { serverProxy } from '../mindserver_proxy.js';
import * as skills from '../library/skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');
const ROOT_CONFIG_FILE = path.join(ROOT_DIR, 'addons_config.json');
const GRIND_TARGETS = new Set([
    'stone', 'cobblestone', 'dirt', 'gravel', 'sand', 'netherrack',
    'coal_ore', 'copper_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore',
    'diamond_ore', 'emerald_ore', 'nether_quartz_ore', 'nether_gold_ore', 'ancient_debris',
    'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
    'mangrove_log', 'cherry_log', 'wheat', 'carrots', 'potatoes', 'beetroots', 'sugar_cane'
]);

const DEFAULT_CONFIG = {
    auto_totem: false,
    auto_gapple: false,
    auto_armor: false,
    cps_booster: false,
    cps_value: 12,
    cps_cooldown_mode: false,
    panic_escape: false,
    player_radar: false,
    auto_loot: false,
    shop_gui: false,
    auto_sell: false
};

export class AddonsManager {
    constructor(agent) {
        this.agent = agent;
        this.bot = agent.bot;
        this.agentName = (agent.name || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
        this.config = { ...DEFAULT_CONFIG };

        // Namespaced fallback files per agent to eliminate multi-bot file collisions
        this.configFile = path.join(ROOT_DIR, `addons_config_${this.agentName}.json`);
        this.liveFile = path.join(ROOT_DIR, `addons_live_${this.agentName}.json`);
        this.actionFile = path.join(ROOT_DIR, `addons_action_${this.agentName}.json`);
        this.actionQueueDir = path.join(ROOT_DIR, `addons_actions_${this.agentName}`);
        this.grindFile = path.join(ROOT_DIR, `grind_jobs_${this.agentName}.json`);
        this.grindState = { current: null, queue: [], history: [] };
        this._grindExecutionPromise = null;
        this._grindStopRequested = false;
        this.schematicBuilder = new SchematicBuilder(agent, this);

        // Shared inventory mutex lock across all addons (auto_totem, auto_gapple, auto_armor, panic_escape)
        this._inventoryLocked = false;

        // Sub-modules
        this.modules = {
            auto_totem: new AutoTotem(this.bot, this),
            auto_gapple: new AutoGapple(this.bot, 14, this),
            auto_armor: new AutoArmor(this.bot, this),
            cps_booster: new CpsBooster(this.bot, 12, this),
            panic_escape: new PanicEscape(this.bot, 6, this),
            player_radar: new PlayerRadar(this.bot, 32, this),
            auto_loot: new AutoLoot(this.bot, 16, this.agent, this),
            shop_gui: new ShopGui(this.bot, this)
        };

        // Convenient alias so modules can reference either player_radar or radar
        this.modules.radar = this.modules.player_radar;

        this._masterInterval = null;
        this._tickCount = 0;
        this._processedActionIds = new Set();
        this._processedActionOrder = [];
        this._onSocketConfig = null;
        this._onSocketAction = null;
        this._onSocketCommand = null;
    }

    /**
     * Shared inventory action mutex/lock across addons.
     * Prevents simultaneous equip/click collisions between auto_totem, auto_gapple, auto_armor, and panic_escape,
     * and aborts safely if a container window (bot.currentWindow) is currently open.
     */
    async withInventoryLock(fn) {
        if (!this.bot || this.bot.currentWindow) return false;
        if (this._inventoryLocked) return false;
        this._inventoryLocked = true;
        try {
            if (this.bot.currentWindow) return false;
            return await fn();
        } finally {
            this._inventoryLocked = false;
        }
    }

    start() {
        console.log(`[AddonsManager:${this.agentName}] Initializing Central Master Scheduler...`);
        this.loadConfig();
        this.loadGrindState();
        this.schematicBuilder.load();
        try { fs.mkdirSync(this.actionQueueDir, { recursive: true }); } catch (_) {}
        this.applyConfig();
        this._bindSocketEvents();

        // Single Master Scheduler (100ms cadence = 10 ticks per second)
        this._masterInterval = setInterval(() => {
            this.masterTick();
        }, 100);

        console.log(`[AddonsManager:${this.agentName}] Ready. Socket.IO IPC + per-agent namespace active.`);
    }

    stop() {
        this.pauseGrindJob('Agent is stopping; resume from the dashboard after reconnecting.');
        this.schematicBuilder.stop();
        if (this._masterInterval) {
            clearInterval(this._masterInterval);
            this._masterInterval = null;
        }
        this._unbindSocketEvents();
        for (const mod of Object.values(this.modules)) {
            try { mod.disable(); } catch (_) {}
        }
    }

    _bindSocketEvents() {
        const socket = serverProxy.getSocket?.();
        if (!socket) return;

        this._onSocketConfig = (payload) => {
            if (payload?.agentName && payload.agentName !== 'all' && payload.agentName !== this.agent.name && payload.agentName !== this.agentName) return;
            const newCfg = payload?.config || payload;
            if (newCfg && typeof newCfg === 'object') {
                this.config = { ...this.config, ...newCfg };
                this.applyConfig();
                this.saveConfig();
                this.writeLiveTelemetry();
            }
        };

        this._onSocketAction = (payload) => {
            if (payload?.agentName && payload.agentName !== 'all' && payload.agentName !== this.agent.name && payload.agentName !== this.agentName) return;
            this.executeAction(payload);
        };

        this._onSocketCommand = (payload) => {
            if (payload?.agentName && payload.agentName !== 'all' && payload.agentName !== this.agent.name && payload.agentName !== this.agentName) return;
            const rawCmd = typeof payload === 'string' ? payload : payload?.command;
            if (rawCmd && typeof rawCmd === 'string') {
                this.dispatchServerCommand(rawCmd);
            }
        };

        socket.on('addons-config', this._onSocketConfig);
        socket.on('addons:config', this._onSocketConfig);
        socket.on('addons-action', this._onSocketAction);
        socket.on('addons:action', this._onSocketAction);
        socket.on('direct-command', this._onSocketCommand);
    }

    _unbindSocketEvents() {
        const socket = serverProxy.getSocket?.();
        if (!socket) return;
        if (this._onSocketConfig) {
            socket.off('addons-config', this._onSocketConfig);
            socket.off('addons:config', this._onSocketConfig);
        }
        if (this._onSocketAction) {
            socket.off('addons-action', this._onSocketAction);
            socket.off('addons:action', this._onSocketAction);
        }
        if (this._onSocketCommand) {
            socket.off('direct-command', this._onSocketCommand);
        }
    }

    dispatchServerCommand(command) {
        if (!this.bot || !command || typeof command !== 'string') return;
        const trimmed = command.trim();
        if (!trimmed) return;
        const formatted = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        console.log(`[AddonsManager:${this.agentName}] Direct command dispatch: ${formatted}`);
        try {
            this.bot.chat(formatted);
        } catch (err) {
            console.warn(`[AddonsManager:${this.agentName}] Direct command failed:`, err.message);
        }
    }

    /**
     * Unified Central Tick Loop
     * Dispatches tasks according to dedicated frequency schedules.
     */
    masterTick() {
        this._tickCount++;
        const t = this._tickCount;

        // Every 100ms (Every Tick): Totem responsiveness (CPS booster runs its own high-frequency timer)
        if (this.config.auto_totem) this.modules.auto_totem.tick();
        if (this.config.cps_booster) this.modules.cps_booster.tick();

        // Every 200ms (t % 2): Namespaced fallback action mailbox (async check)
        if (t % 2 === 0) {
            this.pollActions();
        }

        this.tickGrindQueue();
        this.schematicBuilder.tick();

        // Every 500ms (t % 5): Vitality safeguards (Gapple & Panic)
        if (t % 5 === 0) {
            if (this.config.auto_gapple) this.modules.auto_gapple.tick();
            if (this.config.panic_escape) this.modules.panic_escape.tick();
        }

        // Every 1000ms (t % 10): Threat Radar
        if (t % 10 === 0) {
            if (this.config.player_radar) this.modules.player_radar.tick();
        }

        // Every 1500ms (t % 15): Armor management & Dashboard Live Telemetry
        if (t % 15 === 0) {
            if (this.config.auto_armor) this.modules.auto_armor.tick();
            this.writeLiveTelemetry();
        }

        // Every 2000ms (t % 20): Auto-Loot ground scan & Auto-Sell check
        if (t % 20 === 0) {
            if (this.config.auto_loot) this.modules.auto_loot.tick();
            if (this.config.shop_gui) this.modules.shop_gui.tick();
        }
    }

    executeAction(data) {
        if (!data) return;
        const action = data.action || data.type;
        if (!action) return;
        const actionId = typeof data.id === 'string' ? data.id : '';
        if (actionId) {
            if (this._processedActionIds.has(actionId)) {
                console.log(`[AddonsManager:${this.agentName}] Ignored duplicate action delivery: ${action}`);
                return;
            }
            this._processedActionIds.add(actionId);
            this._processedActionOrder.push(actionId);
            if (this._processedActionOrder.length > 512) {
                const expiredId = this._processedActionOrder.shift();
                this._processedActionIds.delete(expiredId);
            }
        }
        console.log(`[AddonsManager:${this.agentName}] Executing action: ${action}`);
        switch (action) {
            case 'shopgui':
                this.modules.shop_gui.openShop();
                break;
            case 'sell_all':
                this.modules.shop_gui.sellAll();
                break;
            case 'bal':
                this.modules.shop_gui.checkBalance();
                break;
            case 'totem':
                this.modules.auto_totem.checkAndEquip();
                break;
            case 'eat':
                this.modules.auto_gapple.checkAndEat();
                break;
            case 'armor':
                this.modules.auto_armor.checkAndEquipArmor();
                break;
            case 'loot':
                this.modules.auto_loot.tick();
                break;
            case 'command':
            case 'send_command':
                if (data.command) {
                    this.dispatchServerCommand(data.command);
                }
                break;
            case 'grind_start':
                this.queueGrindJob(data.params || {});
                break;
            case 'grind_pause':
                this.pauseGrindJob();
                break;
            case 'grind_resume':
                this.resumeGrindJob();
                break;
            case 'grind_cancel':
                this.cancelGrindJob(data.params?.jobId);
                break;
            case 'schematic_start':
                this.schematicBuilder.start(data.params || {}).catch(error => {
                    console.warn(`[AddonsManager:${this.agentName}] Schematic start failed: ${error.message}`);
                });
                break;
            case 'schematic_pause':
                this.schematicBuilder.pause();
                break;
            case 'schematic_resume':
                this.schematicBuilder.resume(data.params || {});
                break;
            case 'schematic_cancel':
                this.schematicBuilder.cancel();
                break;
        }
    }

    loadGrindState() {
        try {
            const saved = JSON.parse(fs.readFileSync(this.grindFile, 'utf8'));
            if (saved && typeof saved === 'object') {
                this.grindState = {
                    current: saved.current && typeof saved.current === 'object' ? saved.current : null,
                    queue: Array.isArray(saved.queue) ? saved.queue : [],
                    history: Array.isArray(saved.history) ? saved.history.slice(0, 10) : []
                };
            }
        } catch (_) {}

        if (this.grindState.current?.status === 'running' || this.grindState.current?.status === 'pausing') {
            this.grindState.current.status = 'paused';
            this.grindState.current.message = 'Paused after restart. Resume when the bot is ready.';
            this.grindState.current.updatedAt = Date.now();
            this.persistGrindState();
        }
    }

    persistGrindState() {
        try {
            const temp = `${this.grindFile}.tmp-${process.pid}`;
            fs.writeFileSync(temp, `${JSON.stringify(this.grindState, null, 2)}\n`, 'utf8');
            fs.renameSync(temp, this.grindFile);
        } catch (error) {
            console.warn(`[AddonsManager:${this.agentName}] Could not persist grind jobs: ${error.message}`);
        }
    }

    queueGrindJob(params) {
        const target = String(params.target || '').trim().toLowerCase();
        const count = Number(params.count);
        const requestedId = typeof params.jobId === 'string' && params.jobId.trim() && params.jobId.length <= 100
            ? params.jobId.trim()
            : null;
        if (requestedId && [this.grindState.current, ...this.grindState.queue, ...this.grindState.history].some(job => job?.id === requestedId)) {
            return true;
        }
        if (!GRIND_TARGETS.has(target)) {
            console.warn(`[AddonsManager:${this.agentName}] Rejected unsupported grind target: ${target}`);
            return false;
        }
        if (!Number.isInteger(count) || count < 1 || count > 128) {
            console.warn(`[AddonsManager:${this.agentName}] Rejected invalid grind count: ${params.count}`);
            return false;
        }
        if (this.grindState.queue.length >= 5) {
            console.warn(`[AddonsManager:${this.agentName}] Grind queue is full.`);
            return false;
        }

        const job = {
            id: requestedId
                ? requestedId
                : `grind-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            target,
            requested: count,
            completed: 0,
            status: 'queued',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            message: 'Waiting for ENI1 to become idle.'
        };
        this.grindState.queue.push(job);
        this.persistGrindState();
        this.writeLiveTelemetry();
        return true;
    }

    tickGrindQueue() {
        if (this._grindExecutionPromise || this.schematicBuilder.execution) return;
        const schematicStatus = this.schematicBuilder.state.current?.status;
        if (['queued', 'running', 'pausing'].includes(schematicStatus)) return;
        if (!this.grindState.current && this.grindState.queue.length) {
            this.grindState.current = this.grindState.queue.shift();
            this.persistGrindState();
        }
        const job = this.grindState.current;
        if (!job || job.status !== 'queued' || !this.agent?.isIdle?.()) return;
        if (this.agent?.self_prompter?.isActive?.() || this.bot?.currentWindow || this.bot?.pathfinder?.isMoving?.()) return;
        this._grindStopRequested = false;
        this._grindExecutionPromise = this.runGrindJob(job).finally(() => {
            this._grindExecutionPromise = null;
            this.persistGrindState();
            this.writeLiveTelemetry();
        });
    }

    async runGrindJob(job) {
        job.status = 'running';
        job.startedAt ||= Date.now();
        job.updatedAt = Date.now();
        job.message = 'Collecting nearby blocks. Ore targets must be visible to the bot.';
        this.persistGrindState();
        this.writeLiveTelemetry();

        let result = null;
        try {
            result = await this.agent.actions.runAction(`Dashboard Grind: ${job.target}`, async () => {
                while (job.completed < job.requested) {
                    if (this._grindStopRequested || this.bot.interrupt_code) break;
                    if (this._inventoryLocked || this.bot.currentWindow) {
                        await new Promise(resolve => setTimeout(resolve, 250));
                        continue;
                    }
                    let acquiredInventoryLock = false;
                    let collected = false;
                    await this.withInventoryLock(async () => {
                        acquiredInventoryLock = true;
                        collected = await skills.collectBlock(this.bot, job.target, 1);
                    });
                    if (!acquiredInventoryLock) {
                        await new Promise(resolve => setTimeout(resolve, 250));
                        continue;
                    }
                    if (!collected) {
                        if (this._grindStopRequested || this.bot.interrupt_code) break;
                        job.status = 'blocked';
                        job.message = `No more collectable ${job.target} found nearby, or the current tool cannot harvest it.`;
                        break;
                    }
                    job.completed++;
                    job.updatedAt = Date.now();
                    job.message = `Collected ${job.completed} of ${job.requested} blocks.`;
                    this.persistGrindState();
                    this.writeLiveTelemetry();
                }
            }, { timeout: 30 });
        } catch (error) {
            job.status = 'blocked';
            job.message = error?.message || String(error);
        }

        job.updatedAt = Date.now();
        if (job.completed >= job.requested) {
            job.status = 'completed';
            job.message = `Completed: collected ${job.completed} ${job.target}.`;
            job.finishedAt = Date.now();
            this.grindState.history.unshift({ ...job });
            this.grindState.history = this.grindState.history.slice(0, 10);
            this.grindState.current = null;
        } else if (job.status === 'cancelling') {
            job.status = 'cancelled';
            job.message = 'Job cancelled.';
            job.finishedAt = Date.now();
            this.grindState.history.unshift({ ...job });
            this.grindState.history = this.grindState.history.slice(0, 10);
            this.grindState.current = null;
        } else if (job.status === 'pausing' || this._grindStopRequested || result?.interrupted) {
            job.status = 'paused';
            job.message = 'Paused. Resume this job to continue.';
        } else if (job.status === 'running') {
            job.status = result?.success === false ? 'blocked' : 'paused';
            job.message = result?.message || 'Job stopped before completion.';
        }
        this.persistGrindState();
        this.writeLiveTelemetry();
    }

    pauseGrindJob(message = 'Paused. Resume this job to continue.') {
        const job = this.grindState.current;
        if (!job) return false;
        if (job.status === 'queued') {
            job.status = 'paused';
            job.message = message;
            job.updatedAt = Date.now();
        } else if (job.status === 'running') {
            job.status = 'pausing';
            job.message = 'Pausing after the current block action…';
            job.updatedAt = Date.now();
            this._grindStopRequested = true;
            if (this.agent?.actions?.currentActionLabel?.startsWith('Dashboard Grind:')) {
                this.agent.requestInterrupt();
            }
        }
        this.persistGrindState();
        this.writeLiveTelemetry();
        return true;
    }

    cancelGrindJob(jobId) {
        const current = this.grindState.current;
        if (current && (!jobId || current.id === jobId)) {
            if (current.status === 'running' || current.status === 'pausing' || current.status === 'cancelling') {
                current.status = 'cancelling';
                current.message = 'Stopping after the current block action…';
                current.updatedAt = Date.now();
                this._grindStopRequested = true;
                if (this.agent?.actions?.currentActionLabel?.startsWith('Dashboard Grind:')) {
                    this.agent.requestInterrupt();
                }
            } else {
                current.status = 'cancelled';
                current.message = 'Job cancelled.';
                current.updatedAt = Date.now();
                current.finishedAt = Date.now();
                this.grindState.history.unshift({ ...current });
                this.grindState.history = this.grindState.history.slice(0, 10);
                this.grindState.current = null;
            }
            this.persistGrindState();
            this.writeLiveTelemetry();
            return true;
        }

        const index = this.grindState.queue.findIndex(job => !jobId || job.id === jobId);
        if (index < 0) return false;
        const [job] = this.grindState.queue.splice(index, 1);
        job.status = 'cancelled';
        job.message = 'Job cancelled before it started.';
        job.updatedAt = Date.now();
        job.finishedAt = Date.now();
        this.grindState.history.unshift({ ...job });
        this.grindState.history = this.grindState.history.slice(0, 10);
        this.persistGrindState();
        this.writeLiveTelemetry();
        return true;
    }

    resumeGrindJob() {
        const job = this.grindState.current;
        if (job && (job.status === 'paused' || job.status === 'blocked')) {
            job.status = 'queued';
            job.message = 'Waiting for ENI1 to become idle.';
            job.updatedAt = Date.now();
            this._grindStopRequested = false;
        }
        this.persistGrindState();
        this.writeLiveTelemetry();
    }

    async pollActions() {
        try {
            const files = (await fs.promises.readdir(this.actionQueueDir))
                .filter(name => name.endsWith('.json'))
                .sort()
                .slice(0, 32);
            for (const name of files) {
                const actionPath = path.join(this.actionQueueDir, name);
                try {
                    const raw = await fs.promises.readFile(actionPath, 'utf8');
                    await fs.promises.unlink(actionPath).catch(() => {});
                    this.executeAction(JSON.parse(raw));
                } catch (error) {
                    await fs.promises.unlink(actionPath).catch(() => {});
                    console.warn(`[AddonsManager:${this.agentName}] Skipped queued action ${name}: ${error.message}`);
                }
            }
        } catch (_) {
            // The durable action queue is optional; keep polling the legacy mailbox below.
        }
        try {
            const raw = await fs.promises.readFile(this.actionFile, 'utf8');
            await fs.promises.unlink(this.actionFile).catch(() => {});
            const data = JSON.parse(raw);
            for (const action of (Array.isArray(data) ? data : [data])) this.executeAction(action);
        } catch (_) {
            // File does not exist or invalid JSON; ignore without blocking event loop
        }
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const parsed = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...DEFAULT_CONFIG, ...parsed };
                return;
            }
            if (fs.existsSync(ROOT_CONFIG_FILE)) {
                const parsed = JSON.parse(fs.readFileSync(ROOT_CONFIG_FILE, 'utf8'));
                this.config = { ...DEFAULT_CONFIG, ...parsed };
                this.saveConfig();
                return;
            }
        } catch (e) {
            console.warn(`[AddonsManager:${this.agentName}] Failed to parse config JSON:`, e.message);
        }
        this.config = { ...DEFAULT_CONFIG };
        this.saveConfig();
    }

    saveConfig() {
        fs.promises.writeFile(this.configFile, JSON.stringify(this.config, null, 2) + '\n', 'utf8').catch((e) => {
            console.warn(`[AddonsManager:${this.agentName}] Failed to write ${path.basename(this.configFile)}:`, e.message);
        });
    }

    applyConfig() {
        if (this.config.auto_totem) this.modules.auto_totem.enable();
        else this.modules.auto_totem.disable();

        if (this.config.auto_gapple) this.modules.auto_gapple.enable();
        else this.modules.auto_gapple.disable();

        if (this.config.auto_armor) this.modules.auto_armor.enable();
        else this.modules.auto_armor.disable();

        if (this.config.cps_booster) this.modules.cps_booster.enable(this.config.cps_value, this.config.cps_cooldown_mode);
        else this.modules.cps_booster.disable();

        if (this.config.panic_escape) this.modules.panic_escape.enable();
        else this.modules.panic_escape.disable();

        if (this.config.player_radar) this.modules.player_radar.enable();
        else this.modules.player_radar.disable();

        if (this.config.auto_loot) this.modules.auto_loot.enable();
        else this.modules.auto_loot.disable();

        if (this.config.shop_gui) this.modules.shop_gui.enable(this.config.auto_sell);
        else this.modules.shop_gui.disable();
    }

    writeLiveTelemetry() {
        if (!this.bot || !this.bot.entity) return;

        try {
            const health = Math.round(this.bot.health ?? 20);
            const maxHealth = Math.round(this.bot.maxHealth ?? 20);
            const food = Math.round(this.bot.food ?? 20);
            const totems = this.modules.auto_totem.getTotemCount();
            const gapples = this.modules.auto_gapple.getGappleCount();
            const radar = this.modules.player_radar.getRadarData();
            const balance = this.modules.shop_gui.currentBalance;

            const telemetry = {
                agentName: this.agent.name || this.agentName,
                timestamp: Date.now(),
                health,
                maxHealth,
                food,
                totems,
                gapples: gapples.gapples,
                egapples: gapples.egapples,
                balance,
                radar,
            config: this.config,
            grind: this.grindState,
            schematic: this.schematicBuilder?.state || { current: null, history: [] }
            };

            const socket = serverProxy.getSocket?.();
            if (socket && socket.connected) {
                socket.emit('addons-live', this.agent.name || this.agentName, telemetry);
            }

            // Non-blocking per-agent fallback telemetry file write
            fs.promises.writeFile(this.liveFile, JSON.stringify(telemetry, null, 2) + '\n', 'utf8').catch(() => {});
        } catch (_) {}
    }
}
