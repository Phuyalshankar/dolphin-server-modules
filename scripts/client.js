/**
 * @typedef {Object} DolphinResponse
 * @property {boolean} success
 * @property {any} [data]
 * @property {string} [message]
 * @property {number} [status]
 */

/**
 * @typedef {Object} SignalMessage
 * @property {string} msgId
 * @property {string} type
 * @property {string} from
 * @property {string} to
 * @property {any} data
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
 * @param {any} payload
 * @param {string} [topic]
 */

/**
 * Dolphin Client v2.0 - Full-stack Realtime, API & Auth Client
 * Zero-dependency, pure JS.
 * 
 * यो लाइब्रेरी डल्फिन सर्भरबाट सिधै उपलब्ध हुने पब-सब, API र Auth लाइब्रेरी हो।
 */

class APIHandler {
    /**
     * @param {DolphinClient} client
     */
    constructor(client) {
        this.client = client;
        return this._createProxy([]);
    }

    /**
     * @param {string[]} pathParts
     * @private
     */
    _createProxy(pathParts) {
        const path = pathParts.join('/');
        
        const target = (options) => {
            return this.request('GET', path, null, options);
        };

        // Add standard methods to the function target
        target.get = (pathOrOptions, options) => {
            if (typeof pathOrOptions === 'string') return this.request('GET', pathOrOptions, null, options);
            return this.request('GET', path, null, pathOrOptions);
        };
        target.post = (pathOrBody, bodyOrOptions, options) => {
            if (typeof pathOrBody === 'string') return this.request('POST', pathOrBody, bodyOrOptions, options);
            return this.request('POST', path, pathOrBody, bodyOrOptions);
        };
        target.put = (pathOrBody, bodyOrOptions, options) => {
            if (typeof pathOrBody === 'string') return this.request('PUT', pathOrBody, bodyOrOptions, options);
            return this.request('PUT', path, pathOrBody, bodyOrOptions);
        };
        target.del = (pathOrOptions, options) => {
            if (typeof pathOrOptions === 'string') return this.request('DELETE', pathOrOptions, null, options);
            return this.request('DELETE', path, null, pathOrOptions);
        };
        target.request = (method, subPath, body, options) => {
            const finalPath = subPath ? `${path}/${subPath.startsWith('/') ? subPath.slice(1) : subPath}` : path;
            return this.request(method, finalPath, body, options);
        };

        const methods = ['get', 'post', 'put', 'del', 'request'];

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
     * @param {string} method
     * @param {string} path
     * @param {any} [body]
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    async request(method, path, body = null, options = {}) {
        const url = `${this.client.httpUrl}${path.startsWith('/') ? path : '/' + path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (this.client.accessToken) {
            headers['Authorization'] = `Bearer ${this.client.accessToken}`;
        }

        const fetchOptions = {
            method,
            headers,
            ...options
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            throw { status: response.status, data };
        }

        return data;
    }

    /**
     * @param {string|RequestInit} [pathOrOptions]
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    get(pathOrOptions, options) { return Promise.resolve(); }

    /**
     * @param {string|any} [pathOrBody]
     * @param {any} [bodyOrOptions]
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    post(pathOrBody, bodyOrOptions, options) { return Promise.resolve(); }

    /**
     * @param {string|any} [pathOrBody]
     * @param {any} [bodyOrOptions]
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    put(pathOrBody, bodyOrOptions, options) { return Promise.resolve(); }

    /**
     * @param {string|RequestInit} [pathOrOptions]
     * @param {RequestInit} [options]
     * @returns {Promise<any>}
     */
    del(pathOrOptions, options) { return Promise.resolve(); }
}

class AuthHandler {
    /**
     * @param {DolphinClient} client
     */
    constructor(client) {
        this.client = client;
        this.user = null;
    }

    /**
     * @param {string} email
     * @param {string} password
     * @returns {Promise<any>}
     */
    async login(email, password) {
        const res = await this.client.api.post('/auth/login', { email, password });
        if (res.accessToken) {
            this.client.setToken(res.accessToken);
            this.user = res.user;
        }
        return res;
    }

    /** @param {any} data */
    async register(data) {
        return await this.client.api.post('/auth/register', data);
    }

    /** @returns {Promise<DolphinResponse>} */
    async me() {
        const res = await this.client.api.get('/auth/me');
        if (res.success) {
            this.user = res.data;
        }
        return res;
    }

    async logout() {
        await this.client.api.post('/auth/logout');
        this.client.setToken(null);
        this.user = null;
    }

    /** @param {string} email */
    async forgotPassword(email) {
        return await this.client.api.post('/auth/forgot-password', { email });
    }
}

class DolphinClient {
    /**
     * @param {string} [url]
     * @param {string} [deviceId]
     */
    constructor(url = '', deviceId = '') {
        // Handle URL formatting
        if (!url && typeof window !== 'undefined') {
            url = window.location.host;
        }
        
        let protocol = 'http:';
        if (url && url.startsWith('https://')) {
            protocol = 'https:';
        } else if (url && url.startsWith('http://')) {
            protocol = 'http:';
        } else if (typeof window !== 'undefined') {
            protocol = window.location.protocol;
        }

        this.host = (url || 'localhost').replace(/\/$/, "").replace(/^https?:\/\//, "");
        this.httpUrl = `${protocol}//${this.host}`;
        this.deviceId = deviceId || 'web_' + Math.random().toString(36).substr(2, 5);
        
        /** @type {WebSocket | null} */
        this.socket = null;
        
        // Polyfill Storage if not browser
        this.storage = typeof localStorage !== 'undefined' ? localStorage : {
            getItem: (key) => null,
            setItem: (key, val) => {},
            removeItem: (key) => {}
        };
        
        /** @type {string | null} */
        this.accessToken = this.storage.getItem('dolphin_token');
        
        // Sub-handlers
        this.api = new APIHandler(this);
        this.auth = new AuthHandler(this);
        
        /** @type {Map<string, Set<TopicCallback>>} */
        this.handlers = new Map(); // topic -> Set of callbacks
        /** @type {Set<function(SignalMessage): void>} */
        this.signalHandlers = new Set();
        /** @type {Set<function(FileMetadata): void>} */
        this.fileHandlers = new Set();

        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    /**
     * टोकन सेट गर्ने र सेभ गर्ने
     */
    setToken(token) {
        this.accessToken = token;
        if (token) {
            this.storage.setItem('dolphin_token', token);
        } else {
            this.storage.removeItem('dolphin_token');
        }
    }

    /**
     * रियल-टाइम सर्भरसँग कनेक्शन सुरु गर्ने
     * @returns {Promise<void>}
     */
    async connect() {
        return new Promise((resolve, reject) => {
            const protocol = this.httpUrl.startsWith('https') ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${this.host}/realtime?deviceId=${this.deviceId}`;
            
            console.log(`[Dolphin] Connecting to ${wsUrl}...`);
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log(`[Dolphin] Connected as "${this.deviceId}" 🐬`);
                this.reconnectAttempts = 0;
                resolve();
            };

            this.socket.onmessage = (event) => {
                this._handleMessage(event.data);
            };

            this.socket.onclose = () => {
                console.warn("[Dolphin] Connection closed");
                this._maybeReconnect();
            };

            this.socket.onerror = (err) => {
                console.error("[Dolphin] WebSocket Error:", err);
                reject(err);
            };
        });
    }

    _handleMessage(data) {
        try {
            const parsed = JSON.parse(data);
            
            // १. Signaling Messages
            if (parsed.type && parsed.from && (parsed.to === this.deviceId || parsed.to === 'all')) {
                // Auto-ACK for signaling messages
                if (parsed.msgId && parsed.type !== 'ACK') {
                    this._sendAck(parsed.from, parsed.msgId);
                }
                this.signalHandlers.forEach(handler => handler(parsed));
            }

            // २. File & Data Responses
            if (parsed.type === 'FILE_AVAILABLE') {
                this.fileHandlers.forEach(handler => handler(parsed));
            }
            if (parsed.type === 'FILE_CHUNK') {
                this.saveFileProgress(parsed.fileId, parsed.chunkIndex);
                this.handlers.forEach((callbacks, pattern) => {
                    if (pattern === 'file:chunk' || pattern === `file:chunk/${parsed.fileId}`) {
                        callbacks.forEach(cb => cb(parsed));
                    }
                });
            }
            if (parsed.type === 'PULL_RESPONSE') {
                this.handlers.forEach((callbacks, pattern) => {
                    if (pattern === 'pull:response' || pattern === `pull:response/${parsed.topic}`) {
                        callbacks.forEach(cb => cb(parsed.payload, parsed.topic));
                    }
                });
            }

            // ३. Pub/Sub Messages
            if (parsed.topic && parsed.payload !== undefined) {
                const topic = parsed.topic;
                this.handlers.forEach((callbacks, pattern) => {
                    if (this._matchTopic(pattern, topic)) {
                        callbacks.forEach(cb => cb(parsed.payload, topic));
                    }
                });
            }
        } catch (e) {
            this.handlers.forEach((callbacks, pattern) => {
                if (pattern === 'raw') callbacks.forEach(cb => cb(data));
            });
        }
    }

    /**
     * @param {string} to
     * @param {string} msgId
     * @private
     */
    _sendAck(to, msgId) {
        this.publish(`phone/signaling/${to}`, {
            type: 'ACK',
            from: this.deviceId,
            to: to,
            data: { ackId: msgId },
            timestamp: Date.now()
        });
    }

    _matchTopic(pattern, topic) {
        if (pattern === topic || pattern === '#') return true;
        const pParts = pattern.split('/');
        const tParts = topic.split('/');
        if (pParts.length !== tParts.length && !pattern.includes('#')) return false;
        for (let i = 0; i < pParts.length; i++) {
            if (pParts[i] === '#') return true;
            if (pParts[i] !== '+' && pParts[i] !== tParts[i]) return false;
        }
        return pParts.length === tParts.length;
    }

    /**
     * @param {string} topic
     * @param {TopicCallback} callback
     */
    subscribe(topic, callback) {
        if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
        this.handlers.get(topic).add(callback);
    }

    /**
     * @param {string} topic
     * @param {TopicCallback} callback
     */
    unsubscribe(topic, callback) {
        if (this.handlers.has(topic)) {
            const callbacks = this.handlers.get(topic);
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.handlers.delete(topic);
            }
        }
    }

    /**
     * @param {string} topic
     * @param {any} payload
     */
    publish(topic, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ topic, payload }));
        }
    }

    /**
     * High-frequency data push
     * @param {string} topic
     * @param {any} payload
     */
    pubPush(topic, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'pub', topic, payload }));
        }
    }

    /**
     * Request historical data from topic
     * @param {string} topic
     * @param {number} [count]
     */
    subPull(topic, count = 10) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ 
                type: 'PULL_REQUEST', 
                topic, 
                count 
            }));
        }
    }

    /**
     * Start downloading a file by chunks
     * @param {string} fileId
     * @param {number} [startChunk]
     */
    subFile(fileId, startChunk = 0) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'FILE_REQUEST',
                fileId,
                startChunk
            }));
        }
    }

    /**
     * Resume a file download from last saved progress
     * @param {string} fileId
     */
    resumeFile(fileId) {
        const lastChunk = parseInt(localStorage.getItem(`dolphin_file_${fileId}`) || "-1");
        this.subFile(fileId, lastChunk + 1);
    }

    /**
     * Save download progress
     * @param {string} fileId
     * @param {number} chunkIndex
     */
    saveFileProgress(fileId, chunkIndex) {
        this.storage.setItem(`dolphin_file_${fileId}`, chunkIndex.toString());
    }

    /**
     * @param {function(SignalMessage): void} handler
     */
    onSignal(handler) {
        this.signalHandlers.add(handler);
    }

    /**
     * @param {function(SignalMessage): void} handler
     */
    offSignal(handler) {
        this.signalHandlers.delete(handler);
    }

    /**
     * @param {function(FileMetadata): void} handler
     */
    onFileAvailable(handler) {
        this.fileHandlers.add(handler);
    }

    /**
     * @param {function(FileMetadata): void} handler
     */
    offFileAvailable(handler) {
        this.fileHandlers.delete(handler);
    }

    _maybeReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            setTimeout(() => this.connect(), delay);
        }
    }
}

// Browser Global Export
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.DolphinClient = DolphinClient;
    // @ts-ignore
    window.dolphin = new DolphinClient();
}

// NodeJS/CommonJS Export support for IDE/Testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DolphinClient };
}
