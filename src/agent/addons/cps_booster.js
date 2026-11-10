/**
 * CPS Booster Module
 * High-cadence attack optimizer for 1.8 high-CPS and 1.9+ cooldown-aware servers.
 * Decoupled from the 100ms master loop so CPS > 10 works accurately without cap,
 * and pauses while eating gapples or breaking blocks.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

const HOSTILE_MOBS = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman',
    'witch', 'blaze', 'slime', 'magma_cube', 'drowned', 'husk', 'stray',
    'phantom', 'pillager', 'vindicator', 'evoker', 'ravager', 'vex',
    'piglin', 'piglin_brute', 'zombified_piglin', 'hoglin', 'zoglin',
    'wither', 'wither_skeleton', 'guardian', 'elder_guardian', 'shulker',
    'warden', 'breeze', 'bogged', 'silverfish', 'endermite', 'ghast'
]);

// 1.9+ weapon attack cooldown durations (ms) for full-strength hits
const WEAPON_COOLDOWN_MS = {
    sword: 625,
    trident: 910,
    axe: 1000,
    pickaxe: 833,
    shovel: 1000,
    hoe: 500
};

export class CpsBooster {
    constructor(bot, cps = 12, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.modules = manager?.modules || null;
        this.enabled = false;
        this.cps = cps;
        this.cooldownMode = false; // false = 1.8 high-CPS mode, true = 1.9+ weapon cooldown mode
        this.targetEntity = null;
        this.lastAttackTime = 0;
        this._attackTimer = null;
    }

    enable(targetCps, cooldownMode = false) {
        if (targetCps !== undefined && targetCps !== null) {
            this.cps = Math.max(1, Math.min(30, Number(targetCps) || 12));
        }
        if (cooldownMode !== undefined) {
            this.cooldownMode = Boolean(cooldownMode);
        }
        if (this.manager?.modules) {
            this.modules = this.manager.modules;
        }
        this.enabled = true;
        this._startAttackLoop();
        console.log(`[Addon:CpsBooster] Enabled (${this.cooldownMode ? '1.9+ Cooldown Mode' : `${this.cps} CPS`})`);
    }

    disable() {
        this.enabled = false;
        this.targetEntity = null;
        this._stopAttackLoop();
        console.log('[Addon:CpsBooster] Disabled');
    }

    setCps(value) {
        this.cps = Math.max(1, Math.min(30, Number(value) || 12));
        if (this.enabled) this._startAttackLoop();
    }

    setCooldownMode(enabled) {
        this.cooldownMode = Boolean(enabled);
        if (this.enabled) this._startAttackLoop();
    }

    setTarget(entity) {
        this.targetEntity = entity;
    }

    clearTarget() {
        this.targetEntity = null;
    }

    _getRequiredIntervalMs() {
        if (this.cooldownMode) {
            const heldName = this.bot?.heldItem?.name || '';
            for (const [suffix, ms] of Object.entries(WEAPON_COOLDOWN_MS)) {
                if (heldName.endsWith(`_${suffix}`) || heldName === suffix) {
                    return ms;
                }
            }
            return 250; // 1.9+ unarmed / default 4.0 attack speed (250ms)
        }
        return Math.max(33, Math.round(1000 / this.cps));
    }

    _startAttackLoop() {
        this._stopAttackLoop();
        if (!this.enabled) return;
        const step = () => {
            if (!this.enabled) return;
            this._executeAttackTick();
            this._attackTimer = setTimeout(step, Math.min(25, this._getRequiredIntervalMs()));
        };
        this._attackTimer = setTimeout(step, 25);
    }

    _stopAttackLoop() {
        if (this._attackTimer) {
            clearTimeout(this._attackTimer);
            this._attackTimer = null;
        }
    }

    /** Called by Central Scheduler (kept as fallback health check) */
    tick() {
        if (!this.enabled) return;
        if (!this._attackTimer) {
            this._startAttackLoop();
        }
    }

    _executeAttackTick() {
        if (!this.enabled || !this.bot || !this.bot.entity) return;

        // Do not attack while consuming a golden apple or breaking a block or with an open container
        const modules = this.modules || this.manager?.modules;
        if (modules?.auto_gapple?.isEating) return;
        if (this.bot.targetDigBlock || this.bot.currentWindow) return;

        const now = Date.now();
        const minInterval = this._getRequiredIntervalMs();
        if (now - this.lastAttackTime < minInterval) return;

        // Check explicit target or find nearest hostile
        let target = this.targetEntity;
        if (!target || !this.isTargetValid(target)) {
            target = this.getNearestHostile();
        }

        if (target && this.isTargetValid(target)) {
            const dist = this.bot.entity.position.distanceTo(target.position);
            if (dist <= 4.0) {
                this.lastAttackTime = now;
                try {
                    this.bot.attack(target);
                } catch (_) {}
            }
        }
    }

    isTargetValid(ent) {
        if (!ent || !ent.position) return false;
        if (!this.bot || !this.bot.entities) return false;
        return Boolean(this.bot.entities[ent.id]);
    }

    getNearestHostile() {
        if (!this.bot || !this.bot.entities || !this.bot.entity) return null;
        let nearest = null;
        let minDist = 3.9;
        const myPos = this.bot.entity.position;

        for (const id in this.bot.entities) {
            const ent = this.bot.entities[id];
            if (!ent || ent === this.bot.entity || !ent.position) continue;

            const dist = myPos.distanceTo(ent.position);
            if (dist > minDist) continue;

            const isHostile = (ent.type === 'mob' && HOSTILE_MOBS.has(ent.name)) ||
                              (ent.kind && ent.kind.toLowerCase().includes('hostile'));

            if (isHostile) {
                minDist = dist;
                nearest = ent;
            }
        }
        return nearest;
    }
}
