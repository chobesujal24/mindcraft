import net from 'node:net';
import http from 'node:http';
import settings from '../settings.js';
import { serverProxy } from '../mindserver_proxy.js';

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once('error', () => {
            resolve(false);
        });
        tester.once('listening', () => {
            tester.close(() => resolve(true));
        });
        tester.listen(port, '0.0.0.0');
    });
}

async function findAvailablePort(startPort, maxAttempts = 30) {
    let port = startPort;
    for (let i = 0; i < maxAttempts; i++) {
        if (await isPortAvailable(port)) {
            return port;
        }
        port++;
    }
    return startPort;
}

export async function addBrowserViewer(bot, count_id = 0) {
    if (!settings.render_bot_view) return;

    // Clean up previous viewer if already active
    if (bot.viewer && typeof bot.viewer.close === 'function') {
        try {
            bot.viewer.close();
            bot.viewer = null;
        } catch (_) {}
    }

    const basePort = Number(settings.render_bot_view_port || settings.viewer_port || process.env.VIEWER_PORT || 3005);
    const preferredPort = basePort + (Number(count_id) || 0);
    const targetPort = await findAvailablePort(preferredPort);

    // Monkey-patch http.createServer temporarily during initialization to guarantee
    // an 'error' event listener is attached to the internal server instance.
    // This prevents unhandled 'error' (EADDRINUSE) exceptions from crashing Node.js.
    const origCreateServer = http.createServer;
    let serverInstance = null;
    http.createServer = function (...args) {
        serverInstance = origCreateServer.apply(this, args);
        serverInstance.on('error', (err) => {
            console.warn(`[BrowserViewer] Server error on port ${targetPort}: ${err.message}`);
        });
        return serverInstance;
    };

    try {
        const { default: prismarineViewer } = await import('prismarine-viewer');
        prismarineViewer.mineflayer(bot, { port: targetPort, firstPerson: true });
        console.log(`[BrowserViewer] Bot view running on http://localhost:${targetPort}`);
        bot.viewerPort = targetPort;
        if (serverProxy && typeof serverProxy.setViewerPort === 'function') {
            serverProxy.setViewerPort(targetPort);
        }
    } catch (err) {
        console.warn(`[BrowserViewer] Failed to initialize prismarine-viewer: ${err.message}`);
    } finally {
        http.createServer = origCreateServer;
    }
}
