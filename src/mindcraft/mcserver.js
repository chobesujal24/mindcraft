import net from 'net';
import mc from 'minecraft-protocol';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Scans the IP address for Minecraft LAN servers and collects their info.
 * @param {string} ip - The IP address to scan.
 * @param {number} port - The port to check.
 * @param {number} timeout - The connection timeout in ms.
 * @param {boolean} verbose - Whether to print output on connection errors.
 * @returns {Promise<Array>} - A Promise that resolves to an array of server info objects.
 */
export async function serverInfo(ip, port, timeout = 1000, verbose = false) {
    return new Promise((resolve) => {

        let timeoutId = setTimeout(() => {
            if (verbose)
                console.error(`Timeout pinging server ${ip}:${port}`);
            resolve(null); // Resolve as null if no response within timeout
        }, timeout);

        mc.ping({
            host: ip,
            port
        }, (err, response) => {
            clearTimeout(timeoutId);

            if (err) {
                if (verbose)
                    console.error(`Error pinging server ${ip}:${port}`, err);
                return resolve(null);
            }

            // extract version number from modded servers like "Paper 1.21.4"
            const version = response?.version?.name || '';
            const match = String(version).match(/\d+\.\d+(?:\.\d+)?/);
            const numericVersion = match ? match[0] : null;
            if (numericVersion !== version) {
                console.log(`Modded server found (${version}), attempting to use ${numericVersion}...`);
            }

            const serverInfo = {
                host: ip,
                port,
                name: response.description.text || 'No description provided.',
                ping: response.latency,
                version: numericVersion,
                protocol: response.version.protocol,
                label: response.version.name
            };

            resolve(serverInfo);
        });
    });
}

/**
 * Scans the IP address for Minecraft LAN servers and collects their info.
 * @param {string} ip - The IP address to scan.
 * @param {boolean} earlyExit - Whether to exit early after finding a server.
 * @param {number} timeout - The connection timeout in ms.
 * @returns {Promise<Array>} - A Promise that resolves to an array of server info objects.
 */
export async function findServers(ip, earlyExit = false, timeout = 100) {
    const servers = [];
    const startPort = 49000;
    const endPort = 65000;

    const checkPort = (port) => {
        return new Promise((resolve) => {
            const socket = net.createConnection({ host: ip, port, timeout }, () => {
                socket.end();
                resolve(port); // Port is open
            });

            socket.on('error', () => resolve(null)); // Port is closed
            socket.on('timeout', () => {
                socket.destroy();
                resolve(null);
            });
        });
    };

    // This supresses a lot of annoying console output from the mc library
    // TODO: find a better way to do this, it supresses other useful output
    const originalConsoleLog = console.log;
    console.log = () => { };
    
    for (let port = startPort; port <= endPort; port++) {
        const openPort = await checkPort(port);
        if (openPort) {
            const server = await serverInfo(ip, port, 200, false);
            if (server) {
                servers.push(server);

                if (earlyExit) break;
            }
        }
    }

    // Restore console output
    console.log = originalConsoleLog;

    return servers;
}

/**
 * Gets the MC server info from the host and port.
 * @param {string} host - The host to search for.
 * @param {number} port - The port to search for.
 * @param {string} version - The version to search for.
 * @returns {Promise<Object>} - A Promise that resolves to the server info object.
 */
/**
 * Wire protocol number of a Minecraft version, or null when unknown.
 */
function protocolForVersion(version) {
    if (!version || version === "auto") return null;
    try {
        const data = require('minecraft-data')(version);
        if (!data) return null;
        // minecraft-data returns a version record; the protocol number lives in
        // record.version.version, but older shapes expose it directly.
        if (typeof data.version === 'number') return data.version;
        if (data.version && typeof data.version.version === 'number') return data.version.version;
        return null;
    } catch {
        return null;
    }
}

export async function getServer(host, port, version) {
    let server = null;
    let serverString = "";
    let serverVersion = "";
    
    // Search for server
    if (port == -1)
    {
        console.log(`No port provided. Searching for LAN server on host ${host}...`);
        
        await findServers(host, true).then((servers) => {
            if (servers.length > 0)
                server = servers[0];
        });

        if (server == null)
            throw new Error(`No server found on LAN.`);
    }
    else
        // A busy LAN world can take a couple of seconds to answer a status
        // ping. Five seconds avoids a false "server not found" warning while
        // still failing fast when the world is actually closed.
        server = await serverInfo(host, port, 5000, true);

    // Server not found
    if (server == null) 
        throw new Error(`MC server not found. (Host: ${host}, Port: ${port}) Check the host and port in settings.js, and ensure the server is running and open to public or LAN.`);

    serverString = `(Host: ${server.host}, Port: ${server.port}, Version: ${server.version})`;

    if (version === "auto") 
        serverVersion = server.version;
    else
        serverVersion = version;
    // Server version unsupported / mismatch
    const isSupported = mc.supportedVersions.some(v => 
        serverVersion === v || (serverVersion.startsWith(v) && serverVersion.charAt(v.length) === '.')
    ); // Checks version or parent version (e.g. if 1.7 is supported then 1.7.2 will be allowed)
     if (!isSupported)
        throw new Error(`MC server was found ${serverString}, but version is unsupported. Supported versions are: ${mc.supportedVersions.join(", ")}.`);

    // Proxies (Velocity, BungeeCord) report their own label, e.g.
    // "Velocity 1.7.2-26.3", so the name cannot be compared with the
    // configured version. The wire protocol is the reliable signal: a server
    // that answers with the same protocol number speaks the same Minecraft
    // version, whatever it calls itself.
    const expectedProtocol = protocolForVersion(version);
    const protocolMatches = expectedProtocol !== null && server.protocol === expectedProtocol;

     if (version !== "auto" && server.version !== version)
     {
        if (protocolMatches)
            console.log(`MC server found. ${serverString} (proxy label, protocol ${server.protocol} matches ${version})`);
        else
            throw new Error(`MC server was found ${serverString}, but version is incorrect. Expected ${version}, but found ${server.version}. Check the server version in settings.js.`);
     }
     else
        console.log(`MC server found. ${serverString}`);

    if (version !== "auto") {
        server.version = version;
    }

    return server;
}

export function isMinecraftVersionSupported(version) {
    const candidate = typeof version === 'string' ? version.trim() : '';
    return Boolean(candidate) && mc.supportedVersions.some(v =>
        candidate === v || (candidate.startsWith(v) && candidate.charAt(v.length) === '.')
    );
}
