/**
 * ShopGUI & Economy Assistant Module
 * Opens the server shop via /shopgui, handles windowOpen events cleanly,
 * executes /sell all, and tracks wallet balance with anti-spoofing chat filters.
 * Pure deterministic code — consumes 0 LLM tokens / 0 RPM.
 */

// Strictly anchored balance regexes that reject player chat prefixes (<Player>, [Rank] Name:, Player -> me)
const PLAYER_CHAT_PREFIX_RX = /^(?:<[^>]+>|(?:\[[^\]]+\]\s*)*[a-zA-Z0-9_.]{2,20}\s*(?:»|:|->|\baid\b)|\[(?:msg|whisper|pm|tell)\b)/i;
const ANCHORED_BALANCE_RX = /^(?:\[(?:Server|Economy|Shop|ShopGUI|Bal|Money|Essentials)\]\s*)?(?:Your\s+(?:current\s+)?(?:balance|money|funds)(?:\s+is)?|(?:Current\s+)?(?:balance|bal|money|funds))\s*:\s*([$€£]?[0-9,]+(?:\.[0-9]+)?(?:\s*(?:coins|dollars|tokens|gems|\$))?)$/i;
const ANCHORED_YOU_HAVE_RX = /^(?:\[(?:Server|Economy|Shop|ShopGUI|Bal|Money|Essentials)\]\s*)?You\s+have\s+([$€£][0-9,]+(?:\.[0-9]+)?)(?:\s+in\s+your\s+account)?\.?$/i;

export class ShopGui {
    constructor(bot, manager = null) {
        this.bot = bot;
        this.manager = manager;
        this.enabled = false;
        this.autoSell = false;
        this.currentBalance = '$0';
        this._onChat = null;
        this._onWindowOpen = null;
        this._expectingShopWindow = false;
        this._windowCloseTimer = null;
        this.lastAutoSell = 0;
    }

    enable(autoSell = false) {
        if (this.enabled) {
            this.autoSell = Boolean(autoSell);
            return;
        }
        this.enabled = true;
        this.autoSell = Boolean(autoSell);
        console.log(`[Addon:ShopGUI] Enabled (Auto-sell: ${this.autoSell ? 'ON' : 'OFF'})`);

        // Listen for server-only balance and transaction messages (reject player chat spoofing)
        this._onChat = (message) => {
            const str = String(message || '').replace(/[§&][0-9a-fk-or]/gi, '').trim();
            if (!str) return;
            // Reject any line that looks like a player chat message or private whisper
            if (PLAYER_CHAT_PREFIX_RX.test(str)) return;

            const balMatch = str.match(ANCHORED_BALANCE_RX) || str.match(ANCHORED_YOU_HAVE_RX);
            if (balMatch) {
                this.currentBalance = balMatch[1].trim();
                console.log(`[Addon:ShopGUI] Updated balance: ${this.currentBalance}`);
            }
        };
        this.bot.on('messagestr', this._onChat);

        // Handle windowOpen events when /shopgui opens a container so the GUI never gets stuck open
        this._onWindowOpen = async (window) => {
            if (!this.enabled || !this._expectingShopWindow) return;
            this._expectingShopWindow = false;
            const title = typeof window.title === 'string' ? window.title : JSON.stringify(window.title || '');
            console.log(`[Addon:ShopGUI] Shop container opened: ${title} (${window.slots?.length || 0} slots)`);

            if (this._windowCloseTimer) clearTimeout(this._windowCloseTimer);
            this._windowCloseTimer = setTimeout(() => {
                this._windowCloseTimer = null;
                if (this.bot && this.bot.currentWindow && this.bot.currentWindow.id === window.id) {
                    try {
                        this.bot.closeWindow(window);
                        console.log('[Addon:ShopGUI] Closed shop container window cleanly.');
                    } catch (_) {}
                }
            }, 2500);
        };
        this.bot.on('windowOpen', this._onWindowOpen);

        // Fetch balance initially
        setTimeout(() => {
            if (this.enabled) this.checkBalance();
        }, 3000);
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.autoSell = false;
        this._expectingShopWindow = false;
        if (this._windowCloseTimer) {
            clearTimeout(this._windowCloseTimer);
            this._windowCloseTimer = null;
        }
        if (this._onChat) {
            this.bot.removeListener('messagestr', this._onChat);
            this._onChat = null;
        }
        if (this._onWindowOpen) {
            this.bot.removeListener('windowOpen', this._onWindowOpen);
            this._onWindowOpen = null;
        }
        console.log('[Addon:ShopGUI] Disabled');
    }

    setAutoSell(value) {
        this.autoSell = Boolean(value);
        console.log(`[Addon:ShopGUI] AutoSell set to ${this.autoSell ? 'ON' : 'OFF'}`);
    }

    openShop() {
        if (!this.bot) return;
        console.log('[Addon:ShopGUI] Opening shop via /shopgui');
        this._expectingShopWindow = true;
        this.bot.chat('/shopgui');
    }

    sellAll() {
        if (!this.bot) return;
        console.log('[Addon:ShopGUI] Executing /sell all');
        this.bot.chat('/sell all');
    }

    checkBalance() {
        if (!this.bot) return;
        this.bot.chat('/bal');
    }

    /** Called by Central Scheduler */
    tick() {
        if (!this.enabled || !this.autoSell || !this.bot || !this.bot.inventory) return;

        const now = Date.now();
        // Check auto-sell at most once every 60 seconds
        if (now - this.lastAutoSell < 60000) return;

        // Version-safe empty slot calculation (slots 9-44 are main inventory)
        const emptySlots = this.bot.inventory.slots.slice(9, 45).filter(s => s == null).length;
        if (emptySlots <= 4) {
            this.lastAutoSell = now;
            console.log(`[Addon:ShopGUI] Inventory full (${emptySlots} empty slots). Running /sell all...`);
            this.sellAll();
        }
    }
}
