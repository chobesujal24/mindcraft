import { sendOutputToServer } from './mindserver_proxy.js';

// Definitions of error types, keywords, and full human-readable messages.
const ERROR_DEFINITIONS = {
    'name_conflict': {
        keywords: ['name_taken', 'duplicate_login', 'already connected', 'already logged in', 'username is already'],
        msg: 'Name Conflict: The name is already in use or you are already logged in.',
        isFatal: true
    },
    'access_denied': {
        keywords: ['whitelist', 'not white-listed', 'banned', 'suspended', 'verify'],
        msg: 'Access Denied: You are not whitelisted or banned.',
        isFatal: true
    },
    'server_full': {
        keywords: ['server is full', 'full server'],
        msg: 'Connection Failed: The server is full.',
        isFatal: false
    },
    'server_unavailable': {
        keywords: ['lobby server is offline', 'lobby is offline', 'server is offline', 'server offline', 'server unavailable', 'temporarily unavailable'],
        msg: 'Connection Failed: The server is temporarily offline or unavailable.',
        isFatal: false
    },
    'version_mismatch': {
        keywords: ['outdated', 'version', 'client'],
        msg: 'Version Mismatch: Client and server versions do not match.',
        isFatal: true
    },
    'maintenance': {
        keywords: ['maintenance', 'updating', 'closed', 'restarting'],
        msg: 'Connection Failed: Server is under maintenance or restarting.',
        isFatal: false
    },
    'network_error': {
        keywords: ['timeout', 'timed out', 'connection lost', 'reset', 'refused', 'keepalive'],
        msg: 'Network Error: Connection timed out or was lost.',
        isFatal: false
    },
    'behavior': {
        keywords: ['flying', 'spam', 'speed'],
        msg: 'Kicked: Removed from server due to flying, spamming, or invalid movement.',
        isFatal: true
    }
};

function reasonText(value) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try { return reasonText(JSON.parse(trimmed)); } catch (_) { return value; }
        }
        return value;
    }
    if (Array.isArray(value)) return value.map(reasonText).filter(Boolean).join(' ');
    if (!value || typeof value !== 'object') return '';

    if (value.type === 'string' && typeof value.value === 'string') return value.value;
    return ['text', 'translate', 'with', 'extra', 'value', 'fallback', 'reason', 'message']
        .filter(key => value[key] !== undefined)
        .map(key => reasonText(value[key]))
        .filter(Boolean)
        .join(' ');
}

// Helper to log messages to console (once) and MindServer.
export const log = (agentName, msg) => {
    // Use console.error for visibility in terminal
    console.error(msg);
    try { sendOutputToServer(agentName || 'system', msg); } catch (_) {}
};

// Analyzes the kick reason and returns a full, human-readable sentence.
export function parseKickReason(reason) {
    if (!reason) return { type: 'unknown', msg: 'Unknown reason (Empty)', isFatal: true };
    
    const readable = reasonText(reason) || String(reason);
    const raw = readable.toLowerCase();

    // Search for keywords in definitions
    for (const [type, def] of Object.entries(ERROR_DEFINITIONS)) {
        if (def.keywords.some(k => raw.includes(k))) {
            console.error(`Disconnected: ${raw}`);
            return { type, msg: def.msg, isFatal: def.isFatal };
        }
    }
    
    return { type: 'other', msg: `Disconnected: ${readable}`, isFatal: true };
}

// Centralized handler for disconnections.
export function handleDisconnection(agentName, reason) {
    const { type, msg, isFatal } = parseKickReason(reason);
    
    // Format: [LoginGuard] Error Message
    const finalMsg = `[LoginGuard] ${msg}`;
    
    // Only call log once (it handles console printing)
    log(agentName, finalMsg);
    
    return { type, msg: finalMsg, isFatal };
}

// Validates name format.
export function validateNameFormat(name) {
    if (!name || !/^[a-zA-Z0-9_]{3,16}$/.test(name)) {
        return { 
            success: false, 
            // Added [LoginGuard] prefix here for consistency
            msg: `[LoginGuard] Invalid name '${name}'. Must be 3-16 alphanumeric/underscore characters.` 
        };
    }
    return { success: true };
}
