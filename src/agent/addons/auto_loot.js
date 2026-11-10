/**
 * Auto-Loot & Drop Magnet Module
 * Detects nearby dropped items (totems, gapples, netherite gear, diamonds, hearts) and collects them
 * using mineflayer-pathfinder GoalNear / GoalXZ only when agent.isIdle() is true.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

import pf from 'mineflayer-pathfinder';

const HIGH_PRIORITY_ITEMS = new Set([
    'totem_of_undying',
    'enchanted_golden_apple',
    'golden_apple',
    'netherite_sword', 'netherite_pickaxe', 'netherite_axe',
    'netherite_helmet', 'netherite_chestplate', 'netherite_leggings', 'netherite_boots',
    'netherite_ingot', 'diamond_block', 'diamond',
    'heart', 'lifesteal_heart'
]);

export class AutoLoot {
    constructor(bot, searchRadius = 16, agent = null, manager = null) {
        this.bot = bot;
        this.agent = agent || bot?.agent || null;
        this.manager = manager;
        this.enabled = false;
        this.searchRadius = searchRadius;
        this.isCollecting = false;
        this.lastCollectAttempt = 0;
    }

    enable() {
        this.enabled = true;
        console.log(`[Addon:AutoLoot] Enabled (Radius: ${this.searchRadius} blocks)`);
    }

    disable() {
        this.enabled = false;
        this.isCollecting = false;
        console.log('[Addon:AutoLoot] Disabled');
    }

    extractItemName(ent) {
        if (!ent) return '';
        // Method 1: prismarine-entity helper
        if (typeof ent.getDroppedItem === 'function') {
            try {
                const item = ent.getDroppedItem();
                if (item && item.name) return item.name;
            } catch (_) {}
        }
        // Method 2: metadata inspection
        if (ent.metadata && Array.isArray(ent.metadata)) {
            for (const val of ent.metadata) {
                if (val && typeof val === 'object' && val.itemId != null && this.bot.registry) {
                    const itemData = this.bot.registry.items?.[val.itemId];
                    if (itemData && itemData.name) return itemData.name;
                }
            }
        }
        return '';
    }

    /** Called by Central Scheduler */
    async tick() {
        if (!this.enabled || !this.bot || !this.bot.entity || this.isCollecting) return;

        // Only collect loot when agent is idle so we never hijack active pathfinder goals
        const agentRef = this.agent || this.manager?.agent || this.bot.agent;
        if (agentRef && typeof agentRef.isIdle === 'function' && !agentRef.isIdle()) {
            return;
        }
        if (this.bot.pathfinder && typeof this.bot.pathfinder.isMoving === 'function' && this.bot.pathfinder.isMoving()) {
            return;
        }

        const now = Date.now();
        if (now - this.lastCollectAttempt < 1500) return;

        const myPos = this.bot.entity.position;
        let targetDrop = null;
        let isPriority = false;
        let minDist = this.searchRadius;

        for (const id in this.bot.entities) {
            const ent = this.bot.entities[id];
            if (!ent || !ent.position) continue;
            // Dropped items have name 'item' or type 'object'
            if (ent.name !== 'item' && ent.name !== 'Item' && ent.type !== 'object') continue;

            const dist = myPos.distanceTo(ent.position);
            if (dist > this.searchRadius) continue;

            const itemName = this.extractItemName(ent);
            const isHighPri = itemName && (
                HIGH_PRIORITY_ITEMS.has(itemName) ||
                itemName.includes('heart') ||
                itemName.includes('netherite')
            );

            if (isHighPri && (!isPriority || dist < minDist)) {
                targetDrop = ent;
                isPriority = true;
                minDist = dist;
            } else if (!isPriority && dist < minDist) {
                targetDrop = ent;
                minDist = dist;
            }
        }

        if (targetDrop && this.bot.pathfinder) {
            this.isCollecting = true;
            this.lastCollectAttempt = now;
            try {
                const { x, y, z } = targetDrop.position;
                const movements = new pf.Movements(this.bot);
                movements.canDig = false;
                movements.allow1by1towers = false;
                this.bot.pathfinder.setMovements(movements);
                const goal = Number.isFinite(y)
                    ? new pf.goals.GoalNear(x, y, z, 1)
                    : new pf.goals.GoalXZ(x, z);
                await Promise.race([
                    this.bot.pathfinder.goto(goal).catch(() => {}),
                    new Promise(resolve => setTimeout(resolve, 2500))
                ]);
                if (agentRef && typeof agentRef.isIdle === 'function' && agentRef.isIdle()) {
                    this.bot.pathfinder.setGoal(null);
                }
            } catch (_) {
            } finally {
                this.isCollecting = false;
            }
        }
    }
}
