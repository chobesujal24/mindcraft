/**
 * Player Radar & Threat Tracker Module
 * Continuously tracks all players within 32 blocks render distance.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

export class PlayerRadar {
    constructor(bot, alertDistance = 32) {
        this.bot = bot;
        this.enabled = false;
        this.alertDistance = alertDistance;
        this.nearbyPlayers = [];
        this.lastAlertTimes = new Map();
    }

    enable() {
        this.enabled = true;
        console.log(`[Addon:PlayerRadar] Enabled (Radius: ${this.alertDistance} blocks)`);
        this.scanPlayers();
    }

    disable() {
        this.enabled = false;
        this.nearbyPlayers = [];
        this.lastAlertTimes.clear();
        console.log('[Addon:PlayerRadar] Disabled');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled) return;
        this.scanPlayers();
    }

    isEntitySneaking(ent) {
        if (!ent) return false;
        if (ent.crouching === true) return true;

        // Version-safe pose check (numeric 5 in some versions, or string 'crouching' / 'CROUCHING' / 'sneaking')
        const pose = ent.pose ?? ent.metadata?.[6];
        if (
            pose === 5 ||
            (typeof pose === 'string' && (pose.toLowerCase() === 'crouching' || pose.toLowerCase() === 'sneaking'))
        ) {
            return true;
        }

        // Safely check typeof ent.metadata?.[0] === 'number' before bitwise operation
        if (typeof ent.metadata?.[0] === 'number' && (ent.metadata[0] & 0x02) !== 0) {
            return true;
        }

        return false;
    }

    scanPlayers() {
        if (!this.enabled || !this.bot || !this.bot.entity || !this.bot.entities) return;

        const myPos = this.bot.entity.position;
        const myName = this.bot.username || '';
        const found = [];
        const activeUsernames = new Set();
        const now = Date.now();

        // Whitelist crew / bot accounts
        const whitelist = new Set([
            myName.toLowerCase(),
            'deepminer', 'surfacegrinder', 'villagertech', 'schematicbuilder', 'foreman'
        ]);

        for (const id in this.bot.entities) {
            const ent = this.bot.entities[id];
            if (!ent || ent.type !== 'player' || !ent.username || ent.username === myName || !ent.position) continue;

            activeUsernames.add(ent.username);
            const dist = myPos.distanceTo(ent.position);

            // Version-safe held item detection
            let held = 'empty';
            if (ent.heldItem && ent.heldItem.name) {
                held = ent.heldItem.name;
            } else if (ent.equipment && ent.equipment[0] && ent.equipment[0].name) {
                held = ent.equipment[0].name;
            }

            // Version-safe crouching / sneaking detection
            const isSneaking = this.isEntitySneaking(ent);

            const playerInfo = {
                username: ent.username,
                distance: Number(dist.toFixed(1)),
                x: Math.round(ent.position.x),
                y: Math.round(ent.position.y),
                z: Math.round(ent.position.z),
                heldItem: held,
                isSneaking
            };
            found.push(playerInfo);

            // Proximity alert for non-whitelisted players
            if (dist <= this.alertDistance && !whitelist.has(ent.username.toLowerCase())) {
                const lastAlert = this.lastAlertTimes.get(ent.username) || 0;
                if (now - lastAlert > 30000) {
                    this.lastAlertTimes.set(ent.username, now);
                    const alertMsg = `⚠️ [Radar Alert] Player ${ent.username} detected (${playerInfo.distance}m) holding ${playerInfo.heldItem} at X:${playerInfo.x} Y:${playerInfo.y} Z:${playerInfo.z}!`;
                    console.warn(alertMsg);
                    if (this.bot.agent && this.bot.agent.prompter?.profile?.owner_only) {
                        try { this.bot.agent.openChat(alertMsg); } catch (_) {}
                    }
                }
            }
        }

        // Prune stale entries from this.lastAlertTimes when players leave or go out of range (> 60s old & not active)
        for (const [username, lastTime] of this.lastAlertTimes.entries()) {
            if (!activeUsernames.has(username) || now - lastTime > 120000) {
                this.lastAlertTimes.delete(username);
            }
        }

        found.sort((a, b) => a.distance - b.distance);
        this.nearbyPlayers = found;
    }

    getRadarData() {
        return this.nearbyPlayers;
    }
}
