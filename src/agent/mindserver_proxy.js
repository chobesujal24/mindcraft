import { io } from 'socket.io-client';
import convoManager from './conversation.js';
import { setSettings } from './settings.js';
import { getFullState } from './library/full_state.js';

// agent's individual connection to the mindserver
// always connect to localhost

class MindServerProxy {
    constructor() {
        if (MindServerProxy.instance) {
            return MindServerProxy.instance;
        }
        
        this.socket = null;
        this.connected = false;
        this.agents = [];
        this.pendingMessages = [];
        this.pendingMessageLimit = 32;
        this.pendingMessageTtlMs = 60_000;
        MindServerProxy.instance = this;
    }

    async connect(name, port) {
        if (this.connected) return;
        
        this.name = name;
        // Use IPv4 explicitly: the server binds 127.0.0.1, and "localhost" may
        // resolve to ::1 on some systems.
        this.socket = io(`http://127.0.0.1:${port}`, {
            auth: { token: process.env.MINDSERVER_TOKEN || '' }
        });

        await new Promise((resolve, reject) => {
            this.socket.on('connect', resolve);
            this.socket.on('connect_error', (err) => {
                console.error('Connection failed:', err);
                reject(err);
            });
        });

        this.connected = true;
        console.log(name, 'connected to MindServer');

        this.socket.on('disconnect', () => {
            console.log('Disconnected from MindServer');
            this.connected = false;
            this.pendingMessages.length = 0;
            if (this.agent) {
                this.agent.cleanKill('Disconnected from MindServer. Killing agent process.');
            }
        });

        this.socket.on('chat-message', (agentName, json) => {
            convoManager.receiveFromBot(agentName, json);
        });

        this.socket.on('agents-status', (agents) => {
            this.agents = agents;
            convoManager.updateAgents(agents);
            if (this.agent?.task) {
                console.log(this.agent.name, 'updating available agents');
                this.agent.task.updateAvailableAgents(agents);
            }
        });

        this.socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            this.agent.cleanKill();
        });
		
        this.socket.on('send-message', (data) => {
            this.receiveMessage(data);
        });

        this.socket.on('get-full-state', (callback) => {
            try {
                const state = getFullState(this.agent);
                callback(state);
            } catch (error) {
                console.error('Error getting full state:', error);
                callback(null);
            }
        });

        // Request settings and wait for response
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Settings request timed out after 5 seconds'));
            }, 5000);

            this.socket.emit('get-settings', name, (response) => {
                clearTimeout(timeout);
                if (response.error) {
                    return reject(new Error(response.error));
                }
                setSettings(response.settings);
                this.socket.emit('connect-agent-process', name);
                resolve();
            });
        });
    }

    setAgent(agent) {
        this.agent = agent;
        this.flushPendingMessages();
    }

    receiveMessage(data) {
        if (!data || typeof data !== 'object' || typeof data.from !== 'string' ||
            typeof data.message !== 'string' || !data.message.trim()) {
            console.warn('[MindServer] Ignored invalid send-message payload');
            return;
        }

        if (typeof this.agent?.respondFunc !== 'function') {
            const now = Date.now();
            this.pendingMessages = this.pendingMessages.filter(
                entry => now - entry.receivedAt <= this.pendingMessageTtlMs
            );
            if (this.pendingMessages.length >= this.pendingMessageLimit) {
                this.pendingMessages.shift();
            }
            this.pendingMessages.push({ data, receivedAt: now });
            console.warn(`[MindServer] Chat handler is not ready; queued dashboard message (${this.pendingMessages.length} pending)`);
            return;
        }

        this.dispatchMessage(data);
    }

    dispatchMessage(data) {
        const respondFunc = this.agent?.respondFunc;
        if (typeof respondFunc !== 'function') return false;

        try {
            Promise.resolve(respondFunc.call(this.agent, data.from, data.message)).catch(error => {
                console.error('[MindServer] Error dispatching dashboard message:', error);
            });
            return true;
        } catch (error) {
            console.error('[MindServer] Error dispatching dashboard message:', error);
            return false;
        }
    }

    flushPendingMessages() {
        if (typeof this.agent?.respondFunc !== 'function' || this.pendingMessages.length === 0) return;

        const now = Date.now();
        const pending = this.pendingMessages.splice(0);
        let expired = 0;
        for (const entry of pending) {
            if (now - entry.receivedAt > this.pendingMessageTtlMs) {
                expired++;
                continue;
            }
            this.dispatchMessage(entry.data);
        }
        if (expired) {
            console.warn(`[MindServer] Dropped ${expired} queued dashboard message(s) that expired before the chat handler was ready`);
        }
    }

    getAgents() {
        return this.agents;
    }

    getNumOtherAgents() {
        return this.agents.length - 1;
    }

    login() {
        this.socket.emit('login-agent', this.agent.name);
    }

    shutdown() {
        this.socket.emit('shutdown');
    }

    setViewerPort(port) {
        if (this.socket && this.connected) {
            this.socket.emit('update-viewer-port', port);
        }
    }

    getSocket() {
        return this.socket;
    }
}

// Create and export a singleton instance
export const serverProxy = new MindServerProxy();

// for chatting with other bots
export function sendBotChatToServer(agentName, json) {
    serverProxy.getSocket().emit('chat-message', agentName, json);
}

// for sending general output to server for display
export function sendOutputToServer(agentName, message) {
    serverProxy.getSocket().emit('bot-output', agentName, message);
}

// for sending per-agent addon telemetry to MindServer
export function sendAddonsLiveToServer(agentName, telemetry) {
    serverProxy.getSocket()?.emit('addons-live', agentName, telemetry);
}
