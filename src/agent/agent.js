import fs from 'fs';
import path from 'path';
import { History } from './history.js';
import { Coder } from './coder.js';
import { VisionInterpreter } from './vision/vision_interpreter.js';
import { Prompter } from '../models/prompter.js';
import { initModes } from './modes.js';
import { initBot } from '../utils/mcdata.js';
import { containsCommand, commandExists, executeCommand, truncCommandMessage, isAction, blacklistCommands } from './commands/index.js';
import { bindForemanBot } from './commands/actions.js';
import { ActionManager } from './action_manager.js';
import { NPCContoller } from './npc/controller.js';
import { MemoryBank } from './memory_bank.js';
import { SelfPrompter } from './self_prompter.js';
import convoManager from './conversation.js';
import { handleTranslation, handleEnglishTranslation } from '../utils/translator.js';
import { addBrowserViewer } from './vision/browser_viewer.js';
import { serverProxy, sendOutputToServer } from './mindserver_proxy.js';
import settings from './settings.js';
import { Task } from './tasks/tasks.js';
import { speak } from './speak.js';
import { log, validateNameFormat, handleDisconnection } from './connection_handler.js';
import { TRANSIENT_AGENT_EXIT_CODE } from '../process/exit_codes.js';
import { AddonsManager } from './addons/addons_manager.js';
import { getKey, hasKey } from '../utils/keys.js';

// When only_chat_with is set the bot whispers only to those users. These
// phrases let the owner explicitly override that and speak publicly instead.
const PUBLIC_INTENT_PREFIXES = [
    'say publicly', 'say in public', 'say in chat', 'announce',
    'tell everyone', 'broadcast', '/say', '!public',
    'say publicly:', 'say in public:', 'say in chat:',
    'announce:', 'tell everyone:', 'broadcast:', '/say ', '!public ',
    'say to all', 'say to all:', 'say to everyone', 'say to everyone:',
    'say in global', 'say in global:', 'public:', 'public '
];

function stripPublicInstruction(message) {
    const m = message.trim();
    const lower = m.toLowerCase();
    for (const prefix of PUBLIC_INTENT_PREFIXES) {
        if (lower.startsWith(prefix.toLowerCase())) {
            return m.slice(prefix.length).trim();
        }
    }
    return null;
}

// ── Online Server Mode: broadcast / system-message filter ──────────────
// Only active when the loaded profile has "online_server_mode": true.
// Senders that are not real players (ClearLag, Console, Discord bots, etc.)
// and common server-broadcast patterns are silently dropped so the LLM is
// never wasted on them.
const IGNORED_SENDERS = new Set([
    'server', 'clearlag', 'console', 'broadcast', 'alert', 'announcement',
    'system', 'automessage', 'discord', 'vote', 'ranks', 'shop', 'anticheat',
    'matrix', 'vulcan', 'grimac', 'essentials', 'cmi', 'luckperms',
    'worldguard', 'coreprotect', 'litebans', 'bot',
    'chatcontrol', 'serverlist', 'motd',
    'skinsrestorer', 'skin', 'skins', 'tailor', 'fabrictailor',
    'limboauth', 'authme', 'nlogin', 'login', 'auth', 'velocity', 'bungeecord',
    'economy', 'vault', 'balance', 'shopgui', 'shopguiplus', 'quickshop', 'chestshop',
    'combatlog', 'combattag', 'combatlogx', 'deluxemenus', 'tab', 'scoreboard',
    'dailyrewards', 'rewards', 'crates', 'crazycrates', 'auctionhouse', 'ah'
]);

const BROADCAST_PATTERNS = [
    /clearlag/i,
    /ground items will be removed/i,
    /items? (?:have been |were )?removed/i,
    /cleared \d+ entit/i,
    /skinsrestorer/i,
    /(?:your |bot's |player's )?skin (?:has been |was )?(?:cleared|set|updated|changed|restored)/i,
    /skin url/i,
    /skin clear/i,
    /discord\.gg/i,
    /store\./i,
    /vote (?:for|at)/i,
    /\btebex\b/i,
    /don'?t forget to/i,
    /server (?:restarting|rebooting|shutting down)/i,
    /auto-?sav/i,
    /backup (?:start|complet)/i,
    /tps:\s*\d+/i,
    /(?:joined|left) the (?:game|server)/i,
    /welcome (?:to|back)/i,
    /\[(?:server|announcement|broadcast|alert|info|skins?|notice)\]/i,
    /^\[\+\]|^\[-\]/,
    /first time join/i,
    /server is restarting/i,
    /please wait before next usage/i,
    /login using \/login/i,
    /use \/login/i,
    /successful(?:ly)? logged in/i,
    /(?:teleporting in|teleported to|teleportation)/i,
    /(?:don'?t move|dont move)/i,
    /balance\s*:\s*\$?[\d,]+/i,
    /you have \$?[\d,]+(?:\.\d+)?/i,
    /type "\/help" for help/i,
    /unknown command/i
];

// Patterns from server when private messaging/whispering fails or is disabled
const WHISPER_DISABLED_PATTERNS = [
    /cannot (?:message|whisper|send message to) this player/i,
    /private message.*disabled/i,
    /whisper.*(?:disabled|turned off|off)/i,
    /player.*ignoring whispers/i,
    /you do not have permission.*(?:tell|whisper|msg)/i,
    /unknown command.*(?:tell|whisper|msg)/i
];

function isPlayerOnline(username, bot) {
    if (!username) return false;
    const clean = username.replace(/^[\[<(\s]+|[\]>)\s]+$/g, '').replace(/[§&][0-9a-fk-or]/gi, '').trim().toLowerCase();
    if (clean === 'admin' || clean === 'system') return true;
    if (!bot || !bot.players) return true;
    if (bot.players[username] || bot.players[clean]) return true;

    for (const pName of Object.keys(bot.players)) {
        const pLower = pName.toLowerCase();
        if (clean === pLower || clean.endsWith(pLower) || clean.includes(pLower)) {
            return true;
        }
    }
    // Also check individual words to handle rank prefixes (e.g. "Janta samibro780" -> "samibro780")
    const words = clean.split(/\s+/);
    for (const word of words) {
        for (const pName of Object.keys(bot.players)) {
            if (word === pName.toLowerCase()) {
                return true;
            }
        }
    }
    return false;
}

let _cachedIgnoredPlugins = [];
let _cachedIgnoredPluginsMtime = 0;

function getCustomIgnoredPlugins() {
    try {
        const filePath = path.resolve('ignored_plugins.json');
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs !== _cachedIgnoredPluginsMtime) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    _cachedIgnoredPlugins = data.map(s => String(s).toLowerCase().trim());
                }
                _cachedIgnoredPluginsMtime = stat.mtimeMs;
            }
            return _cachedIgnoredPlugins;
        }
    } catch (_) { }
    return _cachedIgnoredPlugins;
}

function isServerBroadcast(username, message, bot) {
    const cleanName = (username || '').replace(/[\[\]§&<>()]/g, '').trim().toLowerCase();

    // 1. Never filter messages from Mindcraft UI ('ADMIN'), system, or whitelisted operators
    if (cleanName === 'admin' || cleanName === 'system') return false;
    const allowed = (settings.only_chat_with || []).map(u => String(u).toLowerCase().trim());
    if (allowed.some(u => u && (cleanName === u || cleanName.includes(u) || u.includes(cleanName)))) {
        return false;
    }

    // Check sender name against known non-player sources
    if (IGNORED_SENDERS.has(cleanName)) return true;

    // Check custom ignored plugins from ignored_plugins.json and settings.ignored_plugins
    const customPlugins = getCustomIgnoredPlugins().concat(settings.ignored_plugins || []);
    if (customPlugins.some(p => p && (cleanName === p || cleanName.includes(p)))) return true;

    // Check message prefixes (e.g. "SkinsRestorer : ", "[ClearLag] ", etc.)
    const lowerMsg = (message || '').toLowerCase().trim();
    for (const plugin of IGNORED_SENDERS) {
        if (lowerMsg.startsWith(plugin + ' :') || lowerMsg.startsWith(plugin + ':') || lowerMsg.startsWith('[' + plugin + ']')) {
            return true;
        }
    }
    for (const plugin of customPlugins) {
        if (plugin && (lowerMsg.startsWith(plugin + ' :') || lowerMsg.startsWith(plugin + ':') || lowerMsg.startsWith('[' + plugin + ']'))) {
            return true;
        }
    }

    // Check message content against broadcast patterns
    if (BROADCAST_PATTERNS.some(rx => rx.test(message))) return true;

    // If the server player list is populated, check whether sender matches a known player
    if (bot && bot.players && Object.keys(bot.players).length > 0 && username !== 'system') {
        if (!isPlayerOnline(username, bot)) {
            return true;
        }
    }

    return false;
}


export class Agent {
    async start(load_mem = false, init_message = null, count_id = 0) {
        this.last_sender = null;
        this.last_player_sender = null;
        this.count_id = count_id;
        this._disconnectHandled = false;
        this.nextResponsePublic = false;

        // Initialize components
        this.actions = new ActionManager(this);
        this.prompter = new Prompter(this, settings.profile);
        this.name = (this.prompter.getName() || '').trim();
        console.log(`Initializing agent ${this.name}...`);

        // Validate Name Format
        // connection_handler now ensures the message has [LoginGuard] prefix
        const nameCheck = validateNameFormat(this.name);
        if (!nameCheck.success) {
            log(this.name, nameCheck.msg);
            process.exit(1);
            return;
        }

        this.history = new History(this);
        this.coder = new Coder(this);
        this.npc = new NPCContoller(this);
        this.memory_bank = new MemoryBank();
        this.self_prompter = new SelfPrompter(this);
        convoManager.initAgent(this);
        await this.prompter.initExamples();
        this.readAllMessages = false; // override: when true, process all players' messages
        this.whisperOff = this.prompter.profile?.whisper === false || this.prompter.profile?.whisper_mode === false;

        // load mem first before doing task
        let save_data = null;
        if (load_mem) {
            save_data = this.history.load();
        }
        let taskStart = null;
        if (save_data) {
            taskStart = save_data.taskStart;
        } else {
            taskStart = Date.now();
        }
        this.task = new Task(this, settings.task, taskStart);
        this.blocked_actions = settings.blocked_actions.concat(this.task.blocked_actions || []);
        blacklistCommands(this.blocked_actions);

        console.log(this.name, 'logging into minecraft...');
        this.bot = initBot(this.name);
        // Paper anti-xray can send fake ore block states in chunk data. Keep the
        // visibility guard opt-in so other profiles retain their usual search.
        this.bot.anti_xray_safe_ores = this.prompter.profile?.anti_xray_safe_ores === true;
        // Wire the Foreman bridge to the live bot so dashboard commands such as
        // SMELT_ALL can run without a previous chat action.
        try { bindForemanBot(this.bot); } catch (e) { console.warn(`[Foreman] bind failed: ${e.message}`); }

        // Connection Handler
        const onDisconnect = (event, reason) => {
            if (this._disconnectHandled) return;
            this._disconnectHandled = true;

            try { this.addons?.stop(); } catch (_) { }

            // Log and Analyze
            // handleDisconnection handles logging to console and server
            const { type, isFatal } = handleDisconnection(this.name, reason);
            process.exit(isFatal ? 1 : TRANSIENT_AGENT_EXIT_CODE);
        };

        // Bind events
        this.bot.once('kicked', (reason) => onDisconnect('Kicked', reason));
        this.bot.once('end', (reason) => onDisconnect('Disconnected', reason));
        this.bot.on('error', (err) => {
            if (String(err).includes('Duplicate') || String(err).includes('ECONNREFUSED')) {
                onDisconnect('Error', err);
            } else {
                log(this.name, `[LoginGuard] Connection Error: ${String(err)}`);
            }
        });

        initModes(this);

        // Auto-login handler for servers with LimboAuth / AuthMe / nLogin
        const serverPassword = this.prompter?.profile?.server_password || settings.server_password || process.env.MC_SERVER_PASSWORD || (hasKey('MC_SERVER_PASSWORD') ? getKey('MC_SERVER_PASSWORD') : '');
        let lastAuthSent = 0;
        let authSuccess = false;
        let warnedMissingPassword = false;
        const handleAuthPrompt = (msg) => {
            if (authSuccess) return;
            const str = String(msg || '');
            if (!serverPassword) {
                if (!warnedMissingPassword && /login|limboauth/i.test(str)) {
                    warnedMissingPassword = true;
                    console.warn(`[AuthGuard] ${this.name} received a login prompt but no server_password is configured. Set server_password in the profile, settings.js, or MC_SERVER_PASSWORD.`);
                }
                return;
            }
            if (/successful(?:ly)?\s+logged\s+in/i.test(str) || /login\s+successful/i.test(str)) {
                authSuccess = true;
                return;
            }
            if (/please wait before next usage/i.test(str)) {
                setTimeout(() => {
                    if (!authSuccess) {
                        console.log(`[AuthGuard] Retrying /login after rate limit delay...`);
                        try { this.bot.chat(`/login ${serverPassword}`); } catch (_) { }
                    }
                }, 2500);
                return;
            }
            if (/login using \/login/i.test(str) || /use \/login/i.test(str) || /please,? login/i.test(str) || /limboauth/i.test(str)) {
                const now = Date.now();
                if (now - lastAuthSent > 3000) {
                    lastAuthSent = now;
                    console.log(`[AuthGuard] LimboAuth login prompt detected. Sending /login...`);
                    try { this.bot.chat(`/login ${serverPassword}`); } catch (_) { }
                }
            }
        };
        this.bot.on('messagestr', handleAuthPrompt);

        this.bot.on('login', () => {
            console.log(this.name, 'logged in!');
            serverProxy.login();

            // Set skin for profile, requires Fabric Tailor. (https://modrinth.com/mod/fabrictailor)
            if (this.prompter.profile.skin)
                this.bot.chat(`/skin set URL ${this.prompter.profile.skin.model} ${this.prompter.profile.skin.path}`);
            else
                this.bot.chat(`/skin clear`);
        });

        // Auto Lobby-to-Wild Pipeline: Transfers to lifesteal subserver and teleports to wild
        if (settings.auto_lifesteal_pipeline || this.prompter?.profile?.auto_lifesteal_pipeline) {
            let transferredToLifesteal = false;
            this.bot.once('spawn', () => {
                setTimeout(() => {
                    transferredToLifesteal = true;
                    console.log(`[AutoPipeline] Transferring to lifesteal subserver (/server lifesteal)...`);
                    try { this.bot.chat('/server lifesteal'); } catch (_) { }
                }, 2500);
            });
            this.bot.on('spawn', () => {
                if (transferredToLifesteal) {
                    transferredToLifesteal = false;
                    setTimeout(() => {
                        console.log(`[AutoPipeline] Teleporting into wilderness (/randomtp)...`);
                        try { this.bot.chat('/randomtp'); } catch (_) { }
                    }, 2000);
                }
            });
        }
        const spawnTimeoutDuration = settings.spawn_timeout;
        const spawnTimeout = setTimeout(() => {
            const msg = `Bot has not spawned after ${spawnTimeoutDuration} seconds. Exiting.`;
            log(this.name, msg);
            process.exit(1);
        }, spawnTimeoutDuration * 1000);
        this.bot.once('spawn', async () => {
            try {
                clearTimeout(spawnTimeout);
                this.bot.removeListener('messagestr', handleAuthPrompt);
                await addBrowserViewer(this.bot, count_id);
                console.log('Initializing vision intepreter...');
                this.vision_interpreter = new VisionInterpreter(this, settings.allow_vision);

                // wait for a bit so stats are not undefined
                await new Promise((resolve) => setTimeout(resolve, 1000));

                console.log(`${this.name} spawned.`);
                this.clearBotLogs();

                // Initialize deterministic addons (AutoTotem, AutoGapple, CPS Booster, Radar, ShopGUI)
                try {
                    this.addons = new AddonsManager(this);
                    this.addons.start();
                } catch (addonErr) {
                    console.warn('[Addons] Failed to start AddonsManager:', addonErr.message);
                }

                this._setupEventHandlers(save_data, init_message);
                this.startEvents();

                if (!load_mem) {
                    if (settings.task) {
                        this.task.initBotTask();
                        this.task.setAgentGoal();
                    }
                } else {
                    // set the goal without initializing the rest of the task
                    if (settings.task) {
                        this.task.setAgentGoal();
                    }
                }

                await new Promise((resolve) => setTimeout(resolve, 10000));
                this.checkAllPlayersPresent();

            } catch (error) {
                console.error('Error in spawn event:', error);
                process.exit(1);
            }
        });
    }

    async _setupEventHandlers(save_data, init_message) {
        const ignore_messages = [
            "Set own game mode to",
            "Set the time to",
            "Set the difficulty to",
            "Teleported ",
            "Set the weather to",
            "Gamerule "
        ];

        const extractCleanSender = (rawName) => {
            if (!rawName) return rawName;
            const clean = rawName.replace(/[\[\]§&<>()]/g, '').trim();
            if (clean.toLowerCase() === 'admin' || clean.toLowerCase() === 'system') return 'ADMIN';
            const parts = clean.split(/\s+/);
            const allowed = (settings.only_chat_with || []).map(u => String(u).toLowerCase().trim());
            for (const part of parts) {
                if (allowed.includes(part.toLowerCase())) {
                    return part;
                }
            }
            return parts[parts.length - 1] || clean;
        };

        const respondFunc = async (rawUsername, message) => {
            if (!message || message.trim() === "") return;
            const username = extractCleanSender(rawUsername);
            if (username === this.name) return;
            const onlinePlayerName = Object.keys(this.bot.players || {}).find(
                name => name.toLowerCase() === String(username).toLowerCase()
            );
            if (onlinePlayerName) this.last_player_sender = onlinePlayerName;

            // ── Online Server Mode: drop broadcast / system messages & handle whisper commands ──
            const isOnlineMode = !!this.prompter.profile?.online_server_mode;
            const allowedUsers = settings.only_chat_with || [];

            if (isOnlineMode) {
                if (isServerBroadcast(username, message, this.bot)) {
                    console.log(this.name, '[OnlineFilter] dropped broadcast from', username, ':', message.substring(0, 80));
                    return;
                }

                const senderLower = (username || '').toLowerCase().trim();
                const isAllowedSender = allowedUsers.length === 0 || this.readAllMessages ||
                    senderLower === 'admin' ||
                    allowedUsers.some(u => {
                        const target = String(u).toLowerCase().trim();
                        return senderLower === target || senderLower.includes(target) || target.includes(senderLower);
                    });

                // Owner command overrides: toggle whisper mode & read-all mode via chat
                if (isAllowedSender) {
                    const lowerMsg = message.toLowerCase().trim();

                    // Whisper toggle commands
                    if (lowerMsg.includes('whisper off') || lowerMsg.includes('turn off whisper') ||
                        lowerMsg.includes('turn whisper off') || lowerMsg.includes('disable whisper') ||
                        lowerMsg.includes('stop whispering') || lowerMsg.includes('chat in public') ||
                        lowerMsg.includes('public chat on') || lowerMsg.includes('public mode')) {
                        this.whisperOff = true;
                        console.log(`${this.name}: whisper mode disabled by ${username} (chatting in public)`);
                        this.openChat("Whisper mode disabled. I will chat in public now.");
                        return;
                    }
                    else if (lowerMsg.includes('whisper on') || lowerMsg.includes('turn on whisper') ||
                        lowerMsg.includes('turn whisper on') || lowerMsg.includes('enable whisper') ||
                        lowerMsg.includes('start whispering') || lowerMsg.includes('private chat on') ||
                        lowerMsg.includes('private mode')) {
                        this.whisperOff = false;
                        console.log(`${this.name}: whisper mode enabled by ${username}`);
                        this.openChat("Whisper mode enabled. I will whisper to you now.");
                        return;
                    }

                    // Listening override commands
                    if (lowerMsg.includes('read everyone') || lowerMsg.includes('read all') ||
                        lowerMsg.includes('reply to all') || lowerMsg.includes('listen to everyone')) {
                        this.readAllMessages = true;
                        console.log(`${this.name}: read-all mode enabled by ${username}`);
                    }
                    else if (lowerMsg.includes('read only me') || lowerMsg.includes('ignore others') ||
                        lowerMsg.includes('read only mine') || lowerMsg.includes('listen only to me')) {
                        this.readAllMessages = false;
                        console.log(`${this.name}: read-all mode disabled by ${username}`);
                    }
                }

                // Filter: only process messages from allowed users, unless read-all override is active.
                if (allowedUsers.length > 0 && !this.readAllMessages && !isAllowedSender) {
                    return; // silently ignored - never hits the API
                }
            }

            try {
                if (ignore_messages.some((m) => message.startsWith(m))) return;

                this.shut_up = false;

                if (convoManager.isOtherAgent(username)) {
                    console.warn('received whisper from other bot??')
                }
                else {
                    await this.handleMessage(username, message);
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        };

        function parseWhisper(text, botName) {
            if (!text || typeof text !== 'string') return null;
            const clean = text.replace(/§[0-9a-fk-or]/gi, '').trim();
            // The server decorates incoming whispers like "✉ ➟ 52hx → Me: hi".
            const normalized = clean
                .replace(/^[\s✉📩\uFE0F]+/, '')
                .replace(/^[➔➜➡→►▶➤➟»─>-]+\s*/, '');
            const botLower = (botName || 'eni1').toLowerCase();
            const recipients = ['me', 'you', botLower, 'eni', 'eni1'];
            const isSelfSender = username => recipients.includes(String(username).toLowerCase());

            // Pattern 1: Arrow formats
            // Matches: [prefix] [arrow] [rank] sender [arrow] target [:] message
            // Examples: ➔ Me ➔ ENI1: hii | ➔ 52hx ➔ You: hii | ➔ [Janta] 52hx ➔ You: follow me
            const arrowRegex = /^(?:.*?[➔➜➡→►▶➤»─>-]+\s*)?(?:\[?([A-Za-z0-9_]+)\]?\s+)?([A-Za-z0-9_]{2,16})\s*(?:[➔➜➡→►▶➤»─>-]+|-->|->)\s*([A-Za-z0-9_]{2,16})\s*[:]?\s*(.+)$/i;
            let m = normalized.match(arrowRegex);
            if (m) {
                const party1 = m[2];
                const party2 = m[3];
                const msg = m[4].trim();
                if (recipients.includes(party2.toLowerCase()) && !isSelfSender(party1)) {
                    return { sender: party1, msg };
                }
                // If "Me" or the bot is on the sender side, this is our own
                // outgoing whisper echoed back by the server. Never re-ingest it.
            }

            // Pattern 2: Bracket format [52hx -> You] msg or [Janta 52hx -> You]: msg
            const bracketRegex = /^\[\s*(?:([A-Za-z0-9_]+)\s+)?([A-Za-z0-9_]{2,16})\s*(?:[➔➜➡→►▶➤»─>-]+|-->|->)\s*([A-Za-z0-9_]{2,16})\s*\]\s*[:]?\s*(.+)$/i;
            m = normalized.match(bracketRegex);
            if (m) {
                if (recipients.includes(m[3].toLowerCase()) && !isSelfSender(m[2])) {
                    return { sender: m[2], msg: m[4].trim() };
                }
            }

            // Pattern 3: Classic From 52hx: msg
            const classic = /^(?:From|Whisper from)\s+([a-zA-Z0-9_]{2,16})\s*:\s*(.+)$/i;
            m = normalized.match(classic);
            if (m && !isSelfSender(m[1])) return { sender: m[1], msg: m[2].trim() };

            // Pattern 4: 52hx whispers to you: msg
            const whispers = /^([a-zA-Z0-9_]{2,16})\s+(?:whispers|whispers to you)\s*:\s*(.+)$/i;
            m = normalized.match(whispers);
            if (m && !isSelfSender(m[1])) return { sender: m[1], msg: m[2].trim() };

            return null;
        }

        const publicChatRegex = /^(?:\[?([A-Za-z0-9_]+)\]?\s+)?([A-Za-z0-9_]{3,16})\s*:\s*(.+)$/;

        const processedRecent = new Map();
        const dispatchMessage = (sender, text, channel = 'chat') => {
            if (!sender || !text) return;
            const key = `${sender.toLowerCase().trim()}:${text.trim()}`;
            const now = Date.now();
            if (processedRecent.has(key) && (now - processedRecent.get(key) < 2500)) {
                return;
            }
            processedRecent.set(key, now);
            if (processedRecent.size > 100) {
                for (const [k, t] of processedRecent.entries()) {
                    if (now - t > 10000) processedRecent.delete(k);
                }
            }
            this.lastChannel = channel;
            respondFunc(sender, text).catch(error => {
                console.error('Error dispatching chat message:', error);
            });
        };

        this.respondFunc = dispatchMessage;
        // The proxy may have queued dashboard messages before this chat handler
        // was ready. setAgent() runs before start(), so flush again here.
        serverProxy.flushPendingMessages();

        this.bot.on('whisper', (username, message) => {
            dispatchMessage(username, message, 'whisper');
        });

        this.bot.on('chat', (username, message) => {
            if (serverProxy.getNumOtherAgents() > 0) return;
            dispatchMessage(username, message, 'chat');
        });

        const recentRawText = new Map();
        const handleRawText = (rawText) => {
            if (!rawText || typeof rawText !== 'string') return;
            const clean = rawText.replace(/§[0-9a-fk-or]/gi, '').trim();
            if (!clean) return;
            const rawKey = clean.toLowerCase();
            const now = Date.now();
            if (recentRawText.has(rawKey) && now - recentRawText.get(rawKey) < 2500) return;
            recentRawText.set(rawKey, now);
            if (recentRawText.size > 100) {
                for (const [key, timestamp] of recentRawText.entries()) {
                    if (now - timestamp > 10000) recentRawText.delete(key);
                }
            }

            // Debug log if incoming text looks like a player interaction
            const allowed = (settings.only_chat_with || []).map(u => String(u).toLowerCase());
            const mentionsAllowed = allowed.some(u => u && clean.toLowerCase().includes(u));
            if (mentionsAllowed || clean.includes('➔') || clean.includes('->') || clean.toLowerCase().includes('whisper')) {
                console.log(this.name, '[ChatDebug]', JSON.stringify(clean));
            }

            // 1. Check custom whisper patterns
            const whisperResult = parseWhisper(clean, this.name);
            if (whisperResult) {
                const sender = whisperResult.sender;
                const msg = whisperResult.msg;
                console.log(this.name, '[CustomWhisper] matched:', sender, '->', msg);
                dispatchMessage(sender, msg, 'whisper');
                return;
            }

            // 2. Check custom public chat pattern (e.g. "Janta 52hx: hello")
            const chatMatch = clean.match(publicChatRegex);
            if (chatMatch) {
                const rank = chatMatch[1];
                const sender = chatMatch[2];
                const msg = chatMatch[3].trim();
                if (allowed.includes(sender.toLowerCase()) || (rank && allowed.includes(rank.toLowerCase()))) {
                    console.log(this.name, '[CustomChat] matched allowed player:', sender, '->', msg);
                    dispatchMessage(sender, msg, 'chat');
                }
            }
        };

        this.bot.on('messagestr', (rawMessage) => {
            handleRawText(rawMessage);
        });

        // Also check raw json message (handles servers that send whispers as system/json chat without triggering messagestr)
        this.bot.on('message', (jsonMsg) => {
            if (!jsonMsg) return;
            const text = jsonMsg.toString();
            if (this.prompter.profile?.online_server_mode && WHISPER_DISABLED_PATTERNS.some(rx => rx.test(text))) {
                if (!this.whisperOff) {
                    console.log(this.name, '[OnlineMode] Server indicates whispers are disabled/off. Switching to public chat.');
                    this.whisperOff = true;
                }
            }
            handleRawText(text);
        });

        // MindServer may accept dashboard messages after bot login but before
        // spawn-time handlers are installed. Drain those messages now that the
        // response handler and chat listeners are ready.
        serverProxy.flushPendingMessages();

        // Set up auto-eat. Merge into the plugin defaults instead of replacing the
        // whole object: replacing it drops eatingTimeout and makes every bite cancel.
        Object.assign(this.bot.autoEat.options, {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ["rotten_flesh", "spider_eye", "poisonous_potato", "pufferfish", "chicken"],
            offhand: false,
        });

        if (save_data?.self_prompt) {
            if (init_message) {
                this.history.add('system', init_message);
            }
            await this.self_prompter.handleLoad(save_data.self_prompt, save_data.self_prompting_state);
        }
        if (save_data?.last_sender) {
            this.last_sender = save_data.last_sender;
            if (convoManager.otherAgentInGame(this.last_sender)) {
                const msg_package = {
                    message: `You have restarted and this message is auto-generated. Continue the conversation with me.`,
                    start: true
                };
                convoManager.receiveFromBot(this.last_sender, msg_package);
            }
        }
        else if (this.prompter.profile?.online_server_mode || this.prompter.profile?.silent_spawn || settings.silent_spawn) {
            // Online server mode / silent spawn: remain silent and ignore automated restarts/greetings
            const lower = (init_message || '').trim().toLowerCase();
            const isAutoNotice = !init_message || lower === 'hello' || lower.includes('agent process restarted');
            if (!isAutoNotice) {
                await this.handleMessage('system', init_message, 2);
            }
        }
        else if (init_message) {
            await this.handleMessage('system', init_message, 2);
        }
        else {
            this.openChat("Hello world! I am " + this.name);
        }
    }

    checkAllPlayersPresent() {
        if (!this.task || !this.task.agent_names) {
            return;
        }

        const missingPlayers = this.task.agent_names.filter(name => !this.bot.players[name]);
        if (missingPlayers.length > 0) {
            console.log(`Missing players/bots: ${missingPlayers.join(', ')}`);
            this.cleanKill('Not all required players/bots are present in the world. Exiting.', 4);
        }
    }

    requestInterrupt() {
        this.bot.interrupt_code = true;
        // Cancelling is best effort: a disconnected bot may have already lost
        // some of these plugins, and one failure must not block the others.
        try { this.bot.stopDigging(); } catch (_) { /* best effort */ }
        try { this.bot.collectBlock?.cancelTask?.(); } catch (_) { /* best effort */ }
        try { this.bot.pathfinder?.stop(); } catch (_) { /* best effort */ }
        try { this.bot.pvp?.stop(); } catch (_) { /* best effort */ }
    }

    clearBotLogs() {
        this.bot.output = '';
        this.bot.interrupt_code = false;
    }

    shutUp() {
        this.shut_up = true;
        if (this.self_prompter.isActive()) {
            this.self_prompter.stop(false);
        }
        convoManager.endAllConversations();
    }

    async handleMessage(source, message, max_responses = null) {
        await this.checkTaskDone();
        if (!source || !message) {
            console.warn('Received empty message from', source);
            return false;
        }

        let used_command = false;
        if (max_responses === null) {
            max_responses = settings.max_commands === -1 ? Infinity : settings.max_commands;
        }
        if (max_responses === -1) {
            max_responses = Infinity;
        }

        const self_prompt = source === 'system' || source === this.name;
        const from_other_bot = convoManager.isOtherAgent(source);
        if (!self_prompt && !from_other_bot) this.last_sender = source;

        if (!self_prompt && !from_other_bot) { // from user, check for forced commands
            // ── Public intent detection: check INCOMING owner message ──
            const publicText = stripPublicInstruction(message);
            if (publicText !== null && settings.only_chat_with.length > 0
                && settings.only_chat_with.includes(source)) {
                this.nextResponsePublic = true;
                message = publicText; // pass only the actual content to the LLM
            }

            const user_command_name = containsCommand(message);
            if (user_command_name) {
                if (!commandExists(user_command_name)) {
                    this.routeResponse(source, `Command '${user_command_name}' does not exist.`);
                    return false;
                }
                // In online mode, suppress command-usage announcements in public chat
                if (!this.prompter.profile?.hide_commands_in_chat) {
                    this.routeResponse(source, `*${source} used ${user_command_name.substring(1)}*`);
                }
                if (user_command_name === '!newAction') {
                    // all user-initiated commands are ignored by the bot except for this one
                    // add the preceding message to the history to give context for newAction
                    this.history.add(source, message);
                }
                let execute_res = await executeCommand(this, message);
                if (execute_res) {
                    // In online mode, send command results only to the owner, not public
                    if (this.prompter.profile?.hide_commands_in_chat
                        && settings.only_chat_with.length > 0) {
                        for (let username of settings.only_chat_with) {
                            this.bot.whisper(username, execute_res);
                        }
                    } else {
                        this.routeResponse(source, execute_res);
                    }
                }
                return true;
            }
        }

        // Now translate the message
        message = await handleEnglishTranslation(message);
        console.log('received message from', source, ':', message);

        const checkInterrupt = () => this.self_prompter.shouldInterrupt(self_prompt) || this.shut_up || convoManager.responseScheduledFor(source);

        let behavior_log = this.bot.modes.flushBehaviorLog().trim();
        if (behavior_log.length > 0) {
            const MAX_LOG = 500;
            if (behavior_log.length > MAX_LOG) {
                behavior_log = '...' + behavior_log.substring(behavior_log.length - MAX_LOG);
            }
            behavior_log = 'Recent behaviors log: \n' + behavior_log;
            await this.history.add('system', behavior_log);
        }

        // Handle other user messages
        await this.history.add(source, message);
        this.history.save();

        if (!self_prompt && this.self_prompter.isActive()) // message is from user during self-prompting
            max_responses = 1; // force only respond to this message, then let self-prompting take over
        for (let i = 0; i < max_responses; i++) {
            if (checkInterrupt()) break;
            let history = this.history.getHistory();
            let res = await this.prompter.promptConvo(history, !self_prompt && !from_other_bot);

            console.log(`${this.name} full response to ${source}: ""${res}""`);

            if (res.trim().length === 0) {
                console.warn('no response')
                break; // empty response ends loop
            }

            let command_name = containsCommand(res);

            if (command_name) { // contains query or command
                res = truncCommandMessage(res); // everything after the command is ignored
                this.history.add(this.name, res);

                if (!commandExists(command_name)) {
                    this.history.add('system', `Command ${command_name} does not exist.`);
                    console.warn('Agent hallucinated command:', command_name)
                    continue;
                }

                if (checkInterrupt()) break;
                this.self_prompter.handleUserPromptedCmd(self_prompt, isAction(command_name));

                const hideCmds = this.prompter.profile?.hide_commands_in_chat;
                const syntax = hideCmds ? "none" : settings.show_command_syntax;
                if (syntax === "full") {
                    this.routeResponse(source, res);
                }
                else if (syntax === "shortened") {
                    // show only "used !commandname"
                    let pre_message = res.substring(0, res.indexOf(command_name)).trim();
                    let chat_message = `*used ${command_name.substring(1)}*`;
                    if (pre_message.length > 0)
                        chat_message = `${pre_message}  ${chat_message}`;
                    this.routeResponse(source, chat_message);
                }
                else {
                    // no command at all
                    let pre_message = res.substring(0, res.indexOf(command_name)).trim();
                    if (pre_message.trim().length > 0)
                        this.routeResponse(source, pre_message);
                }

                let execute_res = await executeCommand(this, res);

                console.log('Agent executed:', command_name, 'and got:', execute_res);
                used_command = true;

                if (execute_res)
                    this.history.add('system', execute_res);
                else
                    break;
            }
            else { // conversation response
                this.history.add(this.name, res);
                this.routeResponse(source, res);
                break;
            }

            this.history.save();
        }

        return used_command;
    }

    async routeResponse(to_player, message) {
        if (this.shut_up) return;
        let self_prompt = to_player === 'system' || to_player === this.name;
        if (self_prompt && this.last_sender) {
            // this is for when the agent is prompted by system while still in conversation
            // so it can respond to events like death but be routed back to the last sender
            to_player = this.last_sender;
        }

        if (convoManager.isOtherAgent(to_player) && convoManager.inConversation(to_player)) {
            // if we're in an ongoing conversation with the other bot, send the response to it
            convoManager.sendToBot(to_player, message);
        }
        else {
            // otherwise, use open chat targeted to the original sender
            this.openChat(message, to_player);
            // note that to_player could be another bot, but if we get here the conversation has ended
        }
    }

    whisperPlayer(username, message) {
        if (!this.bot || !username || !message) return;
        const cleanTarget = String(username).replace(/[\[\]§&<>()]/g, '').trim();
        if (!cleanTarget || cleanTarget.toUpperCase() === 'ADMIN' || cleanTarget.toLowerCase() === 'system') return;
        const cmd = this.prompter.profile?.whisper_command || '/msg';
        if (cmd.startsWith('/')) {
            this.bot.chat(`${cmd} ${cleanTarget} ${message}`);
        } else {
            this.bot.whisper(cleanTarget, message);
        }
    }

    async openChat(message, target = this.last_sender) {
        let to_translate = message;
        let remaining = '';
        let command_name = containsCommand(message);
        let translate_up_to = command_name ? message.indexOf(command_name) : -1;
        if (translate_up_to != -1) { // don't translate the command
            to_translate = to_translate.substring(0, translate_up_to);
            remaining = message.substring(translate_up_to);
        }

        const hideCmds = this.prompter.profile?.hide_commands_in_chat || this.prompter.profile?.online_server_mode;
        if (hideCmds) {
            // Strip any raw command string from in-game chat or whisper
            remaining = '';
        }

        const translated = (await handleTranslation(to_translate)).trim();
        message = remaining ? (translated + " " + remaining).trim() : translated;
        // newlines are interpreted as separate chats, which triggers spam filters. replace them with spaces
        message = message.replaceAll('\n', ' ').trim();

        // If message is empty after stripping command, do not speak in chat
        if (!message || message === '??') {
            return;
        }

        const primaryTarget = target || this.last_sender;

        // ── Default profile (non-online): preserve exact original Mindcraft behavior ──
        if (!this.prompter.profile?.online_server_mode) {
            if (settings.only_chat_with.length > 0) {
                for (let username of settings.only_chat_with) {
                    this.whisperPlayer(username, message);
                }
                sendOutputToServer(this.name, message);
            } else {
                if (settings.speak) {
                    speak(to_translate, this.prompter.profile.speak_model);
                }
                if (settings.chat_ingame) { this.bot.chat(message); }
                sendOutputToServer(this.name, message);
            }
            return;
        }

        // ── Online Mode Chat Routing ──
        // 1. One-shot public intent override (e.g. owner commanded "say in chat ...")
        if (this.nextResponsePublic) {
            this.nextResponsePublic = false;
            if (settings.chat_ingame) { this.bot.chat(message); }
            sendOutputToServer(this.name, message);
            return;
        }

        // 2. If message came from Mindcraft Web UI ('ADMIN'), respond back to UI only.
        // NEVER broadcast Web UI messages into public Minecraft chat.
        if (primaryTarget === 'ADMIN' || this.last_sender === 'ADMIN') {
            sendOutputToServer(this.name, message);
            return;
        }

        // 3. If whisper mode was explicitly disabled by owner command ("whisper off")
        if (this.whisperOff) {
            if (settings.chat_ingame) { this.bot.chat(message); }
            sendOutputToServer(this.name, message);
            return;
        }

        // 4. Whisper mode (DEFAULT for Online Mode): ALWAYS whisper back to the owner/operator,
        // even if the user spoke in public chat. This keeps the bot's communication completely private.
        let delivered = false;
        const targets = new Set(settings.only_chat_with.filter(u => u && u.toUpperCase() !== 'ADMIN'));
        if (primaryTarget && primaryTarget.toUpperCase() !== 'ADMIN' && primaryTarget !== 'system') {
            targets.add(primaryTarget);
        }

        for (let username of targets) {
            // The sender who just messaged the bot is guaranteed online
            const isSender = primaryTarget && primaryTarget.toLowerCase() === username.toLowerCase();
            if (isSender || isPlayerOnline(username, this.bot)) {
                this.whisperPlayer(username, message);
                delivered = true;
            }
        }

        // 5. If whisper target is offline or unreachable, silently drop.
        // Do NOT chat publicly — prevents leaking messages or bot presence to the whole server.
        if (!delivered) {
            console.log(this.name, '[OnlineMode] Whisper targets offline/unreachable; silently dropping (no public chat)');
        }

        sendOutputToServer(this.name, message);
    }

    startEvents() {
        // Custom events
        this.bot.on('time', () => {
            if (this.bot.time.timeOfDay == 0)
                this.bot.emit('sunrise');
            else if (this.bot.time.timeOfDay == 6000)
                this.bot.emit('noon');
            else if (this.bot.time.timeOfDay == 12000)
                this.bot.emit('sunset');
            else if (this.bot.time.timeOfDay == 18000)
                this.bot.emit('midnight');
        });

        let prev_health = this.bot.health;
        this.bot.lastDamageTime = 0;
        this.bot.lastDamageTaken = 0;
        this.bot.on('health', () => {
            if (this.bot.health < prev_health) {
                this.bot.lastDamageTime = Date.now();
                this.bot.lastDamageTaken = prev_health - this.bot.health;
            }
            prev_health = this.bot.health;
        });
        // Logging callbacks
        this.bot.on('error', (err) => {
            console.error('Error event!', err);
        });
        // Use connection handler for runtime disconnects
        this.bot.on('end', (reason) => {
            if (!this._disconnectHandled) {
                const { msg } = handleDisconnection(this.name, reason);
                this.cleanKill(msg);
            }
        });
        this.bot.on('death', () => {
            this.actions.cancelResume();
            this.actions.stop();
        });
        this.bot.on('kicked', (reason) => {
            if (!this._disconnectHandled) {
                const { msg } = handleDisconnection(this.name, reason);
                this.cleanKill(msg);
            }
        });
        this.bot.on('messagestr', async (message, _, jsonMsg) => {
            if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(this.name)) {
                console.log('Agent died: ', message);
                let death_pos = this.bot.entity.position;
                this.memory_bank.rememberPlace('last_death_position', death_pos.x, death_pos.y, death_pos.z);
                let death_pos_text = null;
                if (death_pos) {
                    death_pos_text = `x: ${death_pos.x.toFixed(2)}, y: ${death_pos.y.toFixed(2)}, z: ${death_pos.z.toFixed(2)}`;
                }
                let dimention = this.bot.game.dimension;
                this.handleMessage('system', `You died at position ${death_pos_text || "unknown"} in the ${dimention} dimension with the final message: '${message}'. Your place of death is saved as 'last_death_position' if you want to return. Previous actions were stopped and you have respawned.`).catch(error => console.error('Death message handling failed:', error));
            }
        });
        this.bot.on('idle', () => {
            this.bot.clearControlStates();
            this.bot.pathfinder.stop(); // clear any lingering pathfinder
            this.bot.modes.unPauseAll();
            setTimeout(() => {
                if (this.isIdle()) {
                    this.actions.resumeAction();
                }
            }, 1000);
        });

        // Init NPC controller
        this.npc.init();

        // This update loop ensures that each update() is called one at a time, even if it takes longer than the interval
        const INTERVAL = 300;
        let last = Date.now();
        setTimeout(async () => {
            while (true) {
                let start = Date.now();
                await this.update(start - last);
                let remaining = INTERVAL - (Date.now() - start);
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                last = start;
            }
        }, INTERVAL);

        this.bot.emit('idle');
    }

    async update(delta) {
        await this.bot.modes.update();
        this.self_prompter.update(delta);
        await this.checkTaskDone();
    }

    isIdle() {
        return !this.actions.executing;
    }


    cleanKill(msg = 'Killing agent process...', code = 1) {
        // Exiting must not depend on a live socket or a healthy history store.
        try { this.history.add('system', msg); } catch (err) { console.error('Failed to record shutdown message:', err); }
        try { this.bot.chat(code > 1 ? 'Restarting.' : 'Exiting.'); } catch (_) { /* socket may already be gone */ }
        try { this.history.save(); } catch (err) { console.error('Failed to save history before exit:', err); }
        process.exit(code);
    }
    async checkTaskDone() {
        if (this.task.data) {
            let res = this.task.isDone();
            if (res) {
                await this.history.add('system', `Task ended with score : ${res.score}`);
                await this.history.save();
                // await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 second for save to complete
                console.log('Task finished:', res.message);
                this.killAll();
            }
        }
    }

    killAll() {
        serverProxy.shutdown();
    }
}
