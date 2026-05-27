/**
 * Dolphin Client v2.1 — Full-stack Realtime, API & Auth Client
 * Zero-dependency, pure JS. Works in Browser + Node.js + React Native.
 *
 * Fixed in v2.1:
 *  - pubFile()          — file upload (chunked)
 *  - Request timeout    — AbortController with configurable timeout
 *  - auth.refresh()     — auto access-token refresh
 *  - auth.verify2FA()   — 2FA code verification
 *  - Offline queue      — publish queue when WS is disconnected
 *  - Improved JSDoc     — full TypeScript-compatible type hints
 */

// ─── JSDoc Types ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DolphinResponse
 * @property {boolean} success
 * @property {any}    [data]
 * @property {string} [message]
 * @property {number} [status]
 */

/**
 * @typedef {Object} SignalMessage
 * @property {string} msgId
 * @property {string} type
 * @property {string} from
 * @property {string} to
 * @property {any}    data
 * @property {number} timestamp
 */

/**
 * @typedef {Object} FileMetadata
 * @property {string} fileId
 * @property {string} name
 * @property {number} size
 * @property {number} totalChunks
 * @property {number} chunkSize
 */

/**
 * @callback TopicCallback
 * @param {any}    payload
 * @param {string} [topic]
 */

/**
 * @typedef {Object} DolphinClientOptions
 * @property {number} [timeout=15000]        — HTTP request timeout ms
 * @property {number} [chunkSize=65536]      — file upload chunk size (bytes)
 * @property {number} [maxReconnect=5]       — max WebSocket reconnect attempts
 * @property {boolean} [autoRefreshToken=true] — auto-refresh expired access token
 */

// ─── APIHandler ───────────────────────────────────────────────────────────────

class APIHandler {
    /** @param {DolphinClient} client */
    constructor(client) {
        this.client = client;
        return this._createProxy([]);
    }

    /** @private */
    _createProxy(pathParts) {
        const joined = pathParts.join('/');

        const target = (options) => this.request('GET', joined, null, options);

        target.get  = (pathOrOptions, options) =>
            typeof pathOrOptions === 'string'
                ? this.request('GET', pathOrOptions, null, options)
                : this.request('GET', joined, null, pathOrOptions);

        target.post = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('POST', pathOrBody, bodyOrOptions, options)
                : this.request('POST', joined, pathOrBody, bodyOrOptions);

        target.put  = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('PUT', pathOrBody, bodyOrOptions, options)
                : this.request('PUT', joined, pathOrBody, bodyOrOptions);

        target.patch = (pathOrBody, bodyOrOptions, options) =>
            typeof pathOrBody === 'string'
                ? this.request('PATCH', pathOrBody, bodyOrOptions, options)
                : this.request('PATCH', joined, pathOrBody, bodyOrOptions);

        target.del  = (pathOrOptions, options) =>
            typeof pathOrOptions === 'string'
                ? this.request('DELETE', pathOrOptions, null, options)
                : this.request('DELETE', joined, null, pathOrOptions);

        target.request = (method, subPath, body, options) => {
            const finalPath = subPath
                ? `${joined}/${subPath.startsWith('/') ? subPath.slice(1) : subPath}`
                : joined;
            return this.request(method, finalPath, body, options);
        };

        const methods = ['get', 'post', 'put', 'patch', 'del', 'request'];

        return new Proxy(target, {
            get: (t, prop) => {
                if (typeof prop === 'string' && !methods.includes(prop)) {
                    return this._createProxy([...pathParts, prop]);
                }
                return t[prop];
            }
        });
    }

    /**
     * Make an HTTP request with timeout + auto token refresh.
     * @param {string}      method
     * @param {string}      path
     * @param {any}         [body]
     * @param {RequestInit} [options]
     * @param {boolean}     [_isRetry=false]   — internal: prevent infinite refresh loop
     * @returns {Promise<any>}
     */
    async request(method, path, body = null, options = {}, _isRetry = false) {
        const url = `${this.client.httpUrl}${path.startsWith('/') ? path : '/' + path}`;

        const controller = new AbortController();
        const timeoutId  = setTimeout(
            () => controller.abort(),
            this.client.options.timeout
        );

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        if (this.client.accessToken) {
            headers['Authorization'] = `Bearer ${this.client.accessToken}`;
        }

        try {
            const response = await fetch(url, {
                method,
                headers,
                signal: controller.signal,
                ...(body ? { body: JSON.stringify(body) } : {}),
                ...options,
            });

            clearTimeout(timeoutId);

            // Auto-refresh: 401 + not a retry + autoRefreshToken enabled
            if (
                response.status === 401 &&
                !_isRetry &&
                this.client.options.autoRefreshToken
            ) {
                const refreshed = await this.client.auth._silentRefresh();
                if (refreshed) {
                    return this.request(method, path, body, options, true);
                }
            }

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) throw { status: response.status, data };
            return data;

        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw { status: 408, data: { error: 'Request timed out' } };
            }
            throw err;
        }
    }
}

// ─── AuthHandler ──────────────────────────────────────────────────────────────

class AuthHandler {
    /** @param {DolphinClient} client */
    constructor(client) {
        this.client = client;
        /** @type {any|null} */
        this.user = null;
        this._refreshing = false;
    }

    /**
     * Login with email + password.
     * @param {string} email
     * @param {string} password
     */
    async login(email, password) {
        const res = await this.client.api.post('/api/auth/login', { email, password });
        if (res.accessToken) {
            this.client.setToken(res.accessToken);
            this.user = res.user || null;
        }
        return res;
    }

    /**
     * Register a new account.
     * @param {{ email: string, password: string, [key: string]: any }} data
     */
    async register(data) {
        return this.client.api.post('/api/auth/register', data);
    }

    /** Get current user profile. */
    async me() {
        const res = await this.client.api.get('/api/auth/me');
        if (res.success) this.user = res.data;
        return res;
    }

    /** Logout and clear token. */
    async logout() {
        try { await this.client.api.post('/api/auth/logout'); } catch {}
        this.client.setToken(null);
        this.user = null;
    }

    /**
     * Manually refresh the access token using the httpOnly refresh-token cookie.
     * Called automatically on 401 if autoRefreshToken is enabled.
     * @returns {Promise<boolean>} — true if refresh succeeded
     */
    async refresh() {
        return this._silentRefresh();
    }

    /** @private */
    async _silentRefresh() {
        if (this._refreshing) return false;
        this._refreshing = true;
        try {
            const res = await this.client.api.post('/api/auth/refresh', null, {}, true);
            if (res.accessToken) {
                this.client.setToken(res.accessToken);
                return true;
            }
            return false;
        } catch {
            this.client.setToken(null);
            return false;
        } finally {
            this._refreshing = false;
        }
    }

    /**
     * Verify a 2FA TOTP code after login.
     * @param {string} code     — 6-digit TOTP code
     * @param {string} [email]  — email (if not already in user)
     */
    async verify2FA(code, email) {
        const payload = {
            code,
            email: email || this.user?.email,
        };
        const res = await this.client.api.post('/api/auth/2fa/verify', payload);
        if (res.accessToken) {
            this.client.setToken(res.accessToken);
            if (res.user) this.user = res.user;
        }
        return res;
    }

    /**
     * Enable 2FA — returns QR code URL and secret.
     */
    async enable2FA() {
        return this.client.api.post('/api/auth/2fa/enable');
    }

    /**
     * Disable 2FA.
     * @param {string} code — current TOTP code to confirm
     */
    async disable2FA(code) {
        return this.client.api.post('/api/auth/2fa/disable', { code });
    }

    /**
     * Request a password reset email.
     * @param {string} email
     */
    async forgotPassword(email) {
        return this.client.api.post('/api/auth/forgot-password', { email });
    }

    /**
     * Reset password using the token from email.
     * @param {string} token
     * @param {string} newPassword
     */
    async resetPassword(token, newPassword) {
        return this.client.api.post('/api/auth/reset-password', { token, newPassword });
    }
}

// ─── DolphinStore ─────────────────────────────────────────────────────────────

/**
 * Reactive state sync — auto-fetches collections and keeps them live
 * via WebSocket pub/sub. Works with React useSyncExternalStore.
 */
class DolphinStore {
    /** @param {DolphinClient} client */
    constructor(client) {
        this.client  = client;
        /** @type {Map<string, any>} */
        this.data      = new Map();
        /** @type {Set<function()>} */
        this.listeners = new Set();
        /** @type {Set<string>} */
        this.subscribed = new Set();

        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) return target[prop];
                if (typeof prop === 'string') return this._getCollection(prop);
            }
        });
    }

    /** @private */
    _getCollection(name) {
        if (!this.data.has(name)) {
            const collection = {
                _rawItems: [],
                items:     [],
                loading:   true,
                error:     null,
                success:   false,
                _filter:   null,
                _sort:     null,

                where: (fn) => {
                    collection._filter = fn;
                    this._applyTransform(collection);
                    return collection;
                },
                orderBy: (key, direction = 'asc') => {
                    collection._sort = { key, direction };
                    this._applyTransform(collection);
                    return collection;
                },
                reset: () => {
                    collection._filter = null;
                    collection._sort   = null;
                    this._applyTransform(collection);
                    return collection;
                },
            };

            this.data.set(name, collection);
            this._fetchAndSync(name);
        }
        return this.data.get(name);
    }

    /** @private */
    async _fetchAndSync(name) {
        const state = this.data.get(name);
        try {
            const res = await this.client.api.get(`/${name.toLowerCase()}`);
            state._rawItems = Array.isArray(res) ? res : (res.data || []);
            state.loading   = false;
            state.success   = true;
            state.error     = null;
            this._applyTransform(state);

            if (!this.subscribed.has(name)) {
                this.client.subscribe(`db:sync/${name.toLowerCase()}`, (update) => {
                    this._handleRemoteUpdate(name, update);
                });
                this.subscribed.add(name);
            }
        } catch (e) {
            state.loading = false;
            state.success = false;
            state.error   = e.data?.error || e.message || 'Fetch failed';
            this._notify();
        }
    }

    /** @private */
    _applyTransform(state) {
        let result = [...state._rawItems];
        if (state._filter) result = result.filter(state._filter);
        if (state._sort) {
            const { key, direction } = state._sort;
            result.sort((a, b) => {
                if (a[key] === b[key]) return 0;
                return (a[key] > b[key] ? 1 : -1) * (direction === 'asc' ? 1 : -1);
            });
        }
        state.items = result;
        this._notify();
    }

    /** @private */
    _handleRemoteUpdate(collection, update) {
        const state = this.data.get(collection);
        if (!state) return;
        const { type, data } = update;
        let items = state._rawItems;

        if (type === 'create') {
            items = [...items, data];
        } else if (type === 'update') {
            items = items.map(i => (i.id === data.id || i._id === data._id) ? { ...i, ...data } : i);
        } else if (type === 'delete') {
            items = items.filter(i => {
                if (data.id  != null && i.id  === data.id)  return false;
                if (data._id != null && i._id === data._id) return false;
                return true;
            });
        }

        state._rawItems = items;
        this._applyTransform(state);
    }

    /** Subscribe for React useSyncExternalStore */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** @param {string} collection */
    getSnapshot(collection) {
        return this.data.get(collection) || { items: [], loading: false, error: null, success: false };
    }

    /** @private */
    _notify() {
        this.listeners.forEach(l => l());
    }
}

// ─── DolphinClient ────────────────────────────────────────────────────────────

class DolphinClient {
    /**
     * @param {string}              [url]
     * @param {string}              [deviceId]
     * @param {DolphinClientOptions} [options]
     */
    constructor(url = '', deviceId = '', options = {}) {
        if (!url && typeof window !== 'undefined') url = window.location.host;

        let protocol = 'http:';
        if      (url.startsWith('https://')) protocol = 'https:';
        else if (url.startsWith('http://'))  protocol = 'http:';
        else if (typeof window !== 'undefined') protocol = window.location.protocol;

        this.host    = (url || 'localhost').replace(/\/$/, '').replace(/^https?:\/\//, '');
        this.httpUrl = `${protocol}//${this.host}`;
        this.deviceId = deviceId || 'web_' + Math.random().toString(36).substr(2, 8);

        /** @type {DolphinClientOptions} */
        this.options = {
            timeout:          15000,
            chunkSize:        65536,   // 64 KB
            maxReconnect:     5,
            autoRefreshToken: true,
            ...options,
        };

        /** @type {WebSocket|null} */
        this.socket = null;

        // Storage polyfill
        this.storage = typeof localStorage !== 'undefined' ? localStorage : {
            getItem:    () => null,
            setItem:    () => {},
            removeItem: () => {},
        };

        /** @type {string|null} */
        this.accessToken = this.storage.getItem('dolphin_token');

        // Sub-handlers
        this.api   = new APIHandler(this);
        this.auth  = new AuthHandler(this);
        this.store = new DolphinStore(this);

        /** @type {Map<string, Set<TopicCallback>>} */
        this.handlers       = new Map();
        /** @type {Set<function(SignalMessage): void>} */
        this.signalHandlers = new Set();
        /** @type {Set<function(FileMetadata): void>} */
        this.fileHandlers   = new Set();

        /** @type {Array<string>} — offline message queue */
        this._offlineQueue  = [];

        this.reconnectAttempts = 0;
    }

    /** Save or clear the access token */
    setToken(token) {
        this.accessToken = token;
        token
            ? this.storage.setItem('dolphin_token', token)
            : this.storage.removeItem('dolphin_token');
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    /** Connect to the Dolphin realtime server */
    async connect() {
        return new Promise((resolve, reject) => {
            const protocol = this.httpUrl.startsWith('https') ? 'wss:' : 'ws:';
            const wsUrl    = `${protocol}//${this.host}/realtime?deviceId=${this.deviceId}`;

            console.log(`[Dolphin] Connecting to ${wsUrl}...`);
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log(`[Dolphin] Connected as "${this.deviceId}" 🐬`);
                this.reconnectAttempts = 0;
                this._flushOfflineQueue();
                resolve();
            };
            this.socket.onmessage = (ev) => this._handleMessage(ev.data);
            this.socket.onclose   = () => {
                console.warn('[Dolphin] Connection closed');
                this._maybeReconnect();
            };
            this.socket.onerror = (err) => {
                console.error('[Dolphin] WebSocket error:', err);
                reject(err);
            };
        });
    }

    /** Disconnect cleanly */
    disconnect() {
        if (this.socket) {
            this.socket.onclose = null; // prevent auto-reconnect
            this.socket.close();
            this.socket = null;
        }
    }

    /** @private */
    _handleMessage(data) {
        try {
            const msg = JSON.parse(data);

            // Signaling
            if (msg.type && msg.from && (msg.to === this.deviceId || msg.to === 'all')) {
                if (msg.msgId && msg.type !== 'ACK') this._sendAck(msg.from, msg.msgId);
                this.signalHandlers.forEach(h => h(msg));
            }

            // File events
            if (msg.type === 'FILE_AVAILABLE') {
                this.fileHandlers.forEach(h => h(msg));
            }
            if (msg.type === 'FILE_CHUNK') {
                this.saveFileProgress(msg.fileId, msg.chunkIndex);
                this._dispatch('file:chunk', msg);
                this._dispatch(`file:chunk/${msg.fileId}`, msg);
            }
            if (msg.type === 'FILE_UPLOAD_ACK') {
                this._dispatch(`file:upload:ack/${msg.fileId}`, msg);
            }

            // Pull response
            if (msg.type === 'PULL_RESPONSE') {
                this._dispatch('pull:response', msg.payload, msg.topic);
                this._dispatch(`pull:response/${msg.topic}`, msg.payload, msg.topic);
            }

            // Pub/Sub
            if (msg.topic && msg.payload !== undefined) {
                this.handlers.forEach((cbs, pattern) => {
                    if (this._matchTopic(pattern, msg.topic)) {
                        cbs.forEach(cb => cb(msg.payload, msg.topic));
                    }
                });
            }
        } catch {
            this._dispatch('raw', data);
        }
    }

    /** @private */
    _dispatch(pattern, payload, topic) {
        const cbs = this.handlers.get(pattern);
        if (cbs) cbs.forEach(cb => cb(payload, topic || pattern));
    }

    /** @private */
    _sendRaw(msg) {
        const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(str);
        } else {
            // Buffer for offline queue (max 100 messages)
            if (this._offlineQueue.length < 100) this._offlineQueue.push(str);
        }
    }

    /** Flush buffered messages after reconnect @private */
    _flushOfflineQueue() {
        while (this._offlineQueue.length > 0) {
            const msg = this._offlineQueue.shift();
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(msg);
            }
        }
    }

    /** @private */
    _sendAck(to, msgId) {
        this._sendRaw({ type: 'ACK', from: this.deviceId, to, data: { ackId: msgId }, timestamp: Date.now() });
    }

    /** MQTT wildcard topic matching @private */
    _matchTopic(pattern, topic) {
        if (pattern === topic || pattern === '#') return true;
        const pp = pattern.split('/');
        const tp = topic.split('/');
        if (pp.length !== tp.length && !pattern.includes('#')) return false;
        for (let i = 0; i < pp.length; i++) {
            if (pp[i] === '#') return true;
            if (pp[i] !== '+' && pp[i] !== tp[i]) return false;
        }
        return pp.length === tp.length;
    }

    /** @private */
    _maybeReconnect() {
        if (this.reconnectAttempts < this.options.maxReconnect) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            console.log(`[Dolphin] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})...`);
            setTimeout(() => this.connect().catch(() => {}), delay);
        } else {
            console.error('[Dolphin] Max reconnect attempts reached.');
        }
    }

    // ── Pub/Sub ───────────────────────────────────────────────────────────────

    /**
     * Subscribe to a topic (MQTT wildcards supported: + and #).
     * @param {string}        topic
     * @param {TopicCallback} callback
     */
    subscribe(topic, callback) {
        if (!this.handlers.has(topic)) {
            this.handlers.set(topic, new Set());
            this._sendRaw({ type: 'sub', topic });
        }
        this.handlers.get(topic).add(callback);
    }

    /**
     * Unsubscribe from a topic.
     * @param {string}        topic
     * @param {TopicCallback} callback
     */
    unsubscribe(topic, callback) {
        if (this.handlers.has(topic)) {
            const cbs = this.handlers.get(topic);
            cbs.delete(callback);
            if (cbs.size === 0) {
                this.handlers.delete(topic);
                this._sendRaw({ type: 'unsub', topic });
            }
        }
    }

    /**
     * Publish a message to a topic. Queued if offline.
     * @param {string} topic
     * @param {any}    payload
     */
    publish(topic, payload) {
        this._sendRaw({ topic, payload });
    }

    /**
     * High-frequency data push (IoT sensors).
     * @param {string} topic
     * @param {any}    payload
     */
    pubPush(topic, payload) {
        this._sendRaw({ type: 'pub', topic, payload });
    }

    /**
     * Request historical data from a topic.
     * @param {string} topic
     * @param {number} [count=10]
     */
    subPull(topic, count = 10) {
        this._sendRaw({ type: 'PULL_REQUEST', topic, count });
    }

    // ── File Transfer ─────────────────────────────────────────────────────────

    /**
     * Upload a file to the server in chunks.
     * @param {string}   fileId
     * @param {Blob|ArrayBuffer|Uint8Array} fileData
     * @param {string}   [filename]
     * @param {function(number): void} [onProgress]  — progress callback (0-100)
     * @returns {Promise<void>}
     */
    async pubFile(fileId, fileData, filename = '', onProgress) {
        let buffer;
        if (fileData instanceof Blob) {
            buffer = await fileData.arrayBuffer();
        } else if (fileData instanceof ArrayBuffer) {
            buffer = fileData;
        } else {
            buffer = fileData.buffer || fileData;
        }

        const bytes      = new Uint8Array(buffer);
        const chunkSize  = this.options.chunkSize;
        const totalChunks = Math.ceil(bytes.length / chunkSize);

        // Send file metadata first
        this._sendRaw({
            type:        'FILE_UPLOAD_START',
            fileId,
            name:        filename,
            size:        bytes.length,
            totalChunks,
            chunkSize,
        });

        for (let i = 0; i < totalChunks; i++) {
            const chunk    = bytes.slice(i * chunkSize, (i + 1) * chunkSize);
            const b64      = this._uint8ToBase64(chunk);

            this._sendRaw({
                type:        'FILE_UPLOAD_CHUNK',
                fileId,
                chunkIndex:  i,
                totalChunks,
                data:        b64,
            });

            if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));

            // Small yield to prevent blocking
            if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
        }

        this._sendRaw({ type: 'FILE_UPLOAD_DONE', fileId });
    }

    /** @private */
    _uint8ToBase64(uint8) {
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        if (typeof btoa !== 'undefined') return btoa(binary);
        return Buffer.from(binary, 'binary').toString('base64');
    }

    /**
     * Download a file from the server by chunks.
     * @param {string} fileId
     * @param {number} [startChunk=0]
     */
    subFile(fileId, startChunk = 0) {
        this._sendRaw({ type: 'FILE_REQUEST', fileId, startChunk });
    }

    /**
     * Resume a file download from saved progress.
     * @param {string} fileId
     */
    resumeFile(fileId) {
        const last = parseInt(this.storage.getItem(`dolphin_file_${fileId}`) || '-1');
        this.subFile(fileId, last + 1);
    }

    /**
     * Save download chunk progress.
     * @param {string} fileId
     * @param {number} chunkIndex
     */
    saveFileProgress(fileId, chunkIndex) {
        this.storage.setItem(`dolphin_file_${fileId}`, chunkIndex.toString());
    }

    // ── Signaling ─────────────────────────────────────────────────────────────

    /**
     * @param {function(SignalMessage): void} handler
     */
    onSignal(handler)    { this.signalHandlers.add(handler); }

    /**
     * @param {function(SignalMessage): void} handler
     */
    offSignal(handler)   { this.signalHandlers.delete(handler); }

    /**
     * @param {function(FileMetadata): void} handler
     */
    onFileAvailable(handler)  { this.fileHandlers.add(handler); }

    /**
     * @param {function(FileMetadata): void} handler
     */
    offFileAvailable(handler) { this.fileHandlers.delete(handler); }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.DolphinClient = DolphinClient;
    window.dolphin       = new DolphinClient();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DolphinClient };
}

// Note: No top-level `export` here so that this file can be loaded
// via classic <script src="..."> in browsers / React without "Unexpected token 'export'"
