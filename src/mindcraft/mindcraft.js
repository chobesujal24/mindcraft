import { createMindServer, registerAgent, numStateListeners } from './mindserver.js';
import { AgentProcess } from '../process/agent_process.js';
import { getServer, isMinecraftVersionSupported } from './mcserver.js';
import open from 'open';

let mindserver;
let connected = false;
let agent_processes = {};
let agent_count = 0;
let mindserver_port = 8080;

export async function init(host_public=false, port=8080, auto_open_ui=true) {
    if (connected) {
        console.error('Already initiliazed!');
        return;
    }
    mindserver = createMindServer(host_public, port);
    mindserver_port = port;
    connected = true;
    if (auto_open_ui) {
        setTimeout(() => {
            // check if browser listener is already open
            if (numStateListeners() === 0) {
                const token = process.env.MINDSERVER_TOKEN;
                const url = 'http://127.0.0.1:' + port + (token ? '/#token=' + encodeURIComponent(token) : '');
                open(url);
            }
        }, 3000);
    }
}

export async function createAgent(settings) {
    if (!settings.profile.name) {
        console.error('Agent name is required in profile');
        return {
            success: false,
            error: 'Agent name is required in profile'
        };
    }
    settings = JSON.parse(JSON.stringify(settings));
    let agent_name = settings.profile.name;
    const agentIndex = agent_count++;
    const baseViewerPort = Number(settings.render_bot_view_port || settings.viewer_port || process.env.VIEWER_PORT || 3005);
    const viewer_port = baseViewerPort + agentIndex;
    registerAgent(settings, viewer_port);
    let load_memory = settings.load_memory || false;
    let init_message = settings.init_message || null;

    try {
        const viaProxy = settings.via_proxy?.enabled === true ? settings.via_proxy : null;
        if (viaProxy) {
            const proxyHost = typeof viaProxy.host === 'string' ? viaProxy.host.trim() : '';
            const proxyPort = Number(viaProxy.port);
            const clientVersion = typeof viaProxy.client_version === 'string' ? viaProxy.client_version.trim() : '';
            if (!proxyHost || !Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535 || !clientVersion) {
                throw new Error('ViaProxy is enabled, but its host, port, or client version is invalid.');
            }
            if (!isMinecraftVersionSupported(clientVersion)) {
                throw new Error(`ViaProxy client version '${clientVersion}' is not supported by this Mindcraft install. Choose a version listed by its Mineflayer protocol dependencies.`);
            }
            settings.via_proxy = { ...viaProxy, host: proxyHost, port: proxyPort, client_version: clientVersion };
            console.log(`ViaProxy enabled: Mineflayer ${clientVersion} client -> ${proxyHost}:${proxyPort}. Configure ViaProxy to target ${settings.host}:${settings.port} using ${settings.minecraft_version}.`);
        } else {
            try {
                const server = await getServer(settings.host, settings.port, settings.minecraft_version);
                settings.host = server.host;
                settings.port = server.port;
                settings.minecraft_version = server.version;
            } catch (error) {
                console.warn(`Error getting server:`, error);
                if (settings.minecraft_version === "auto") {
                    settings.minecraft_version = null;
                }
                console.warn(`Attempting to connect anyway...`);
            }
        }

        const agentProcess = new AgentProcess(agent_name, mindserver_port);
        agentProcess.start(load_memory, init_message, agentIndex);
        agent_processes[settings.profile.name] = agentProcess;
    } catch (error) {
        console.error(`Error creating agent ${agent_name}:`, error);
        destroyAgent(agent_name);
        return {
            success: false,
            error: error.message
        };
    }
    return {
        success: true,
        error: null
    };
}

export function getAgentProcess(agentName) {
    return agent_processes[agentName];
}

export function startAgent(agentName) {
    if (agent_processes[agentName]) {
        agent_processes[agentName].forceRestart();
    }
    else {
        console.error(`Cannot start agent ${agentName}; not found`);
    }
}

export function stopAgent(agentName) {
    if (agent_processes[agentName]) {
        agent_processes[agentName].stop();
    }
}

export function destroyAgent(agentName) {
    if (agent_processes[agentName]) {
        agent_processes[agentName].stop();
        delete agent_processes[agentName];
    }
}

export function shutdown() {
    console.log('Shutting down');
    for (let agentName in agent_processes) {
        agent_processes[agentName].stop();
    }
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}
