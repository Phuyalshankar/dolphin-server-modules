import http from 'node:http';
import { EventEmitter } from 'node:events';
import { createDolphinRouter } from '../router/router.js';
import { validateStructure } from '../middleware/zod.js';
class LazyWebSocketServer extends EventEmitter {
    realWss = null;
    pendingEvents = [];
    constructor() {
        super();
    }
    initPromise = null;
    async init() {
        if (this.realWss)
            return;
        if (!this.initPromise) {
            this.initPromise = (async () => {
                try {
                    const wsMod = await import('ws');
                    this.realWss = new wsMod.WebSocketServer({ noServer: true });
                    for (const [event, listener] of this.pendingEvents) {
                        this.realWss.on(event, listener);
                    }
                    this.pendingEvents = [];
                }
                catch (err) {
                    console.warn('⚠️ WebSockets are not supported in this runtime environment.', err);
                }
            })();
        }
        await this.initPromise;
    }
    on(event, listener) {
        if (this.realWss) {
            this.realWss.on(event, listener);
        }
        else {
            this.pendingEvents.push([event, listener]);
        }
        return this;
    }
    emit(event, ...args) {
        if (this.realWss) {
            return this.realWss.emit(event, ...args);
        }
        return super.emit(event, ...args);
    }
    handleUpgrade(request, socket, head, cb) {
        this.init().then(() => {
            if (this.realWss) {
                this.realWss.handleUpgrade(request, socket, head, cb);
            }
            else {
                socket.destroy();
            }
        });
    }
}
// Lazy-load client handler only in real ESM runtime (not during Jest CJS tests)
// This keeps import.meta out of files loaded by tests, avoiding "not defined" / "outside module" errors
let clientHandler = (ctx, routes) => ctx.status(404).json({ error: 'Client library not found' });
let clientDTSHandler = (ctx, routes) => ctx.status(404).json({ error: 'Client library typings not found' });
if (!process.env.JEST_WORKER_ID) {
    import('./client-serve.js')
        .then((m) => {
        clientHandler = m.clientHandler || clientHandler;
        clientDTSHandler = m.clientDTSHandler || clientDTSHandler;
    })
        .catch(() => { });
}
function getCollectionName(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0)
        return null;
    let idx = 0;
    if (['api', 'v1', 'v2', 'v3'].includes(segments[idx].toLowerCase())) {
        idx++;
    }
    if (idx < segments.length) {
        return segments[idx].replace(/[^a-zA-Z0-9_]/g, '_');
    }
    return null;
}
export function createDolphinServer(options = {}) {
    const router = createDolphinRouter();
    const isAutoReactive = options.autoReactive !== false;
    const authorizeGen = (ctx, next) => {
        const secretKey = process.env.DOLPHIN_GENERATE_KEY;
        if (secretKey) {
            const clientKey = ctx.getHeader('x-dolphin-key') || ctx.query.key;
            if (clientKey !== secretKey) {
                return ctx.status(403).json({ error: 'Unauthorized: Invalid or missing Dolphin Generation Key' });
            }
        }
        next();
    };
    // Automatically serve the client library (populated async from ESM-only helper)
    router.get('/dolphin-client.js', (ctx) => {
        authorizeGen(ctx, () => clientHandler(ctx, router._routes));
    });
    router.get('/dolphin-client.d.ts', (ctx) => {
        authorizeGen(ctx, () => clientDTSHandler(ctx, router._routes));
    });
    const middlewares = [];
    const wss = new LazyWebSocketServer();
    const server = http.createServer(async (req, res) => {
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
            // --- Dolphin Auto-Reactive Broadcasts ---
            if (isAutoReactive &&
                options.realtime &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
                finalStatus >= 200 &&
                finalStatus < 300 &&
                (!ctx || ctx.state.noReactive !== true)) {
                const collection = getCollectionName(parsedUrl.pathname);
                if (collection && collection !== 'dolphin_client_js' && collection !== 'dolphin_client_d_ts') {
                    let action = 'update';
                    if (req.method === 'POST')
                        action = 'create';
                    if (req.method === 'DELETE')
                        action = 'delete';
                    try {
                        options.realtime.publish(collection, {
                            collection,
                            action,
                            method: req.method,
                            path: parsedUrl.pathname,
                            data: data,
                            timestamp: Date.now()
                        });
                    }
                    catch (err) {
                        console.error('[DolphinReactive] Auto-broadcast failed:', err.message);
                    }
                }
            }
            pendingStatus = 200; // Reset after send
        };
        // Add response helpers
        res.json = (data, status) => send(data, 'application/json', status);
        res.text = (data, status) => send(data, 'text/plain', status);
        res.html = (data, status) => send(data, 'text/html', status);
        const host = req.headers.host || 'localhost';
        const parsedUrl = new URL(req.url, `http://${host}`);
        // --- Native Realtime SSE Route (Edge/Serverless Compatible) ---
        if (parsedUrl.pathname === '/realtime/sse') {
            const deviceId = parsedUrl.searchParams.get('deviceId') || parsedUrl.searchParams.get('id') || 'anonymous_sse';
            const token = parsedUrl.searchParams.get('token');
            let user = null;
            if (token) {
                try {
                    const jwt = require('jsonwebtoken');
                    const secret = process.env.JWT_SECRET || 'change_in_production';
                    user = jwt.verify(token, secret);
                }
                catch (err) {
                    console.warn('[DolphinRealtime] SSE Token verification failed:', err.message);
                }
            }
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            res.write(': heartbeat\n\n');
            if (options.realtime) {
                const sseSocket = {
                    readyState: 1, // OPEN
                    user,
                    send(data) {
                        if (!res.writableEnded) {
                            const payload = typeof data === 'string' ? data : JSON.stringify(data);
                            res.write(`data: ${payload}\n\n`);
                        }
                    },
                    close() {
                        try {
                            res.end();
                        }
                        catch { }
                    }
                };
                options.realtime.register(deviceId, sseSocket);
                // --- SSE Auto-subscription to topics ---
                const topicsArg = parsedUrl.searchParams.get('topics');
                if (topicsArg) {
                    topicsArg.split(',').forEach((topic) => {
                        options.realtime.subscribe(topic, (payload, matchedTopic) => {
                            if (!res.writableEnded) {
                                sseSocket.send({ topic: matchedTopic || topic, payload });
                            }
                        }, deviceId);
                    });
                }
                else {
                    options.realtime.subscribe('*', (payload, matchedTopic) => {
                        if (!res.writableEnded) {
                            sseSocket.send({ topic: matchedTopic, payload });
                        }
                    }, deviceId);
                }
                req.on('close', () => {
                    options.realtime.unregister(deviceId);
                });
            }
            return;
        }
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
                // BUG FIX (2026-06-29): Keep raw Buffer — do NOT call .toString() before branching.
                // Previous code did Buffer.concat(chunks).toString() unconditionally, which corrupted
                // binary bodies (e.g. application/octet-stream PCM audio) into garbled strings.
                const rawBodyBuffer = Buffer.concat(chunks);
                if (contentType.includes('application/json')) {
                    try {
                        const parsed = JSON.parse(rawBodyBuffer.toString());
                        ctx.body = parsed;
                        req.body = parsed;
                    }
                    catch {
                        ctx.body = {};
                        req.body = {};
                    }
                }
                else if (contentType.includes('application/x-www-form-urlencoded')) {
                    const parsed = Object.fromEntries(new URLSearchParams(rawBodyBuffer.toString()));
                    ctx.body = parsed;
                    req.body = parsed;
                }
                else if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
                    // Preserve raw Buffer for binary data (PCM audio, file uploads, etc. or images)
                    ctx.body = rawBodyBuffer;
                    req.body = rawBodyBuffer;
                }
                else {
                    ctx.body = rawBodyBuffer.toString();
                    req.body = rawBodyBuffer.toString();
                }
            }
        }
        // Matching route
        const match = router.match(req.method, parsedUrl.pathname);
        if (match) {
            ctx.params = match.params;
            req.params = match.params;
            // --- Automatic Zod Schema Validation ---
            if (match.schema) {
                try {
                    if (match.schema.params) {
                        ctx.params = validateStructure(match.schema.params, ctx.params);
                        req.params = ctx.params;
                    }
                    if (match.schema.query) {
                        ctx.query = validateStructure(match.schema.query, ctx.query);
                        req.query = ctx.query;
                    }
                    if (match.schema.body) {
                        ctx.body = validateStructure(match.schema.body, ctx.body);
                        req.body = ctx.body;
                    }
                }
                catch (err) {
                    if (!res.headersSent) {
                        const status = err.status || 400;
                        send(err, 'application/json', status);
                    }
                    return;
                }
            }
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
                                const r = await handler(ctx, resolve);
                                if (r !== undefined)
                                    result = r;
                            }
                            else {
                                // If it's a regular handler
                                const r = await handler(ctx);
                                if (r !== undefined)
                                    result = r;
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
        const allowedPaths = options.allowedWebSocketPaths || ['/phone', '/realtime'];
        const isAllowed = allowedPaths.some((p) => {
            if (p.endsWith('/*')) {
                return pathname.startsWith(p.slice(0, -2));
            }
            return pathname === p;
        });
        if (isAllowed) {
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
            const urlObj = new URL(request.url, `http://h`);
            const deviceId = urlObj.searchParams.get('deviceId') || urlObj.searchParams.get('id') || 'anonymous';
            const token = urlObj.searchParams.get('token');
            let user = null;
            if (token) {
                try {
                    const jwt = require('jsonwebtoken');
                    const secret = process.env.JWT_SECRET || 'change_in_production';
                    user = jwt.verify(token, secret);
                    ws.user = user; // attach user to socket
                }
                catch (err) {
                    console.warn('[DolphinRealtime] WS Token verification failed:', err.message);
                }
            }
            options.realtime.register(deviceId, ws);
            ws.on('message', (data) => {
                // Keep device alive on every message
                options.realtime.touch(deviceId);
                options.realtime.handle(data, ws, deviceId);
            });
            // Keep device alive on pong (response to server ping)
            ws.on('pong', () => {
                options.realtime.touch(deviceId);
            });
            ws.on('close', () => options.realtime.unregister(deviceId));
            ws.on('error', () => options.realtime.unregister(deviceId));
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