import { APIHandler } from './api';
import { AuthHandler } from './auth';
import { DolphinStore } from './store';
import { initDOMBinding } from './dom';

export class DolphinClient {

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

