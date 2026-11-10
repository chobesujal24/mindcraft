/**
 * Auto-Totem Module
 * Automatically equips Totem of Undying into slot 45 (off-hand).
 * 0ms instant reaction on totem pop packet or offhand emptiness.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

export class AutoTotem {
    constructor(bot, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.enabled = false;
        this._onEntityStatus = null;
        this._isEquipping = false;
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        console.log('[Addon:AutoTotem] Enabled');

        // Check offhand immediately
        this.checkAndEquip();

        // Safe hook into entity_status packet if available
        if (this.bot._client && typeof this.bot._client.on === 'function') {
            this._onEntityStatus = (packet) => {
                if (!this.enabled) return;
                // Opcode 35 = Totem of Undying used / popped
                if (packet.entityId === this.bot.entity?.id && packet.entityStatus === 35) {
                    console.log('[Addon:AutoTotem] Totem pop detected! Re-equipping offhand...');
                    setImmediate(() => this.checkAndEquip());
                }
            };
            this.bot._client.on('entity_status', this._onEntityStatus);
        }
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        if (this._onEntityStatus && this.bot._client && typeof this.bot._client.removeListener === 'function') {
            try { this.bot._client.removeListener('entity_status', this._onEntityStatus); } catch (_) {}
            this._onEntityStatus = null;
        }
        console.log('[Addon:AutoTotem] Disabled');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled) return;
        this.checkAndEquip();
    }

    async checkAndEquip() {
        if (!this.enabled || !this.bot || !this.bot.inventory || this._isEquipping) return;
        if (this.bot.currentWindow) return;

        // Offhand slot in Mineflayer is slot 45
        const offhand = this.bot.inventory.slots[45];
        if (offhand && offhand.name === 'totem_of_undying') {
            return; // Offhand already holds totem
        }

        // Find totem in main inventory
        const totem = this.bot.inventory.items().find(i => i.name === 'totem_of_undying');
        if (!totem) return;

        const doEquip = async () => {
            if (!this.enabled || this.bot.currentWindow) return;
            this._isEquipping = true;
            try {
                await this.bot.equip(totem, 'off-hand');
                console.log('[Addon:AutoTotem] Equipped Totem of Undying to off-hand');
            } catch (_) {
            } finally {
                this._isEquipping = false;
            }
        };

        if (this.manager && typeof this.manager.withInventoryLock === 'function') {
            await this.manager.withInventoryLock(doEquip);
        } else {
            await doEquip();
        }
    }

    getTotemCount() {
        if (!this.bot || !this.bot.inventory) return 0;
        let count = 0;
        const offhand = this.bot.inventory.slots[45];
        if (offhand && offhand.name === 'totem_of_undying') count += offhand.count || 1;
        for (const item of this.bot.inventory.items()) {
            if (item.name === 'totem_of_undying') count += item.count || 1;
        }
        return count;
    }
}
