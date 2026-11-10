/**
 * Auto-Armor Module
 * Automatically equips best available armor pieces from inventory.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

const ARMOR_TIERS = {
    netherite: 6,
    diamond: 5,
    iron: 4,
    chainmail: 3,
    golden: 2,
    leather: 1
};

export class AutoArmor {
    constructor(bot, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.enabled = false;
        this.lastCheck = 0;
    }

    enable() {
        this.enabled = true;
        // Disable mineflayer-armor-manager plugin when AutoArmor is active to prevent conflicts
        if (this.bot && this.bot.armorManager) {
            this.bot.armorManager.enabled = false;
        }
        console.log('[Addon:AutoArmor] Enabled');
        this.checkAndEquipArmor();
    }

    disable() {
        this.enabled = false;
        if (this.bot && this.bot.armorManager) {
            this.bot.armorManager.enabled = true;
        }
        console.log('[Addon:AutoArmor] Disabled');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled) return;
        const now = Date.now();
        if (now - this.lastCheck < 1500) return;
        this.lastCheck = now;
        this.checkAndEquipArmor();
    }

    /**
     * Extract normalized enchantments [{ name, lvl }] across both classic NBT (<=1.20.4)
     * and 1.20.5+ / 1.21+ data component structures.
     */
    extractEnchants(item) {
        if (!item) return [];
        const result = [];

        if (Array.isArray(item.enchants) && item.enchants.length > 0) {
            for (const ench of item.enchants) {
                if (ench && ench.name) {
                    result.push({
                        name: String(ench.name).replace(/^minecraft:/, '').toLowerCase(),
                        lvl: Number(ench.lvl ?? ench.level ?? 1)
                    });
                }
            }
        }

        // 1.20.5+ / 1.21+ data components support (item.components / item.componentMap)
        const components = item.components || item.componentMap;
        if (components) {
            const parseCompObj = (compVal) => {
                if (!compVal) return;
                const mapObj = compVal.enchantments || compVal.levels || compVal.data || compVal;
                if (Array.isArray(mapObj)) {
                    for (const entry of mapObj) {
                        const id = entry?.id ?? entry?.name;
                        if (id != null) {
                            result.push({
                                name: String(id).replace(/^minecraft:/, '').toLowerCase(),
                                lvl: Number(entry.level ?? entry.lvl ?? 1)
                            });
                        }
                    }
                } else if (typeof mapObj === 'object') {
                    for (const [k, v] of Object.entries(mapObj)) {
                        result.push({
                            name: String(k).replace(/^minecraft:/, '').toLowerCase(),
                            lvl: Number(v?.level ?? v?.lvl ?? v ?? 1)
                        });
                    }
                }
            };

            if (typeof components.get === 'function') {
                parseCompObj(components.get('enchantments') || components.get('minecraft:enchantments'));
            } else if (Array.isArray(components)) {
                for (const c of components) {
                    if (c?.type === 'enchantments' || c?.type === 'minecraft:enchantments') {
                        parseCompObj(c.data || c);
                    }
                }
            } else if (typeof components === 'object') {
                parseCompObj(components.enchantments || components['minecraft:enchantments']);
            }
        }

        return result;
    }

    hasCurseOfBinding(item) {
        if (!item) return false;
        const enchants = this.extractEnchants(item);
        return enchants.some(e => e.name === 'binding_curse' || e.name === 'curse_of_binding' || e.name.includes('binding'));
    }

    getPieceScore(item) {
        if (!item || !item.name) return 0;
        let score = 0;
        for (const [material, tier] of Object.entries(ARMOR_TIERS)) {
            if (item.name.startsWith(material + '_')) {
                score = tier * 10;
                break;
            }
        }

        // Weight full protection higher than specialized protection (blast/projectile/fire)
        const enchants = this.extractEnchants(item);
        for (const ench of enchants) {
            const lvl = ench.lvl || 1;
            if (ench.name === 'protection') {
                score += lvl * 3;
            } else if (
                ench.name === 'blast_protection' ||
                ench.name === 'projectile_protection' ||
                ench.name === 'fire_protection' ||
                ench.name.includes('protection')
            ) {
                score += lvl * 1.25;
            } else if (ench.name === 'unbreaking') {
                score += lvl * 0.5;
            } else if (ench.name === 'mending') {
                score += 1.5;
            } else if (ench.name === 'thorns') {
                score += lvl * 0.5;
            }
        }
        return score;
    }

    async checkAndEquipArmor() {
        if (!this.enabled || !this.bot || !this.bot.inventory) return;
        if (this.bot.currentWindow) return;

        const slots = {
            head: { slot: 5, suffix: '_helmet', dest: 'head' },
            torso: { slot: 6, suffix: '_chestplate', dest: 'torso' },
            legs: { slot: 7, suffix: '_leggings', dest: 'legs' },
            feet: { slot: 8, suffix: '_boots', dest: 'feet' }
        };

        const runEquipPass = async () => {
            for (const [part, info] of Object.entries(slots)) {
                if (!this.enabled || this.bot.currentWindow) return;

                const currentItem = this.bot.inventory.slots[info.slot];
                // Cannot unequip/replace an item that has Curse of Binding
                if (this.hasCurseOfBinding(currentItem)) continue;

                const currentScore = this.getPieceScore(currentItem);
                const allItems = this.bot.inventory.items();

                // Skip candidates with Curse of Binding
                const candidates = allItems.filter(i => i.name.endsWith(info.suffix) && !this.hasCurseOfBinding(i));
                if (candidates.length === 0) continue;

                candidates.sort((a, b) => this.getPieceScore(b) - this.getPieceScore(a));
                const bestPiece = candidates[0];

                if (this.getPieceScore(bestPiece) > currentScore) {
                    if (!this.enabled || this.bot.currentWindow) return;
                    try {
                        await this.bot.equip(bestPiece, info.dest);
                        console.log(`[Addon:AutoArmor] Equipped ${bestPiece.name} to ${part}`);
                    } catch (_) {}
                }
            }
        };

        if (this.manager && typeof this.manager.withInventoryLock === 'function') {
            await this.manager.withInventoryLock(runEquipPass);
        } else {
            await runEquipPass();
        }
    }
}
