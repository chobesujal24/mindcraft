/**
 * Panic Escape Module
 * Emergency safeguard: line-of-sight checked pearl throw + /home or /spawn when health drops below critical threshold.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

import Vec3 from 'vec3';

export class PanicEscape {
    constructor(bot, panicHp = 6, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.enabled = false;
        this.panicHp = panicHp;
        this.lastPanicTime = 0;
        this.isPanicking = false;
        this._spawnTimeout = null;
    }

    enable() {
        this.enabled = true;
        console.log(`[Addon:PanicEscape] Enabled (Critical HP threshold: ${this.panicHp})`);
    }

    disable() {
        this.enabled = false;
        this.isPanicking = false;
        if (this._spawnTimeout) {
            clearTimeout(this._spawnTimeout);
            this._spawnTimeout = null;
        }
        console.log('[Addon:PanicEscape] Disabled');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled) return;
        this.checkPanic();
    }

    /**
     * Finds the clearest escape yaw angle by raycasting / checking blocks along the throw trajectory
     * so the bot never throws an ender pearl into an adjacent wall or low ceiling at <= 6 HP.
     */
    findClearestEscapeYaw() {
        if (!this.bot || !this.bot.entity) return null;
        const baseYaw = (this.bot.entity.yaw + Math.PI) % (Math.PI * 2);
        const pitch = -0.6;
        const candidateOffsets = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, Math.PI];
        const eyeHeight = this.bot.entity.height || 1.62;
        const eyePos = this.bot.entity.position.offset(0, eyeHeight, 0);

        let bestYaw = null;
        let bestClearDist = 0;

        for (const offset of candidateOffsets) {
            const yaw = (baseYaw + offset) % (Math.PI * 2);
            const dir = new Vec3(
                -Math.sin(yaw) * Math.cos(pitch),
                Math.sin(-pitch),
                -Math.cos(yaw) * Math.cos(pitch)
            );

            // Check raycast clearance up to 8 blocks out
            let clearDist = 8;
            if (this.bot.world && typeof this.bot.world.raycast === 'function') {
                try {
                    const hit = this.bot.world.raycast(eyePos, dir.normalize(), 8);
                    if (hit && hit.position) {
                        clearDist = eyePos.distanceTo(hit.position);
                    }
                } catch (_) {}
            } else {
                // Fallback manual step raycast along direction vector
                for (let step = 1; step <= 8; step++) {
                    const checkPos = eyePos.plus(dir.scaled(step));
                    const block = this.bot.blockAt(checkPos);
                    if (block && block.boundingBox === 'block' && block.name !== 'air' && block.name !== 'cave_air') {
                        clearDist = step;
                        break;
                    }
                }
            }

            if (clearDist >= 6) {
                return yaw;
            }
            if (clearDist > bestClearDist) {
                bestClearDist = clearDist;
                bestYaw = yaw;
            }
        }

        // Only allow throwing a pearl if there is at least 4 blocks of clearance
        return bestClearDist >= 4 ? bestYaw : null;
    }

    async checkPanic() {
        if (!this.enabled || !this.bot || !this.bot.entity || this.isPanicking) return;

        const hp = this.bot.health;
        if (hp == null || hp > this.panicHp) return;

        const now = Date.now();
        // Cooldown of 12 seconds between panic attempts to avoid command spam
        if (now - this.lastPanicTime < 12000) return;

        this.isPanicking = true;
        this.lastPanicTime = now;
        console.warn(`🚨 [Addon:PanicEscape] CRITICAL HEALTH (${hp} HP)! Initiating emergency escape...`);

        try {
            const pearl = this.bot.inventory?.items().find(i => i.name === 'ender_pearl');
            const escapeYaw = this.findClearestEscapeYaw();

            if (pearl && escapeYaw !== null && !this.bot.currentWindow) {
                const throwPearl = async () => {
                    if (!this.enabled || this.bot.currentWindow) return;
                    console.log('[Addon:PanicEscape] Clear line-of-sight verified. Throwing ender pearl away...');
                    await this.bot.equip(pearl, 'hand');
                    await this.bot.look(escapeYaw, -0.6, true);
                    // Double-check cursor clearance before activating
                    const cursorBlock = typeof this.bot.blockAtCursor === 'function' ? this.bot.blockAtCursor(3.5) : null;
                    if (!cursorBlock) {
                        this.bot.activateItem();
                        await new Promise(resolve => setTimeout(resolve, 800));
                    } else {
                        console.warn('[Addon:PanicEscape] Block obstructed within 3.5m of cursor; skipping pearl throw to prevent self-damage.');
                    }
                };

                if (this.manager && typeof this.manager.withInventoryLock === 'function') {
                    await this.manager.withInventoryLock(throwPearl);
                } else {
                    await throwPearl();
                }
            } else if (pearl && escapeYaw === null) {
                console.warn('[Addon:PanicEscape] Enclosed space detected; skipping ender pearl to avoid fatal wall impact.');
            }

            // Execute emergency command fallback
            console.log('[Addon:PanicEscape] Teleporting to safety (/home or /spawn)...');
            this.bot.chat('/home');
            if (this._spawnTimeout) clearTimeout(this._spawnTimeout);
            this._spawnTimeout = setTimeout(() => {
                this._spawnTimeout = null;
                if (this.enabled && this.bot && this.bot.health <= this.panicHp) {
                    this.bot.chat('/spawn');
                }
            }, 2000);
        } catch (err) {
            console.warn('[Addon:PanicEscape] Escape error:', err.message);
        } finally {
            this.isPanicking = false;
        }
    }
}
