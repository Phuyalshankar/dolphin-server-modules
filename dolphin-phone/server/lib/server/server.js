"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDolphinServer = createDolphinServer;
const node_http_1 = __importDefault(require("node:http"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ws_1 = require("ws");
const router_1 = require("../router/router");
function createDolphinServer(options = {}) {
    const router = (0, router_1.createDolphinRouter)();
    // Automatically serve the client library
    router.get('/dolphin-client.js', (ctx) => {
        const clientPath = node_path_1.default.join(process.cwd(), 'scripts', 'client.js');
        if (node_fs_1.default.existsSync(clientPath)) {
            const content = node_fs_1.default.readFileSync(clientPath, 'utf8');
            ctx.setHeader('Content-Type', 'application/javascript');
            ctx.res.end(content);
            return;
        }
        return ctx.status(404).json({ error: 'Client library not found' });
    });
    const middlewares = [];
    const wss = new ws_1.WebSocketServer({ noServer: true });
    const server = node_http_1.default.createServer(async (req, res) => {
        // Store status for chaining
        let pendingStatus = 200;
        // Helper to send response
        const send = (data, contentType, status) => {
            if (res.headersSent)
                return;
            const finalStatus = status !== undefined ? status : pendingStatus;
            res.statusCode = finalStatus;
            res.setHeader('Content-Type', contentType);
            if (contentType === 'application/json') {
                res.end(JSON.stringify(data));
            }
            else {
                res.end(String(data));
            }
            pendingStatus = 200; // Reset after send
        };
        // Add response helpers
        res.json = (data, status) => send(data, 'application/json', status);
        res.text = (data, status) => send(data, 'text/plain', status);
        res.html = (data, status) => send(data, 'text/html', status);
        const host = req.headers.host || 'localhost';
        const parsedUrl = new URL(req.url, `http://${host}`);
        const ctx = {
            req,
            res,
            params: {},
            query: Object.fromEntries(parsedUrl.searchParams),
            body: {},
            state: {},
            json: (data, status) => {
                send(data, 'application/json', status);
                return ctx;
            },
            text: (data, status) => {
                send(data, 'text/plain', status);
                return ctx;
            },
            html: (data, status) => {
                send(data, 'text/html', status);
                return ctx;
            },
            status: (code) => {
                pendingStatus = code;
                return ctx;
            },
            setHeader: (name, value) => {
                res.setHeader(name, value);
                return ctx;
            },
            getHeader: (name) => {
                return req.headers[name.toLowerCase()];
            }
        };
        // Global middleware execution
        for (const mw of middlewares) {
            if (res.writableEnded)
                return;
            await new Promise(resolve => {
                if (mw.length === 3) {
                    mw(req, res, resolve);
                }
                else {
                    mw(ctx, resolve);
                }
            });
        }
        // Body parsing for POST/PUT/PATCH
        const contentType = req.headers['content-type'] || '';
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (contentType.includes('multipart/form-data')) {
                // Handled by third-party middlewares like multer. Just sync to ctx.
                if (req.body)
                    ctx.body = req.body;
                if (req.file)
                    ctx.file = req.file;
                if (req.files)
                    ctx.files = req.files;
            }
            else {
                const chunks = [];
                for await (const chunk of req)
                    chunks.push(chunk);
                const rawBody = Buffer.concat(chunks).toString();
                if (contentType.includes('application/json')) {
                    try {
                        const parsed = JSON.parse(rawBody);
                        ctx.body = parsed;
                        req.body = parsed;
                    }
                    catch {
                        ctx.body = {};
                        req.body = {};
                    }
                }
                else if (contentType.includes('application/x-www-form-urlencoded')) {
                    const parsed = Object.fromEntries(new URLSearchParams(rawBody));
                    ctx.body = parsed;
                    req.body = parsed;
                }
                else {
                    ctx.body = rawBody;
                    req.body = rawBody;
                }
            }
        }
        // Matching route
        const match = router.match(req.method, parsedUrl.pathname);
        if (match) {
            ctx.params = match.params;
            req.params = match.params;
            try {
                let result;
                const handlers = match.handlers;
                for (let i = 0; i < handlers.length; i++) {
                    if (res.headersSent || res.writableEnded)
                        break;
                    const handler = handlers[i];
                    await new Promise(async (resolve, reject) => {
                        try {
                            // If it's a middleware (takes ctx and next)
                            if (handler.length >= 2) {
                                result = await handler(ctx, resolve);
                            }
                            else {
                                // If it's a regular handler
                                result = await handler(ctx);
                                resolve();
                            }
                        }
                        catch (err) {
                            reject(err);
                        }
                    });
                }
                // If no response sent, send the last handler result or 204
                if (!res.headersSent) {
                    if (result !== undefined && result !== null) {
                        // Apply status from result if it's a valid number, otherwise use pendingStatus
                        const status = (typeof result.status === 'number' && result.status >= 100 && result.status < 600)
                            ? result.status
                            : pendingStatus;
                        send(result, 'application/json', status);
                    }
                    else {
                        send(null, 'application/json', 204);
                    }
                }
            }
            catch (err) {
                console.error('Server Handler Error:', err);
                if (!res.headersSent) {
                    send({ error: err.message || 'Internal Server Error' }, 'application/json', err.status || 500);
                }
            }
        }
        else {
            if (!res.headersSent) {
                send({ error: 'Not Found' }, 'application/json', 404);
            }
        }
    });
    // --- WebSocket Upgrade Handling ---
    server.on('upgrade', (request, socket, head) => {
        const { pathname } = new URL(request.url, `http://${request.headers.host}`);
        if (pathname === '/phone' || pathname === '/realtime') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
        else {
            socket.destroy();
        }
    });
    if (options.realtime) {
        wss.on('connection', (ws, request) => {
            const deviceId = new URL(request.url, `http://h`).searchParams.get('deviceId') || 'anonymous';
            options.realtime.register(deviceId, ws);
            ws.on('message', (data) => {
                // Touch keeps device alive (prevents 60s timeout)
                if (typeof options.realtime.touch === 'function') options.realtime.touch(deviceId);
                options.realtime.handle(data, ws, deviceId);
            });
            ws.on('pong', () => {
                if (typeof options.realtime.touch === 'function') options.realtime.touch(deviceId);
            });
            ws.on('close', () => options.realtime.unregister(deviceId, ws));
            ws.on('error', () => options.realtime.unregister(deviceId, ws));
        });
    }
    return {
        ...router,
        http: server,
        wss,
        use: (prefixOrMw, mw) => {
            if (typeof prefixOrMw === 'string' && mw && typeof mw.match === 'function') {
                router.use(prefixOrMw, mw);
            }
            else {
                middlewares.push(prefixOrMw);
            }
        },
        listen: (port = options.port || 3000, callback) => {
            return server.listen(port, options.host || '0.0.0.0', callback);
        },
        close: () => server.close()
    };
}
//# sourceMappingURL=server.js.map