/**
 * Dolphin Client v1.1 - Full-stack Realtime, API & Auth Client
 * Zero-dependency, pure JS.
 * 
 * यो लाइब्रेरी डल्फिन सर्भरबाट सिधै उपलब्ध हुने पब-सब, API र Auth लाइब्रेरी हो।
 */

class APIHandler {
    constructor(client) {
        this.client = client;
    }

    async request(method, path, body = null, options = {}) {
        const url = `${this.client.httpUrl}${path.startsWith('/') ? path : '/' + path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // अटोमेटिक टोकन इन्जेक्सन
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
        
        // JSON वा Text ह्यान्डल गर्ने
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

    get(path, options) { return this.request('GET', path, null, options); }
    post(path, body, options) { return this.request('POST', path, body, options); }
    put(path, body, options) { return this.request('PUT', path, body, options); }
    del(path, options) { return this.request('DELETE', path, null, options); }
}

class AuthHandler {
    constructor(client) {
        this.client = client;
        this.user = null;
    }

    async login(email, password) {
        const res = await this.client.api.post('/auth/login', { email, password });
        if (res.accessToken) {
            this.client.setToken(res.accessToken);
            this.user = res.user;
        }
        return res;
    }

    async register(data) {
        return await this.client.api.post('/auth/register', data);
    }

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

    async forgotPassword(email) {
        return await this.client.api.post('/auth/forgot-password', { email });
    }
}

class DolphinClient {
    constructor(url = window.location.host, deviceId = 'web_' + Math.random().toString(36).substr(2, 5)) {
        // Handle URL formatting
        this.host = url.replace(/\/$/, "").replace(/^https?:\/\//, "");
        this.httpUrl = `${window.location.protocol}//${this.host}`;
        this.deviceId = deviceId;
        
        this.socket = null;
        this.accessToken = localStorage.getItem('dolphin_token');
        
        // Sub-handlers
        this.api = new APIHandler(this);
        this.auth = new AuthHandler(this);
        
        this.handlers = new Map(); // topic -> Set of callbacks
        this.signalHandlers = new Set();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    /**
     * टोकन सेट गर्ने र सेभ गर्ने
     */
    setToken(token) {
        this.accessToken = token;
        if (token) {
            localStorage.setItem('dolphin_token', token);
        } else {
            localStorage.removeItem('dolphin_token');
        }
    }

    /**
     * रियल-टाइम सर्भरसँग कनेक्शन सुरु गर्ने
     */
    async connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
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
                this.signalHandlers.forEach(handler => handler(parsed));
            }

            // २. Pub/Sub Messages
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

    subscribe(topic, callback) {
        if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
        this.handlers.get(topic).add(callback);
    }

    publish(topic, payload) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ topic, payload }));
        }
    }

    onSignal(handler) {
        this.signalHandlers.add(handler);
    }

    _maybeReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000;
            setTimeout(() => this.connect(), delay);
        }
    }
}

// विन्डो ग्लोबलमा उपलब्ध गराउने
window.DolphinClient = DolphinClient;
// अटो-इनिशियलाइज (Optional)
window.dolphin = new DolphinClient();
