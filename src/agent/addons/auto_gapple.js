/**
 * Auto-Gapple Module
 * Automatically consumes Golden Apples / Enchanted Gapples when health drops below threshold.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

export class AutoGapple {
    constructor(bot, thresholdHp = 14, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.enabled = false;
        this.thresholdHp = thresholdHp;
        this.isEating = false;
        this.lastEatTime = 0;
    }

    enable() {
        this.enabled = true;
        console.log(`[Addon:AutoGapple] Enabled (HP threshold: ${this.thresholdHp})`);
    }

    disable() {
        this.enabled = false;
        if (this.isEating) {
            try { this.bot.deactivateItem(); } catch (_) {}
            this.isEating = false;
        }
        console.log('[Addon:AutoGapple] Disabled');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled) return;
        this.checkAndEat();
    }

    async checkAndEat() {
        if (!this.enabled || !this.bot || !this.bot.inventory || this.isEating) return;
        if (this.bot.currentWindow) return;

        const currentHp = this.bot.health;
        if (currentHp == null || currentHp > this.thresholdHp) return;

        const now = Date.now();
        if (now - this.lastEatTime < 2500) return;

        const items = this.bot.inventory.items();
        const gapple = items.find(i => i.name === 'enchanted_golden_apple') ||
                       items.find(i => i.name === 'golden_apple');
        if (!gapple) return;

        const consumeGapple = async () => {
            if (!this.enabled || this.bot.currentWindow || this.isEating) return;

            this.isEating = true;
            const autoEatWasEnabled = Boolean(this.bot.autoEat && !this.bot.autoEat.disabled);
            if (this.bot.autoEat && typeof this.bot.autoEat.disable === 'function') {
                try { this.bot.autoEat.disable(); } catch (_) {}
            }

            console.log(`[Addon:AutoGapple] HP is ${currentHp}/${this.bot.maxHealth || 20}. Eating ${gapple.name}...`);

            let onHealth = null;
            let eatTimeout = null;
            try {
                const previousHand = this.bot.heldItem;
                if (this.bot.currentWindow) return;
                await this.bot.equip(gapple, 'hand');
                this.bot.activateItem();

                // Minecraft eating duration is 32 ticks (1.6s). Wait with safety race & clean up listener.
                await new Promise((resolve) => {
                    onHealth = () => {
                        if (this.bot.health > this.thresholdHp) resolve();
                    };
                    this.bot.once('health', onHealth);
                    eatTimeout = setTimeout(resolve, 1700);
                });

                try { this.bot.deactivateItem(); } catch (_) {}
                this.lastEatTime = Date.now();

                // Restore previous weapon/tool if no container opened mid-eat
                if (previousHand && previousHand.type && !this.bot.currentWindow) {
                    await this.bot.equip(previousHand, 'hand').catch(() => {});
                }
                console.log(`[Addon:AutoGapple] Finished eating. HP is now ${this.bot.health}.`);
            } catch (err) {
                console.warn('[Addon:AutoGapple] Eat error:', err.message);
            } finally {
                if (onHealth) {
                    try { this.bot.removeListener('health', onHealth); } catch (_) {}
                }
                if (eatTimeout) {
                    clearTimeout(eatTimeout);
                }
                try { this.bot.deactivateItem(); } catch (_) {}
                if (autoEatWasEnabled && this.bot.autoEat && typeof this.bot.autoEat.enable === 'function') {
                    try { this.bot.autoEat.enable(); } catch (_) {}
                }
                this.isEating = false;
            }
        };

        if (this.manager && typeof this.manager.withInventoryLock === 'function') {
            await this.manager.withInventoryLock(consumeGapple);
        } else {
            await consumeGapple();
        }
    }

    getGappleCount() {
        if (!this.bot || !this.bot.inventory) return { gapples: 0, egapples: 0 };
        let gapples = 0;
        let egapples = 0;
        for (const item of this.bot.inventory.items()) {
            if (item.name === 'golden_apple') gapples += item.count || 1;
            if (item.name === 'enchanted_golden_apple') egapples += item.count || 1;
        }
        return { gapples, egapples };
    }
}
