import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import * as mindcraft from './mindcraft.js';
import { readFileSync } from 'fs';
import crypto from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mindserver is:
// - central hub for communication between all agent processes
// - api to control from other languages and remote users 
// - host for webapp

let io;
let server;
const agent_connections = {};
const agent_listeners = [];
const agent_addons_live = {};

// Optional shared secret. When set, REST and Socket.IO clients must present it.
// The server binds to loopback by default, so this is only needed when exposing it.
const MINDSERVER_TOKEN = process.env.MINDSERVER_TOKEN || '';

function safeEqual(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requestToken(req) {
    const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return header || req.query?.token || '';
}

function requireApiToken(req, res, next) {
    if (!MINDSERVER_TOKEN) return next();
    if (safeEqual(requestToken(req), MINDSERVER_TOKEN)) return next();
    return res.status(401).json({ success: false, error: 'unauthorised' });
}

const settings_spec = JSON.parse(readFileSync(path.join(__dirname, 'public/settings_spec.json'), 'utf8'));

class AgentConnection {
    constructor(settings, viewer_port) {
        this.socket = null;
        this.settings = settings;
        this.in_game = false;
        this.full_state = null;
        this.viewer_port = viewer_port;
    }
    setSettings(settings) {
        this.settings = settings;
    }
}

export function registerAgent(settings, viewer_port) {
    let agentConnection = new AgentConnection(settings, viewer_port);
    agent_connections[settings.profile.name] = agentConnection;
}

export function logoutAgent(agentName) {
    if (agent_connections[agentName]) {
        agent_connections[agentName].in_game = false;
        agentsStatusUpdate();
    }
}

function dispatchToAgentOrAll(agentName, eventName, payload) {
    if (agentName && agentName !== 'all' && agent_connections[agentName]?.socket) {
        agent_connections[agentName].socket.emit(eventName, payload);
        return true;
    }
    let sent = false;
    for (const [name, conn] of Object.entries(agent_connections)) {
        if (conn?.socket && (!agentName || agentName === 'all' || name === agentName)) {
            conn.socket.emit(eventName, payload);
            sent = true;
        }
    }
    return sent;
}

// Initialize the server
export function createMindServer(host_public = false, port = 8080) {
    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    io = new Server(server);
    if (MINDSERVER_TOKEN) {
        io.use((socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token || '';
            if (safeEqual(token, MINDSERVER_TOKEN)) return next();
            return next(new Error('unauthorised'));
        });
    }

    // Serve static files
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.join(__dirname, 'public')));

    // REST API endpoints for Direct Dispatch and Addons control (served on the MindServer port, 8091)
    app.get('/api/addons/live', requireApiToken, (req, res) => {
        const agentName = req.query.agent;
        if (agentName && agent_addons_live[agentName]) {
            return res.json(agent_addons_live[agentName]);
        }
        res.json({ agents: agent_addons_live });
    });

    app.post('/api/addons/config', requireApiToken, (req, res) => {
        const { agentName, config } = req.body || {};
        const sent = dispatchToAgentOrAll(agentName, 'addons-config', { agentName, config: config || req.body });
        res.json({ success: sent });
    });

    app.post('/api/addons/action', requireApiToken, (req, res) => {
        const { agentName, action, command, params } = req.body || {};
        const sent = dispatchToAgentOrAll(agentName, 'addons-action', { agentName, action, command, params });
        res.json({ success: sent });
    });

    app.post('/api/dispatch-command', requireApiToken, (req, res) => {
        const { agentName, command } = req.body || {};
        if (!command || typeof command !== 'string') {
            return res.status(400).json({ success: false, error: 'command is required' });
        }
        const formatted = command.trim().startsWith('/') ? command.trim() : `/${command.trim()}`;
        const sent = dispatchToAgentOrAll(agentName, 'direct-command', { agentName, command: formatted });
        res.json({ success: sent, command: formatted });
    });

    // Socket.io connection handling
    io.on('connection', (socket) => {
        let curAgentName = null;
        console.log('Client connected');

        agentsStatusUpdate(socket);

        socket.on('create-agent', async (settings, callback) => {
            console.log('API create agent...');
            for (let key in settings_spec) {
                if (!(key in settings)) {
                    if (settings_spec[key].required) {
                        callback({ success: false, error: `Setting ${key} is required` });
                        return;
                    }
                    else {
                        settings[key] = settings_spec[key].default;
                    }
                }
            }
            for (let key in settings) {
                if (!(key in settings_spec)) {
                    delete settings[key];
                }
            }
            if (settings.profile?.name) {
                if (settings.profile.name in agent_connections) {
                    callback({ success: false, error: 'Agent already exists' });
                    return;
                }
                let returned = await mindcraft.createAgent(settings);
                callback({ success: returned.success, error: returned.error });
                let name = settings.profile.name;
                if (!returned.success && agent_connections[name]) {
                    mindcraft.destroyAgent(name);
                    delete agent_connections[name];
                }
                agentsStatusUpdate();
            }
            else {
                console.error('Agent name is required in profile');
                callback({ success: false, error: 'Agent name is required in profile' });
            }
        });

        socket.on('get-settings', (agentName, callback) => {
            if (agent_connections[agentName]) {
                callback({ settings: agent_connections[agentName].settings });
            } else {
                callback({ error: `Agent '${agentName}' not found.` });
            }
        });

        socket.on('connect-agent-process', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agentsStatusUpdate();
            }
        });

        socket.on('login-agent', (agentName) => {
            if (agent_connections[agentName]) {
                agent_connections[agentName].socket = socket;
                agent_connections[agentName].in_game = true;
                curAgentName = agentName;
                agentsStatusUpdate();
            }
            else {
                console.warn(`Unregistered agent ${agentName} tried to login`);
            }
        });

        socket.on('disconnect', () => {
            if (agent_connections[curAgentName]) {
                console.log(`Agent ${curAgentName} disconnected`);
                agent_connections[curAgentName].in_game = false;
                agent_connections[curAgentName].socket = null;
                agentsStatusUpdate();
                watchHungAgent(curAgentName);
            }
            if (agent_listeners.includes(socket)) {
                removeListener(socket);
            }
        });

        socket.on('chat-message', (agentName, json) => {
            if (!agent_connections[agentName]) {
                console.warn(`Agent ${agentName} tried to send a message but is not logged in`);
                return;
            }
            if (!agent_connections[agentName].socket) {
                console.warn(`${curAgentName} -> ${agentName}: not connected right now, message dropped: ${json.message}`);
                return;
            }
            console.log(`${curAgentName} sending message to ${agentName}: ${json.message}`);
            agent_connections[agentName].socket.emit('chat-message', curAgentName, json);
        });

        socket.on('set-agent-settings', (agentName, settings) => {
            const agent = agent_connections[agentName];
            if (agent) {
                agent.setSettings(settings);
                if (agent.socket) agent.socket.emit('restart-agent');
                else console.warn(`Agent ${agentName} has no socket yet; restart skipped`);
            }
        });

        socket.on('restart-agent', (agentName) => {
            console.log(`Restarting agent: ${agentName}`);
            const agent = agent_connections[agentName];
            if (!agent) {
                console.warn(`Cannot restart unknown agent: ${agentName}`);
                return;
            }
            if (agent.socket) agent.socket.emit('restart-agent');
            else console.warn(`Agent ${agentName} has no socket yet; restart skipped`);
        });

        socket.on('stop-agent', (agentName) => {
            mindcraft.stopAgent(agentName);
        });

        socket.on('start-agent', (agentName) => {
            mindcraft.startAgent(agentName);
        });

        socket.on('destroy-agent', (agentName) => {
            if (agent_connections[agentName]) {
                mindcraft.destroyAgent(agentName);
                delete agent_connections[agentName];
                delete agent_addons_live[agentName];
            }
            agentsStatusUpdate();
        });

        socket.on('stop-all-agents', () => {
            console.log('Killing all agents');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
        });

        socket.on('shutdown', () => {
            console.log('Shutting down');
            for (let agentName in agent_connections) {
                mindcraft.stopAgent(agentName);
            }
            setTimeout(() => {
                console.log('Exiting MindServer');
                process.exit(0);
            }, 2000);
        });

        socket.on('send-message', (agentName, data) => {
            if (!agent_connections[agentName]) {
                console.warn(`Agent ${agentName} not in game, cannot send message via MindServer.`);
                return;
            }
            try {
                agent_connections[agentName].socket.emit('send-message', data);
            } catch (error) {
                console.error('Error: ', error);
            }
        });

        // Direct Server Command Dispatch (zero LLM token cost, zero latency)
        socket.on('direct-command', (agentName, commandData) => {
            const rawCmd = typeof commandData === 'string' ? commandData : commandData?.command;
            if (!rawCmd) return;
            const formatted = rawCmd.trim().startsWith('/') ? rawCmd.trim() : `/${rawCmd.trim()}`;
            dispatchToAgentOrAll(agentName, 'direct-command', { agentName, command: formatted });
        });

        // Per-agent Addons IPC over Socket.IO
        socket.on('addons-config', (agentName, config) => {
            if (typeof agentName === 'object' && agentName !== null) {
                config = agentName.config || agentName;
                agentName = agentName.agentName;
            }
            dispatchToAgentOrAll(agentName, 'addons-config', { agentName, config });
        });

        socket.on('addons-action', (agentName, actionData) => {
            if (typeof agentName === 'object' && agentName !== null) {
                actionData = agentName;
                agentName = actionData.agentName;
            }
            dispatchToAgentOrAll(agentName, 'addons-action', actionData);
        });

        socket.on('addons-live', (agentName, telemetry) => {
            const key = agentName || curAgentName || telemetry?.agentName;
            if (key) {
                agent_addons_live[key] = telemetry;
            }
            io.emit('addons-live', key, telemetry);
        });

        socket.on('bot-output', (agentName, message) => {
            io.emit('bot-output', agentName, message);
        });

        socket.on('update-viewer-port', (port) => {
            const key = curAgentName;
            if (key && agent_connections[key]) {
                agent_connections[key].viewer_port = Number(port);
                console.log(`[MindServer] Agent ${key} viewer port updated to ${port}`);
                agentsStatusUpdate();
            }
        });

        socket.on('listen-to-agents', () => {
            addListener(socket);
            if (Object.keys(agent_addons_live).length > 0) {
                for (const [aName, tel] of Object.entries(agent_addons_live)) {
                    socket.emit('addons-live', aName, tel);
                }
            }
        });
    });

    const requestedHost = process.env.MINDSERVER_HOST || '127.0.0.1';
    const isLoopback = requestedHost === '127.0.0.1' || requestedHost === 'localhost' || requestedHost === '::1';
    const host = (!isLoopback && !MINDSERVER_TOKEN) ? '127.0.0.1' : requestedHost;
    if (!isLoopback && !MINDSERVER_TOKEN) {
        console.warn('[MindServer] MINDSERVER_HOST is not loopback but MINDSERVER_TOKEN is empty; binding to 127.0.0.1 instead.');
    }
    server.listen(port, host, () => {
        const boundPort = server.address()?.port ?? port;
        console.log(`MindServer running on port ${boundPort} on host ${host}${MINDSERVER_TOKEN ? ' (token required)' : ''}`);
    });

    return server;
}

const HUNG_AGENT_MS = 60000;

// An agent whose event loop is blocked cannot process its own disconnect, so it
// stays alive at 100% CPU and never restarts. If its socket is still gone after
// a minute, kill the child and let AgentProcess restart it.
function watchHungAgent(agentName) {
    if (!agentName) return;
    const agentProcess = mindcraft.getAgentProcess(agentName);
    if (!agentProcess || !agentProcess.running) return;
    const child = agentProcess.process;
    if (!child) return;
    setTimeout(() => {
        if (agentProcess.process !== child || !agentProcess.running) return;
        if (agent_connections[agentName] && agent_connections[agentName].socket !== null) return;
        console.warn(`Agent ${agentName} has been disconnected for ${HUNG_AGENT_MS / 1000} s but its process is still running: killing it`);
        try { child.kill('SIGKILL'); } catch (err) { console.error(`Failed to kill hung agent ${agentName}:`, err.message); }
    }, HUNG_AGENT_MS);
}

function agentsStatusUpdate(socket) {
    if (!socket) {
        socket = io;
    }
    let agents = [];
    for (let agentName in agent_connections) {
        const conn = agent_connections[agentName];
        agents.push({
            name: agentName, 
            in_game: conn.in_game,
            viewerPort: conn.viewer_port,
            socket_connected: !!conn.socket
        });
    };
    socket.emit('agents-status', agents);
}


let listenerInterval = null;
function addListener(listener_socket) {
    if (agent_listeners.includes(listener_socket)) return;
    agent_listeners.push(listener_socket);
    if (agent_listeners.length === 1 && !listenerInterval) {
        listenerInterval = setInterval(async () => {
            const states = {};
            for (let agentName in agent_connections) {
                let agent = agent_connections[agentName];
                if (agent.in_game && agent.socket) {
                    try {
                        const state = await new Promise((resolve) => {
                            const timeout = setTimeout(() => resolve({ error: 'agent state request timed out' }), 2500);
                            agent.socket.emit('get-full-state', (s) => {
                                clearTimeout(timeout);
                                resolve(s);
                            });
                        });
                        states[agentName] = state;
                        if (agent_addons_live[agentName]) {
                            states[agentName] = { ...state, addons: agent_addons_live[agentName] };
                        }
                    } catch (e) {
                        states[agentName] = { error: String(e) };
                    }
                }
            }
            for (let listener of agent_listeners) {
                listener.emit('state-update', states);
            }
        }, 1000);
    }
}

function removeListener(listener_socket) {
    let idx;
    while ((idx = agent_listeners.indexOf(listener_socket)) !== -1) {
        agent_listeners.splice(idx, 1);
    }
    if (agent_listeners.length === 0 && listenerInterval) {
        clearInterval(listenerInterval);
        listenerInterval = null;
    }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const numStateListeners = () => agent_listeners.length;
