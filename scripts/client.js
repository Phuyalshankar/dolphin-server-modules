"use strict";
var DolphinModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client/index.ts
  var index_exports = {};
  __export(index_exports, {
    DolphinClient: () => DolphinClient
  });

  // src/client/api.ts
  var APIHandler = class {
    /** @param {DolphinClient} client */
    constructor(client) {
      this.client = client;
      return this._createProxy([]);
    }
    /** @private */
    _createProxy(pathParts) {
      const joined = pathParts.join("/");
      const target = (options) => this.request("GET", joined, null, options);
      target.get = (pathOrOptions, options) => typeof pathOrOptions === "string" ? this.request("GET", pathOrOptions, null, options) : this.request("GET", joined, null, pathOrOptions);
      target.post = (pathOrBody, bodyOrOptions, options) => typeof pathOrBody === "string" ? this.request("POST", pathOrBody, bodyOrOptions, options) : this.request("POST", joined, pathOrBody, bodyOrOptions);
      target.put = (pathOrBody, bodyOrOptions, options) => typeof pathOrBody === "string" ? this.request("PUT", pathOrBody, bodyOrOptions, options) : this.request("PUT", joined, pathOrBody, bodyOrOptions);
      target.patch = (pathOrBody, bodyOrOptions, options) => typeof pathOrBody === "string" ? this.request("PATCH", pathOrBody, bodyOrOptions, options) : this.request("PATCH", joined, pathOrBody, bodyOrOptions);
      target.del = (pathOrOptions, options) => typeof pathOrOptions === "string" ? this.request("DELETE", pathOrOptions, null, options) : this.request("DELETE", joined, null, pathOrOptions);
      target.request = (method, subPath, body, options) => {
        const finalPath = subPath ? `${joined}/${subPath.startsWith("/") ? subPath.slice(1) : subPath}` : joined;
        return this.request(method, finalPath, body, options);
      };
      const methods = ["get", "post", "put", "patch", "del", "request"];
      return new Proxy(target, {
        get: (t, prop) => {
          if (typeof prop === "string" && !methods.includes(prop)) {
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
    async request(method, path, body = null, options = {}) {
      const _isRetry = options._isRetry === true;
      const url = `${this.client.httpUrl}${path.startsWith("/") ? path : "/" + path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.client.options.timeout
      );
      const headers = {
        "Content-Type": "application/json",
        ...options.headers || {}
      };
      if (this.client.accessToken) {
        headers["Authorization"] = `Bearer ${this.client.accessToken}`;
      }
      const fetchOptions = { ...options };
      delete fetchOptions._isRetry;
      try {
        const response = await fetch(url, {
          method,
          headers,
          signal: controller.signal,
          ...body ? { body: JSON.stringify(body) } : {},
          ...fetchOptions
        });
        clearTimeout(timeoutId);
        if (response.status === 401 && !_isRetry && this.client.options.autoRefreshToken) {
          const refreshed = await this.client.auth._silentRefresh();
          if (refreshed) {
            return this.request(method, path, body, { ...options, _isRetry: true });
          }
        }
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") ? await response.json() : await response.text();
        if (!response.ok) throw { status: response.status, data };
        if (data && typeof data === "object") {
          if (data.accessToken) {
            this.client.setToken(data.accessToken);
            if (data.user) this.client.auth.user = data.user;
          }
        }
        if (this.client.options.autoBroadcast && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
          const cleanPath = path.startsWith("/") ? path.substring(1) : path;
          this.client.publish(cleanPath, { method: method.toUpperCase(), payload: body, result: data });
        }
        return data;
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw { status: 408, data: { error: "Request timed out" } };
        }
        throw err;
      }
    }
  };

  // src/client/auth.ts
  var AuthHandler = class {
    /** @param {DolphinClient} client */
    constructor(client) {
      this.client = client;
      this.user = null;
      this._refreshing = false;
    }
    /**
     * Login with email + password.
     * @param {string} email
     * @param {string} password
     */
    async login(email, password) {
      const res = await this.client.api.post("/api/auth/login", { email, password });
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
      return this.client.api.post("/api/auth/register", data);
    }
    /** Get current user profile. */
    async me() {
      const res = await this.client.api.get("/api/auth/me");
      if (res.success) this.user = res.data;
      return res;
    }
    /** Logout and clear token. */
    async logout() {
      try {
        await this.client.api.post("/api/auth/logout");
      } catch {
      }
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
        const res = await this.client.api.post("/api/auth/refresh", null, { _isRetry: true });
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
        email: email || this.user?.email
      };
      const res = await this.client.api.post("/api/auth/2fa/verify", payload);
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
      return this.client.api.post("/api/auth/2fa/enable");
    }
    /**
     * Disable 2FA.
     * @param {string} code — current TOTP code to confirm
     */
    async disable2FA(code) {
      return this.client.api.post("/api/auth/2fa/disable", { code });
    }
    /**
     * Request a password reset email.
     * @param {string} email
     */
    async forgotPassword(email) {
      return this.client.api.post("/api/auth/forgot-password", { email });
    }
    /**
     * Reset password using the token from email.
     * @param {string} token
     * @param {string} newPassword
     */
    async resetPassword(token, newPassword) {
      return this.client.api.post("/api/auth/reset-password", { token, newPassword });
    }
  };

  // src/client/store.ts
  var DolphinStore = class {
    /** @param {DolphinClient} client */
    constructor(client) {
      this.client = client;
      this.data = /* @__PURE__ */ new Map();
      this.listeners = /* @__PURE__ */ new Set();
      this.subscribed = /* @__PURE__ */ new Set();
      return new Proxy(this, {
        get: (target, prop) => {
          if (prop in target) return target[prop];
          if (typeof prop === "string") return this._getCollection(prop);
        }
      });
    }
    /** @private */
    _getCollection(name) {
      if (!this.data.has(name)) {
        const collection = {
          _rawItems: [],
          items: [],
          loading: true,
          error: null,
          success: false,
          _filter: null,
          _sort: null,
          where: (fn) => {
            collection._filter = fn;
            this._applyTransform(collection);
            return collection;
          },
          orderBy: (key, direction = "asc") => {
            collection._sort = { key, direction };
            this._applyTransform(collection);
            return collection;
          },
          reset: () => {
            collection._filter = null;
            collection._sort = null;
            this._applyTransform(collection);
            return collection;
          }
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
        state._rawItems = Array.isArray(res) ? res : res.data || [];
        state.loading = false;
        state.success = true;
        state.error = null;
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
        state.error = e.data?.error || e.message || "Fetch failed";
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
          return (a[key] > b[key] ? 1 : -1) * (direction === "asc" ? 1 : -1);
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
      if (type === "create") {
        items = [...items, data];
      } else if (type === "update") {
        items = items.map((i) => i.id === data.id || i._id === data._id ? { ...i, ...data } : i);
      } else if (type === "delete") {
        items = items.filter((i) => {
          if (data.id != null && i.id === data.id) return false;
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
      this.listeners.forEach((l) => l());
    }
  };

  // src/client/core.ts
  var DolphinClient = class {
    constructor(url = "", deviceId = "", options = {}) {
      if (!url && typeof window !== "undefined") url = window.location.host;
      let protocol = "http:";
      if (url.startsWith("https://")) protocol = "https:";
      else if (url.startsWith("http://")) protocol = "http:";
      else if (typeof window !== "undefined") protocol = window.location.protocol;
      this.host = (url || "localhost").replace(/\/$/, "").replace(/^https?:\/\//, "");
      this.httpUrl = `${protocol}//${this.host}`;
      this.deviceId = deviceId || "web_" + Math.random().toString(36).substr(2, 8);
      this.options = {
        timeout: 15e3,
        chunkSize: 65536,
        // 64 KB
        maxReconnect: 5,
        autoRefreshToken: true,
        ...options
      };
      this.socket = null;
      this.storage = typeof localStorage !== "undefined" ? localStorage : {
        getItem: () => null,
        setItem: () => {
        },
        removeItem: () => {
        }
      };
      this.accessToken = this.storage.getItem("dolphin_token");
      this.api = new APIHandler(this);
      this.auth = new AuthHandler(this);
      this.store = new DolphinStore(this);
      this.handlers = /* @__PURE__ */ new Map();
      this.signalHandlers = /* @__PURE__ */ new Set();
      this.fileHandlers = /* @__PURE__ */ new Set();
      this._offlineQueue = [];
      this.reconnectAttempts = 0;
    }
    /** Save or clear the access token */
    setToken(token) {
      this.accessToken = token;
      token ? this.storage.setItem("dolphin_token", token) : this.storage.removeItem("dolphin_token");
    }
    // ── WebSocket ─────────────────────────────────────────────────────────────
    /** Connect to the Dolphin realtime server */
    async connect() {
      return new Promise((resolve, reject) => {
        const protocol = this.httpUrl.startsWith("https") ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${this.host}/realtime?deviceId=${this.deviceId}`;
        console.log(`[Dolphin] Connecting to ${wsUrl}...`);
        this.socket = new WebSocket(wsUrl);
        this.socket.onopen = () => {
          console.log(`[Dolphin] Connected as "${this.deviceId}" \u{1F42C}`);
          this.reconnectAttempts = 0;
          this._flushOfflineQueue();
          resolve();
        };
        this.socket.onmessage = (ev) => this._handleMessage(ev.data);
        this.socket.onclose = () => {
          console.warn("[Dolphin] Connection closed");
          this._maybeReconnect();
        };
        this.socket.onerror = (err) => {
          console.error("[Dolphin] WebSocket error:", err);
          reject(err);
        };
      });
    }
    /** Disconnect cleanly */
    disconnect() {
      if (this.socket) {
        this.socket.onclose = null;
        this.socket.close();
        this.socket = null;
      }
    }
    /** @private */
    _handleMessage(data) {
      try {
        const msg = JSON.parse(data);
        if (msg.type && msg.from && (msg.to === this.deviceId || msg.to === "all")) {
          if (msg.msgId && msg.type !== "ACK") this._sendAck(msg.from, msg.msgId);
          this.signalHandlers.forEach((h) => h(msg));
        }
        if (msg.type === "FILE_AVAILABLE") {
          this.fileHandlers.forEach((h) => h(msg));
        }
        if (msg.type === "FILE_CHUNK") {
          this.saveFileProgress(msg.fileId, msg.chunkIndex);
          this._dispatch("file:chunk", msg);
          this._dispatch(`file:chunk/${msg.fileId}`, msg);
        }
        if (msg.type === "FILE_UPLOAD_ACK") {
          this._dispatch(`file:upload:ack/${msg.fileId}`, msg);
        }
        if (msg.type === "PULL_RESPONSE") {
          this._dispatch("pull:response", msg.payload, msg.topic);
          this._dispatch(`pull:response/${msg.topic}`, msg.payload, msg.topic);
        }
        if (msg.topic && msg.payload !== void 0) {
          this.handlers.forEach((cbs, pattern) => {
            if (this._matchTopic(pattern, msg.topic)) {
              cbs.forEach((cb) => cb(msg.payload, msg.topic));
            }
          });
        }
      } catch {
        this._dispatch("raw", data);
      }
    }
    /** @private */
    _dispatch(pattern, payload, topic) {
      const cbs = this.handlers.get(pattern);
      if (cbs) cbs.forEach((cb) => cb(payload, topic || pattern));
    }
    /** @private */
    _sendRaw(msg) {
      const str = typeof msg === "string" ? msg : JSON.stringify(msg);
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(str);
      } else {
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
      this._sendRaw({ type: "ACK", from: this.deviceId, to, data: { ackId: msgId }, timestamp: Date.now() });
    }
    /** MQTT wildcard topic matching @private */
    _matchTopic(pattern, topic) {
      if (pattern === topic || pattern === "#") return true;
      const pp = pattern.split("/");
      const tp = topic.split("/");
      if (pp.length !== tp.length && !pattern.includes("#")) return false;
      for (let i = 0; i < pp.length; i++) {
        if (pp[i] === "#") return true;
        if (pp[i] !== "+" && pp[i] !== tp[i]) return false;
      }
      return pp.length === tp.length;
    }
    /** @private */
    _maybeReconnect() {
      if (this.reconnectAttempts < this.options.maxReconnect) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts) * 1e3;
        console.log(`[Dolphin] Reconnecting in ${delay / 1e3}s (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect().catch(() => {
        }), delay);
      } else {
        console.error("[Dolphin] Max reconnect attempts reached.");
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
        this.handlers.set(topic, /* @__PURE__ */ new Set());
        this._sendRaw({ type: "sub", topic });
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
          this._sendRaw({ type: "unsub", topic });
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
      this._sendRaw({ type: "pub", topic, payload });
    }
    /**
     * Request historical data from a topic.
     * @param {string} topic
     * @param {number} [count=10]
     */
    subPull(topic, count = 10) {
      this._sendRaw({ type: "PULL_REQUEST", topic, count });
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
    async pubFile(fileId, fileData, filename = "", onProgress) {
      let buffer;
      if (fileData instanceof Blob) {
        buffer = await fileData.arrayBuffer();
      } else if (fileData instanceof ArrayBuffer) {
        buffer = fileData;
      } else {
        buffer = fileData.buffer || fileData;
      }
      const bytes = new Uint8Array(buffer);
      const chunkSize = this.options.chunkSize;
      const totalChunks = Math.ceil(bytes.length / chunkSize);
      this._sendRaw({
        type: "FILE_UPLOAD_START",
        fileId,
        name: filename,
        size: bytes.length,
        totalChunks,
        chunkSize
      });
      for (let i = 0; i < totalChunks; i++) {
        const chunk = bytes.slice(i * chunkSize, (i + 1) * chunkSize);
        const b64 = this._uint8ToBase64(chunk);
        this._sendRaw({
          type: "FILE_UPLOAD_CHUNK",
          fileId,
          chunkIndex: i,
          totalChunks,
          data: b64
        });
        if (onProgress) onProgress(Math.round((i + 1) / totalChunks * 100));
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      this._sendRaw({ type: "FILE_UPLOAD_DONE", fileId });
    }
    /** @private */
    _uint8ToBase64(uint8) {
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      if (typeof btoa !== "undefined") return btoa(binary);
      return Buffer.from(binary, "binary").toString("base64");
    }
    /**
     * Download a file from the server by chunks.
     * @param {string} fileId
     * @param {number} [startChunk=0]
     */
    subFile(fileId, startChunk = 0) {
      this._sendRaw({ type: "FILE_REQUEST", fileId, startChunk });
    }
    /**
     * Resume a file download from saved progress.
     * @param {string} fileId
     */
    resumeFile(fileId) {
      const last = parseInt(this.storage.getItem(`dolphin_file_${fileId}`) || "-1");
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
  };

  // src/client/dom.ts
  function attachDOMBinding(clientProto) {
    clientProto._initDOMBinding = function() {
      if (this._domInitialized) return;
      this._domInitialized = true;
      document.addEventListener("input", (e) => {
        if (!e.target || !e.target.getAttribute) return;
        const topic = e.target.getAttribute("data-rt-push");
        if (topic) {
          const payload = { name: e.target.name, value: e.target.value };
          this.pubPush(topic, payload);
        }
      });
      document.addEventListener("submit", async (e) => {
        if (!e.target || !e.target.getAttribute) return;
        const rtTopic = e.target.getAttribute("data-rt-submit");
        const apiTarget = e.target.getAttribute("data-api-submit");
        if (rtTopic || apiTarget) {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          if (rtTopic) {
            this.publish(rtTopic, data);
          } else if (apiTarget) {
            const parts = apiTarget.trim().split(" ");
            const method = parts.length > 1 ? parts[0].toUpperCase() : "POST";
            const path = parts.length > 1 ? parts[1] : parts[0];
            try {
              const result = await this.api.request(method, path, data);
              const resultBind = e.target.getAttribute("data-api-result");
              if (resultBind) this._updateDOM(resultBind, result);
              const redirect = e.target.getAttribute("data-api-redirect");
              if (redirect) window.location.href = redirect;
              if (e.target.hasAttribute("data-api-reload")) window.location.reload();
            } catch (err) {
              console.error("[Dolphin] API Submit Error:", err);
            }
          }
        }
      });
      document.addEventListener("click", async (e) => {
        if (!e.target || !e.target.closest) return;
        const rtBtn = e.target.closest("[data-rt-click]");
        const apiBtn = e.target.closest("[data-api-click]");
        if (rtBtn) {
          const topic = rtBtn.getAttribute("data-rt-click");
          const actionData = rtBtn.getAttribute("data-rt-payload");
          const payload = actionData ? JSON.parse(actionData) : {};
          this.publish(topic, payload);
        } else if (apiBtn) {
          const apiTarget = apiBtn.getAttribute("data-api-click");
          const actionData = apiBtn.getAttribute("data-api-payload");
          const payload = actionData ? JSON.parse(actionData) : null;
          const parts = apiTarget.trim().split(" ");
          const method = parts.length > 1 ? parts[0].toUpperCase() : "POST";
          const path = parts.length > 1 ? parts[1] : parts[0];
          try {
            const result = await this.api.request(method, path, payload);
            const resultBind = apiBtn.getAttribute("data-api-result");
            if (resultBind) this._updateDOM(resultBind, result);
            const redirect = apiBtn.getAttribute("data-api-redirect");
            if (redirect) window.location.href = redirect;
            if (apiBtn.hasAttribute("data-api-reload")) window.location.reload();
          } catch (err) {
            console.error("[Dolphin] API Click Error:", err);
          }
        }
      });
      this.subscribe("#", (payload, topic) => {
        this._updateDOM(topic, payload);
      });
      this._scanAndFetchAPIBinds();
    };
    clientProto._scanAndFetchAPIBinds = async function() {
      if (typeof document === "undefined") return;
      const elements = document.querySelectorAll("[data-api-get]");
      for (const el of Array.from(elements)) {
        const path = el.getAttribute("data-api-get");
        if (!path) continue;
        try {
          const result = await this.api.get(path);
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.value = typeof result === "object" ? result.value !== void 0 ? result.value : "" : result;
          } else {
            el.innerHTML = typeof result === "object" ? result.html || result.text || JSON.stringify(result) : result;
          }
        } catch (e) {
          console.error("[Dolphin] API Get Error:", e);
        }
      }
    };
    clientProto._updateDOM = function(topic, payload) {
      if (typeof document === "undefined") return;
      const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
      elements.forEach((el) => {
        if (el.getAttribute("data-rt-type") === "context" && typeof payload === "object" && payload !== null) {
          const processNode = (node) => {
            if (node.hasAttribute("data-rt-text")) {
              const key = node.getAttribute("data-rt-text");
              if (key && payload[key] !== void 0 && payload[key] !== null) node.textContent = payload[key];
            }
            if (node.hasAttribute("data-rt-html")) {
              const key = node.getAttribute("data-rt-html");
              if (key && payload[key] !== void 0 && payload[key] !== null) node.innerHTML = payload[key];
            }
            if (node.hasAttribute("data-rt-attr")) {
              const attrStr = node.getAttribute("data-rt-attr");
              if (attrStr) {
                attrStr.split(",").forEach((b) => {
                  const parts = b.split(":");
                  if (parts.length === 2) {
                    const attrName = parts[0].trim();
                    const key = parts[1].trim();
                    if (attrName && key && payload[key] !== void 0 && payload[key] !== null) {
                      node.setAttribute(attrName, payload[key]);
                    }
                  }
                });
              }
            }
            if (node.hasAttribute("data-rt-class")) {
              const classStr = node.getAttribute("data-rt-class");
              if (classStr) {
                classStr.split(",").forEach((b) => {
                  const parts = b.split(":");
                  if (parts.length === 2) {
                    const className = parts[0].trim();
                    const key = parts[1].trim();
                    if (payload[key]) {
                      node.classList.add(className);
                    } else {
                      node.classList.remove(className);
                    }
                  }
                });
              }
            }
            if (node.hasAttribute("data-rt-if")) {
              const key = node.getAttribute("data-rt-if");
              if (key) {
                if (payload[key]) {
                  node.style.display = "";
                } else {
                  node.style.display = "none";
                }
              }
            }
            if (node.hasAttribute("data-rt-hide")) {
              const key = node.getAttribute("data-rt-hide");
              if (key) {
                if (payload[key]) {
                  node.style.display = "none";
                } else {
                  node.style.display = "";
                }
              }
            }
          };
          processNode(el);
          el.querySelectorAll("[data-rt-text], [data-rt-html], [data-rt-attr], [data-rt-class], [data-rt-if], [data-rt-hide]").forEach(processNode);
          return;
        }
        const template = el.getAttribute("data-rt-template");
        if (template && typeof payload === "object" && payload !== null) {
          if (Array.isArray(payload)) {
            let combinedHTML = "";
            for (const item of payload) {
              let finalItemHTML = template;
              for (let key in item) {
                finalItemHTML = finalItemHTML.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), item[key] !== void 0 && item[key] !== null ? item[key] : "");
              }
              combinedHTML += finalItemHTML;
            }
            el.innerHTML = combinedHTML;
          } else {
            let finalHTML = template;
            for (let key in payload) {
              finalHTML = finalHTML.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), payload[key] !== void 0 && payload[key] !== null ? payload[key] : "");
            }
            el.innerHTML = finalHTML;
          }
          return;
        }
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.value = typeof payload === "object" ? payload.value !== void 0 ? payload.value : "" : payload;
        } else {
          el.innerHTML = typeof payload === "object" ? payload.html || payload.text || JSON.stringify(payload) : payload;
        }
      });
    };
  }

  // src/client/index.ts
  attachDOMBinding(DolphinClient.prototype);
  if (typeof window !== "undefined") {
    window.DolphinClient = DolphinClient;
    window.dolphin = new DolphinClient();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DolphinClient };
  }
  return __toCommonJS(index_exports);
})();
