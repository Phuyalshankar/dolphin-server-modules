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

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    DolphinClient: () => DolphinClient
  });

  // src/api.ts
  var APIHandler = class {
    client;
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
        const finalPath = subPath ? joined ? `${joined}/${subPath.startsWith("/") ? subPath.slice(1) : subPath}` : subPath : joined;
        return this.request(method, finalPath, body, options);
      };
      target.requestDirect = (method, path, body, options) => {
        return this.requestDirect(method, path, body, options);
      };
      target._findCSRFToken = () => this._findCSRFToken();
      target._resolveBaseUrl = (path) => this._resolveBaseUrl(path);
      target._normalizeValidationErrors = (errData) => this._normalizeValidationErrors(errData);
      const methods = [
        "get",
        "post",
        "put",
        "patch",
        "del",
        "request",
        "requestDirect",
        "_findCSRFToken",
        "_resolveBaseUrl",
        "_normalizeValidationErrors"
      ];
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
     * Attempts to find a CSRF token in the document (meta tags, forms, or cookies).
     * Works for Laravel, CakePHP, WordPress, Express, NestJS, etc.
     * @private
     */
    _findCSRFToken() {
      if (typeof document === "undefined") return null;
      const metaNames = ["csrf-token", "_csrf", "xsrf-token", "csrf_token"];
      for (const name of metaNames) {
        const metaEl = document.querySelector(`meta[name="${name}"], meta[content][name$="${name}"]`);
        if (metaEl) {
          const token = metaEl.getAttribute("content");
          if (token) return token;
        }
      }
      const inputNames = ["_csrfToken", "_token", "_csrf", "csrf_token"];
      for (const name of inputNames) {
        const inputEl = document.querySelector(`input[type="hidden"][name="${name}"]`);
        if (inputEl && inputEl.value) return inputEl.value;
      }
      const cookies = ["csrfToken", "XSRF-TOKEN", "_csrf", "csrf_token"];
      for (const name of cookies) {
        const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
        if (match) return decodeURIComponent(match[2]);
      }
      const wpNonce = typeof window !== "undefined" && window.wpApiSettings?.nonce;
      if (wpNonce) return wpNonce;
      return null;
    }
    /**
     * Dynamically resolves the Base Path/URL from `<base href="...">` or subfolders.
     * @private
     */
    _resolveBaseUrl(path) {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
      }
      let baseUrl = this.client.httpUrl;
      if (typeof document !== "undefined") {
        const baseEl = document.querySelector("base[href]");
        if (baseEl) {
          const href = baseEl.getAttribute("href") || "";
          if (href && href !== "/") {
            const cleanHref = href.endsWith("/") ? href.slice(0, -1) : href;
            baseUrl = `${this.client.httpUrl}${cleanHref.startsWith("/") ? cleanHref : "/" + cleanHref}`;
          }
        } else {
          const metaBase = document.querySelector('meta[name="base-path"]');
          if (metaBase) {
            const content = metaBase.getAttribute("content") || "";
            if (content && content !== "/") {
              const cleanContent = content.endsWith("/") ? content.slice(0, -1) : content;
              baseUrl = `${this.client.httpUrl}${cleanContent.startsWith("/") ? cleanContent : "/" + cleanContent}`;
            }
          }
        }
      }
      const cleanPath = path.startsWith("/") ? path : "/" + path;
      return `${baseUrl}${cleanPath}`;
    }
    /**
     * Normalizes backend validation errors from major PHP and Node.js frameworks
     * into a unified { [field]: message } object.
     * @private
     */
    _normalizeValidationErrors(errData) {
      const normalized = {};
      if (!errData || typeof errData !== "object") return normalized;
      const errors = errData.errors || errData.validationErrors || errData;
      if (Array.isArray(errors)) {
        for (const err of errors) {
          if (err && typeof err === "object") {
            const field = err.path || err.param || err.field || err.property;
            const msg = err.msg || err.message || err.error;
            if (field && msg) {
              normalized[field] = Array.isArray(msg) ? msg[0] : msg;
            }
          }
        }
        return normalized;
      }
      if (typeof errors === "object" && errors !== null) {
        for (const key in errors) {
          const val = errors[key];
          if (!val) continue;
          if (Array.isArray(val)) {
            if (val.length > 0) {
              normalized[key] = String(val[0]);
            }
          } else if (typeof val === "object") {
            const innerKeys = Object.keys(val);
            if (innerKeys.length > 0) {
              const firstInnerKey = innerKeys[0];
              normalized[key] = String(val[firstInnerKey]);
            }
          } else {
            normalized[key] = String(val);
          }
        }
      }
      return normalized;
    }
    /**
     * Intercept request for offline-first caching and queuing.
     */
    async request(method, path, body = null, options = {}) {
      if (this.client.offline) {
        const isOnline = this.client.offline.isOnline;
        const cacheKey = `${method.toUpperCase()}:${path}`;
        if (method.toUpperCase() === "GET") {
          if (isOnline) {
            try {
              const result = await this.requestDirect(method, path, body, options);
              await this.client.offline.setCache(cacheKey, result);
              return result;
            } catch (err) {
              const cached = await this.client.offline.getCache(cacheKey);
              if (cached !== void 0 && cached !== null) {
                return cached;
              }
              throw err;
            }
          } else {
            const cached = await this.client.offline.getCache(cacheKey);
            if (cached !== void 0 && cached !== null) {
              return cached;
            }
            throw { status: 503, data: { error: "Offline, no cache available" } };
          }
        } else {
          if (isOnline) {
            return this.requestDirect(method, path, body, options);
          } else {
            await this.client.offline.queueMutation(method, path, body);
            this.client._dispatch("offline:queued", { method, path, body });
            return { success: true, offline: true, message: "Mutation queued offline" };
          }
        }
      }
      return this.requestDirect(method, path, body, options);
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
    async requestDirect(method, path, body = null, options = {}) {
      const _isRetry = options._isRetry === true;
      let finalMethod = method.toUpperCase();
      let finalBody = body;
      const hasBody = !["GET", "HEAD"].includes(finalMethod);
      const headers = {
        ...hasBody ? { "Content-Type": "application/json" } : {},
        ...options.headers || {}
      };
      if (["PUT", "PATCH", "DELETE"].includes(finalMethod)) {
        if (this.client.options.methodSpoofing || options.methodSpoofing) {
          headers["X-HTTP-Method-Override"] = finalMethod;
          if (finalBody instanceof FormData) {
            finalBody.append("_method", finalMethod);
          } else if (finalBody && typeof finalBody === "object") {
            finalBody = {
              ...finalBody,
              _method: finalMethod
            };
          } else if (!finalBody) {
            finalBody = { _method: finalMethod };
          }
          finalMethod = "POST";
        }
      }
      const url = this._resolveBaseUrl(path);
      if (this.client.options.debug) {
        console.log(`%c\u{1F680} [Dolphin API Request]:`, "color: #3b82f6; font-weight: bold;", method.toUpperCase(), path, finalBody || "");
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.client.options.timeout
      );
      if (this.client.accessToken) {
        headers["Authorization"] = `Bearer ${this.client.accessToken}`;
      }
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
        const csrfToken = this._findCSRFToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
          headers["X-XSRF-TOKEN"] = csrfToken;
          headers["X-CSRFToken"] = csrfToken;
          headers["X-WP-Nonce"] = csrfToken;
          if (finalBody && typeof finalBody === "object") {
            if (!finalBody._csrfToken && !finalBody._token && !finalBody._csrf) {
              finalBody = {
                ...finalBody,
                _csrfToken: csrfToken,
                _token: csrfToken,
                _csrf: csrfToken
              };
            }
          }
        }
      }
      const fetchOptions = { ...options };
      delete fetchOptions._isRetry;
      delete fetchOptions.methodSpoofing;
      try {
        const response = await fetch(url, {
          method: finalMethod,
          headers,
          signal: controller.signal,
          ...finalBody ? { body: JSON.stringify(finalBody) } : {},
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
        if (this.client.options.debug) {
          console.log(`%c\u2705 [Dolphin API Success]:`, "color: #10b981; font-weight: bold;", method.toUpperCase(), path, data);
        }
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
        if (this.client.options.debug) {
          console.error(`%c\u274C [Dolphin API Error]:`, "color: #ef4444; font-weight: bold;", method.toUpperCase(), path, err);
        }
        if (err && typeof err === "object" && err.data) {
          const normErrors = this._normalizeValidationErrors(err.data);
          if (Object.keys(normErrors).length > 0) {
            for (const field in normErrors) {
              this.client.publish(`errors/${field}`, normErrors[field]);
            }
          }
        }
        if (err.name === "AbortError") {
          throw { status: 408, data: { error: "Request timed out" } };
        }
        throw err;
      }
    }
  };

  // src/auth.ts
  var AuthHandler = class {
    client;
    user;
    _refreshing;
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

  // src/store.ts
  var DolphinStore = class {
    client;
    data;
    listeners;
    subscribed;
    /** @fix: Store unsubscribe functions so destroy() can clean up WS subscriptions (was: subscriptions never removed) */
    _unsubscribers;
    /** @param {DolphinClient} client */
    constructor(client) {
      this.client = client;
      this.data = /* @__PURE__ */ new Map();
      this.listeners = /* @__PURE__ */ new Set();
      this.subscribed = /* @__PURE__ */ new Set();
      this._unsubscribers = /* @__PURE__ */ new Map();
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
          const unsubscribe = () => this.client.unsubscribe(`db:sync/${name.toLowerCase()}`, updateHandler);
          const updateHandler = (update) => {
            this._handleRemoteUpdate(name, update);
          };
          this.client.subscribe(`db:sync/${name.toLowerCase()}`, updateHandler);
          this._unsubscribers.set(name, unsubscribe);
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
    /**
     * Clean up all WebSocket subscriptions and listeners.
     * Call this when the store is no longer needed to prevent resource leaks.
     */
    destroy() {
      this._unsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch {
        }
      });
      this._unsubscribers.clear();
      this.subscribed.clear();
      this.listeners.clear();
      this.data.clear();
    }
  };

  // src/core.ts
  var DolphinClient = class {
    host;
    httpUrl;
    deviceId;
    options;
    socket;
    storage;
    accessToken;
    api;
    auth;
    store;
    handlers;
    signalHandlers;
    fileHandlers;
    _offlineQueue;
    reconnectAttempts;
    /** @fix: Store timer ID so disconnect() can cancel pending reconnects (was: memory/logic leak) */
    _reconnectTimer;
    _attachedListeners;
    constructor(url = "", deviceId = "", options = {}) {
      if (!url && typeof window !== "undefined") url = window.location.host;
      let protocol = "http:";
      if (url.startsWith("https://")) protocol = "https:";
      else if (url.startsWith("http://")) protocol = "http:";
      else if (typeof window !== "undefined") protocol = window.location.protocol;
      this.host = (url || "localhost").replace(/\/$/, "").replace(/^https?:\/\//, "");
      this.httpUrl = `${protocol}//${this.host}`;
      this.deviceId = deviceId || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? "web_" + crypto.randomUUID().replace(/-/g, "").slice(0, 8) : "web_" + Math.random().toString(36).slice(2, 10));
      this.options = {
        timeout: 15e3,
        chunkSize: 65536,
        // 64 KB
        maxReconnect: 5,
        autoRefreshToken: true,
        debug: false,
        methodSpoofing: false,
        routerViewport: "main, #viewport, body",
        routerTransitions: true,
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
      this._reconnectTimer = null;
      this._attachedListeners = [];
      if (typeof window !== "undefined" && typeof this._initDOMBinding === "function") {
        this._initDOMBinding();
      }
      if (typeof this._initOffline === "function") {
        this._initOffline();
      }
      if (typeof this._initA11y === "function") {
        this._initA11y();
      }
      if (typeof this._initI18n === "function") {
        this._initI18n();
      }
      if (typeof this._initDragDrop === "function") {
        this._initDragDrop();
      }
      if (typeof this._initCollab === "function") {
        this._initCollab();
      }
    }
    /** Save or clear the access token */
    setToken(token) {
      this.accessToken = token;
      token ? this.storage.setItem("dolphin_token", token) : this.storage.removeItem("dolphin_token");
    }
    // ── WebSocket ─────────────────────────────────────────────────────────────
    /** Connect to the Dolphin realtime server */
    async connect() {
      if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        return Promise.resolve();
      }
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
      if (this._reconnectTimer !== null) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      if (this.socket) {
        this.socket.onclose = null;
        this.socket.close();
        this.socket = null;
      }
      if (typeof this._collabCleanup === "function") {
        this._collabCleanup();
      }
      this.cleanupDomListeners();
    }
    /** @private */
    _handleMessage(data) {
      try {
        const msg = JSON.parse(data);
        if (this.options.debug) {
          console.log("%c\u{1F4E5} [Dolphin WS Incoming]:", "color: #eab308; font-weight: bold;", msg);
        }
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
      if (this.options.debug) {
        console.log("%c\u{1F4E4} [Dolphin WS Outgoing]:", "color: #8b5cf6; font-weight: bold;", msg);
      }
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
        this._reconnectTimer = setTimeout(() => {
          this._reconnectTimer = null;
          this.connect().catch(() => {
          });
        }, delay);
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
    addDomListener(target, event, cb) {
      if (!target) return;
      target.addEventListener(event, cb);
      this._attachedListeners = this._attachedListeners || [];
      this._attachedListeners.push({ target, event, cb });
    }
    cleanupDomListeners() {
      if (this._attachedListeners) {
        this._attachedListeners.forEach(({ target, event, cb }) => {
          try {
            target.removeEventListener(event, cb);
          } catch {
          }
        });
        this._attachedListeners = [];
      }
    }
  };

  // src/dom.ts
  function attachDOMBinding(clientProto) {
    const componentPromiseCache = /* @__PURE__ */ new Map();
    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function evaluateExpression(expr, ctx) {
      if (!ctx || typeof ctx !== "object") return void 0;
      try {
        const safeCtx = new Proxy(ctx, {
          has(target, prop) {
            return true;
          },
          get(target, prop) {
            if (typeof prop === "string") {
              if (prop in target) return target[prop];
              if (typeof globalThis !== "undefined" && prop in globalThis) return globalThis[prop];
              if (typeof window !== "undefined" && prop in window) return window[prop];
            }
            return void 0;
          }
        });
        const fn = new Function("ctx", `with(ctx) { return (${expr}); }`);
        return fn(safeCtx);
      } catch {
        return ctx[expr];
      }
    }
    function splitByUnquotedChar(str, char) {
      const parts = [];
      let current = "";
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inBacktick = false;
      let depth = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'" && !inDoubleQuote && !inBacktick) {
          inSingleQuote = !inSingleQuote;
        } else if (c === '"' && !inSingleQuote && !inBacktick) {
          inDoubleQuote = !inDoubleQuote;
        } else if (c === "`" && !inSingleQuote && !inDoubleQuote) {
          inBacktick = !inBacktick;
        } else if (c === "(" || c === "[" || c === "{") {
          if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth++;
        } else if (c === ")" || c === "]" || c === "}") {
          if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth--;
        }
        if (c === char && !inSingleQuote && !inDoubleQuote && !inBacktick && depth === 0) {
          parts.push(current);
          current = "";
        } else {
          current += c;
        }
      }
      parts.push(current);
      return parts;
    }
    function splitFirstUnquotedColon(str) {
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inBacktick = false;
      let depth = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'" && !inDoubleQuote && !inBacktick) {
          inSingleQuote = !inSingleQuote;
        } else if (c === '"' && !inSingleQuote && !inBacktick) {
          inDoubleQuote = !inDoubleQuote;
        } else if (c === "`" && !inSingleQuote && !inDoubleQuote) {
          inBacktick = !inBacktick;
        } else if (c === "(" || c === "[" || c === "{") {
          if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth++;
        } else if (c === ")" || c === "]" || c === "}") {
          if (!inSingleQuote && !inDoubleQuote && !inBacktick) depth--;
        }
        if (c === ":" && !inSingleQuote && !inDoubleQuote && !inBacktick && depth === 0) {
          return [str.slice(0, i), str.slice(i + 1)];
        }
      }
      return null;
    }
    function resolveTemplate(el) {
      const template = el.getAttribute("data-rt-template");
      if (!template) return null;
      if (typeof document !== "undefined" && !template.includes("<")) {
        try {
          const tempEl = document.querySelector(template);
          if (tempEl) return tempEl.innerHTML;
        } catch {
        }
      }
      return template;
    }
    function renderTemplate(templateStr, context) {
      if (!templateStr.includes("{#if") && !templateStr.includes("{#each")) {
        let result = templateStr;
        for (let key in context) {
          const escapedKey = key.replace(/[.*+?^$${}()|[\]\\]/g, "\\$&");
          result = result.replace(new RegExp("\\{\\{" + escapedKey + "\\}}", "g"), context[key] !== void 0 && context[key] !== null ? context[key] : "");
        }
        result = result.replace(/\{\{([\s\S]*?)\}\}/g, (match, expr) => {
          const trimmed = expr.trim();
          if (!trimmed) return "";
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\??\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/.test(trimmed)) {
            const parts = trimmed.split(/\??\./);
            let val = context;
            for (const part of parts) {
              if (val === void 0 || val === null) {
                val = void 0;
                break;
              }
              val = val[part];
            }
            return val !== void 0 && val !== null ? val : "";
          }
          return match;
        });
        return result;
      }
      try {
        const escapeString = (str) => {
          return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
        };
        let compiled = 'let out = "";\n';
        let lastIndex = 0;
        const regex = /(\{\{([\s\S]*?)\}\}|\{#if\s+([\s\S]*?)\}|\{:else\s+if\s+([\s\S]*?)\}|\{:else\}|\{\/if\}|\{#each\s+([\s\S]*?)\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*))?\}|\{\/each\}|\{([^{}]+?)\})/g;
        const eachStack = [];
        let match;
        while ((match = regex.exec(templateStr)) !== null) {
          const plainText = templateStr.slice(lastIndex, match.index);
          if (plainText) {
            compiled += `out += "${escapeString(plainText)}";
`;
          }
          const token = match[0];
          if (token.startsWith("{{")) {
            const expr = match[2];
            compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");
`;
          } else if (token.startsWith("{#if")) {
            const expr = match[3];
            compiled += `if (${expr}) {
`;
          } else if (token.startsWith("{:else if")) {
            const expr = match[4];
            compiled += `} else if (${expr}) {
`;
          } else if (token.startsWith("{:else}")) {
            compiled += `} else {
`;
          } else if (token.startsWith("{/if}")) {
            compiled += `}
`;
          } else if (token.startsWith("{#each")) {
            const expr = match[5];
            const itemVar = match[6];
            const indexVar = match[7];
            eachStack.push({ indexVar });
            compiled += `if (typeof ${expr} !== "undefined" && ${expr} !== null && Array.isArray(${expr})) {
`;
            if (indexVar) {
              compiled += `  let ${indexVar} = 0;
`;
            }
            compiled += `  for (let ${itemVar} of ${expr}) {
`;
          } else if (token.startsWith("{/each}")) {
            const info = eachStack.pop();
            if (info && info.indexVar) {
              compiled += `    ${info.indexVar}++;
`;
            }
            compiled += `  }
}
`;
          } else if (token.startsWith("{")) {
            const expr = match[8];
            if (expr) {
              compiled += `out += (${expr} !== undefined && ${expr} !== null ? ${expr} : "");
`;
            }
          }
          lastIndex = regex.lastIndex;
        }
        const remaining = templateStr.slice(lastIndex);
        if (remaining) {
          compiled += `out += "${escapeString(remaining)}";
`;
        }
        compiled += "return out;\n";
        const fnBody = `
                with (context) {
                    try {
                        ${compiled}
                    } catch (innerErr) {
                        console.warn('[Dolphin Template Eval Warning]:', innerErr);
                        return '';
                    }
                }
            `;
        let safeContext = context;
        if (typeof Proxy !== "undefined" && context !== null && typeof context === "object") {
          safeContext = new Proxy(context, {
            has(target, key) {
              if (typeof key === "symbol") return false;
              return true;
            },
            get(target, key) {
              if (key === Symbol.unscopables) return void 0;
              if (key in target) return target[key];
              if (typeof globalThis !== "undefined" && key in globalThis) {
                return globalThis[key];
              }
              if (typeof window !== "undefined" && key in window) {
                return window[key];
              }
              return void 0;
            }
          });
        }
        const fn = new Function("context", fnBody);
        return fn(safeContext);
      } catch (e) {
        console.error("[Dolphin Template Compiler Error]:", e);
        let fallback = templateStr;
        for (let key in context) {
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          fallback = fallback.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g"), context[key] !== void 0 && context[key] !== null ? context[key] : "");
        }
        return fallback;
      }
    }
    function sanitizeHTML(html) {
      if (typeof document === "undefined") return html;
      try {
        const parser = new DOMParser();
        const hasBodyOrHtml = /<\s*(?:body|html)\b/i.test(html);
        const parseString = hasBodyOrHtml ? html : `<body>${html}</body>`;
        const doc = parser.parseFromString(parseString, "text/html");
        const body = doc.body;
        const sanitizeNode = (el) => {
          const tag = el.tagName.toLowerCase();
          if (["script", "iframe", "object", "embed", "link", "style", "meta", "applet", "svg"].includes(tag)) {
            el.parentNode?.removeChild(el);
            return;
          }
          const attrs = el.attributes;
          for (let i = attrs.length - 1; i >= 0; i--) {
            const attrName = attrs[i].name.toLowerCase();
            const attrVal = attrs[i].value.toLowerCase();
            if (attrName.startsWith("on")) {
              el.removeAttribute(attrs[i].name);
            } else if (["src", "href", "data"].includes(attrName) && (attrVal.includes("javascript:") || attrVal.includes("data:text/html"))) {
              el.removeAttribute(attrs[i].name);
            }
          }
          Array.from(el.children).forEach(sanitizeNode);
        };
        Array.from(body.children).forEach(sanitizeNode);
        return body.innerHTML;
      } catch {
        return html;
      }
    }
    function diffDOM(existingNode, newNode) {
      if (existingNode.nodeType !== newNode.nodeType) {
        existingNode.parentNode?.replaceChild(newNode.cloneNode(true), existingNode);
        return;
      }
      if (existingNode.nodeType === Node.TEXT_NODE) {
        if (existingNode.textContent !== newNode.textContent) {
          existingNode.textContent = newNode.textContent;
        }
        return;
      }
      if (existingNode.nodeType === Node.ELEMENT_NODE) {
        const el1 = existingNode;
        const el2 = newNode;
        if (el1.tagName !== el2.tagName) {
          el1.parentNode?.replaceChild(el2.cloneNode(true), el1);
          return;
        }
        const attr1 = el1.attributes;
        const attr2 = el2.attributes;
        for (let i = attr1.length - 1; i >= 0; i--) {
          const name = attr1[i].name;
          if (!el2.hasAttribute(name)) el1.removeAttribute(name);
        }
        for (let i = 0; i < attr2.length; i++) {
          const name = attr2[i].name;
          const val = attr2[i].value;
          if (el1.getAttribute(name) !== val) el1.setAttribute(name, val);
        }
        if (el1.tagName === "INPUT" || el1.tagName === "TEXTAREA") {
          if (el1.value !== el2.value) el1.value = el2.value;
          if (el1.checked !== el2.checked) el1.checked = el2.checked;
        } else if (el1.tagName === "SELECT") {
          if (el1.value !== el2.value) el1.value = el2.value;
        }
        const childs1 = Array.from(el1.childNodes);
        const childs2 = Array.from(el2.childNodes);
        const len1 = childs1.length;
        const len2 = childs2.length;
        const maxLen = Math.max(len1, len2);
        for (let i = 0; i < maxLen; i++) {
          if (i >= len1) {
            el1.appendChild(childs2[i].cloneNode(true));
          } else if (i >= len2) {
            el1.removeChild(childs1[i]);
          } else {
            diffDOM(childs1[i], childs2[i]);
          }
        }
      }
    }
    function patchDOM(parentElement, newHTML) {
      if (typeof document === "undefined") return;
      const temp = document.createElement(parentElement.tagName);
      temp.innerHTML = newHTML;
      const childs1 = Array.from(parentElement.childNodes);
      const childs2 = Array.from(temp.childNodes);
      const len1 = childs1.length;
      const len2 = childs2.length;
      const maxLen = Math.max(len1, len2);
      for (let i = 0; i < maxLen; i++) {
        if (i >= len1) {
          parentElement.appendChild(childs2[i].cloneNode(true));
        } else if (i >= len2) {
          parentElement.removeChild(childs1[i]);
        } else {
          diffDOM(childs1[i], childs2[i]);
        }
      }
    }
    const pendingUpdates = /* @__PURE__ */ new Map();
    let rafScheduled = false;
    function scheduleDOMUpdate(element, newHTML) {
      pendingUpdates.set(element, newHTML);
      if (!rafScheduled) {
        rafScheduled = true;
        const scheduleFn = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
        scheduleFn(() => {
          pendingUpdates.forEach((html, el) => {
            if (el.isConnected !== false) {
              patchDOM(el, html);
            }
          });
          pendingUpdates.clear();
          rafScheduled = false;
        });
      }
    }
    clientProto.setStoreState = function(storeName, key, val, originEl) {
      this.uiStores = this.uiStores || /* @__PURE__ */ new Map();
      if (!this.uiStores.has(storeName)) {
        this.uiStores.set(storeName, {});
      }
      const store = this.uiStores.get(storeName);
      store[key] = val;
      if (this.options.debug) {
        console.log(`%c\u{1F4BE} [Dolphin Store Update]:`, "color: #ec4899; font-weight: bold;", `${storeName}.${key}`, "=", val);
      }
      if (typeof document !== "undefined") {
        const readElements = document.querySelectorAll(`[data-store-read="${storeName}.${key}"]`);
        readElements.forEach((el) => {
          if (el === originEl) return;
          if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            if (el.type === "checkbox") {
              el.checked = !!val;
            } else {
              el.value = val !== void 0 && val !== null ? val : "";
            }
          } else {
            el.textContent = val !== void 0 && val !== null ? val : "";
          }
        });
      }
      this.publish(`store/${storeName}`, store);
      if (typeof this._updateDOM === "function") {
        this._updateDOM(`store/${storeName}`, store);
      }
    };
    clientProto.getStoreState = function(storeName, key) {
      this.uiStores = this.uiStores || /* @__PURE__ */ new Map();
      const store = this.uiStores.get(storeName);
      return store ? store[key] : void 0;
    };
    clientProto._scanStoreBinds = function() {
      if (typeof document === "undefined") return;
      const writeEls = document.querySelectorAll("[data-store-write]");
      writeEls.forEach((el) => {
        const writeBind = el.getAttribute("data-store-write");
        if (writeBind) {
          const parts = writeBind.split(".");
          if (parts.length === 2) {
            const storeName = parts[0];
            const key = parts[1];
            const val = el.type === "checkbox" ? el.checked : el.value;
            this.uiStores = this.uiStores || /* @__PURE__ */ new Map();
            if (!this.uiStores.has(storeName)) {
              this.uiStores.set(storeName, {});
            }
            const store = this.uiStores.get(storeName);
            if (store[key] === void 0) {
              store[key] = val;
            }
          }
        }
      });
      const readEls = document.querySelectorAll("[data-store-read]");
      readEls.forEach((el) => {
        const readBind = el.getAttribute("data-store-read");
        if (readBind) {
          const parts = readBind.split(".");
          if (parts.length === 2) {
            const storeName = parts[0];
            const key = parts[1];
            const val = this.getStoreState(storeName, key);
            if (val !== void 0 && val !== null) {
              if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                if (el.type === "checkbox") {
                  el.checked = !!val;
                } else {
                  el.value = val;
                }
              } else {
                el.textContent = val;
              }
            }
          }
        }
      });
    };
    clientProto.getClosestContext = function(element, key) {
      let current = element;
      while (current) {
        if (current._rtContext) {
          const ctx = current._rtContext;
          if (key) return ctx[key];
          return ctx;
        }
        current = current.parentElement || current.parentNode;
      }
      return null;
    };
    clientProto._executeStoreAction = function(expression, element) {
      this.uiStores = this.uiStores || /* @__PURE__ */ new Map();
      const parentCtx = element && typeof this.getClosestContext === "function" ? this.getClosestContext(element) : null;
      const context = new Proxy({}, {
        has: (target, prop) => {
          return true;
        },
        get: (target, prop) => {
          if (typeof prop === "string") {
            if (prop === "log") {
              return (arg) => {
                if (arg === void 0) {
                  const allStores = {};
                  this.uiStores.forEach((val, key) => {
                    allStores[key] = { ...val };
                  });
                  console.log(`%c\u{1F4CA} [Dolphin All UI Stores]:`, "color: #06b6d4; font-weight: bold;", allStores);
                } else if (arg && typeof arg === "object" && arg.__isStoreProxy__) {
                  const storeName = arg.__storeName__;
                  const store = this.uiStores.get(storeName);
                  console.log(`%c\u{1F4CA} [Dolphin Store: ${storeName}]:`, "color: #06b6d4; font-weight: bold;", store ? { ...store } : {});
                } else {
                  console.log(`%c\u{1F4CA} [Dolphin Log]:`, "color: #06b6d4; font-weight: bold;", arg);
                }
              };
            }
            if (parentCtx && parentCtx[prop] !== void 0) {
              return parentCtx[prop];
            }
            if (typeof globalThis !== "undefined" && prop in globalThis) {
              return globalThis[prop];
            }
            if (typeof window !== "undefined" && prop in window) {
              return window[prop];
            }
            return new Proxy({}, {
              get: (subTarget, subProp) => {
                if (subProp === "__storeName__") return prop;
                if (subProp === "__isStoreProxy__") return true;
                if (typeof subProp === "string") {
                  return this.getStoreState(prop, subProp);
                }
              },
              set: (subTarget, subProp, val) => {
                if (typeof subProp === "string") {
                  this.setStoreState(prop, subProp, val);
                  return true;
                }
                return false;
              }
            });
          }
        }
      });
      try {
        const fn = new Function("ctx", `with(ctx) { ${expression} }`);
        fn(context);
      } catch (err) {
        console.error("%c[Dolphin Store Action Error]:", "color: #ef4444; font-weight: bold;", err);
        if (element) {
          console.error("%cFailed Element:", "color: #f97316; font-weight: bold;", element);
        }
        console.error("%cFailed Expression:", "color: #3b82f6; font-style: italic;", expression);
      }
    };
    clientProto._initDOMBinding = function() {
      if (this._domInitialized) return;
      this._domInitialized = true;
      const PUSH_EVENTS = ["input", "change", "keyup", "paste", "blur"];
      const debounceTimers = /* @__PURE__ */ new WeakMap();
      PUSH_EVENTS.forEach((evtName) => {
        this.addDomListener(document, evtName, (e) => {
          if (!e.target || !e.target.getAttribute) return;
          const writeBind = e.target.getAttribute("data-store-write");
          if (writeBind) {
            const parts = writeBind.split(".");
            if (parts.length === 2) {
              const storeName = parts[0];
              const key = parts[1];
              const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
              this.setStoreState(storeName, key, val, e.target);
            }
          }
          const rules = e.target.getAttribute("data-rt-validate");
          const name = e.target.name;
          if (rules && name && typeof this.validateField === "function") {
            const form = e.target.closest("form");
            const formValues = form ? Object.fromEntries(new FormData(form).entries()) : {};
            const errorMsg = this.validateField(e.target.value, rules, formValues);
            if (errorMsg) {
              e.target.classList.add("invalid");
              this.publish(`errors/${name}`, errorMsg);
            } else {
              e.target.classList.remove("invalid");
              this.publish(`errors/${name}`, "");
            }
          }
          const topic = e.target.getAttribute("data-rt-push");
          if (topic) {
            const debounceVal = e.target.getAttribute("data-rt-debounce");
            const waitMs = debounceVal ? parseInt(debounceVal, 10) : 0;
            const triggerPush = () => {
              const payload = { name: e.target.name, value: e.target.value };
              this.pubPush(topic, payload);
            };
            if (waitMs > 0) {
              if (debounceTimers.has(e.target)) {
                clearTimeout(debounceTimers.get(e.target));
              }
              const timer = setTimeout(triggerPush, waitMs);
              debounceTimers.set(e.target, timer);
            } else {
              triggerPush();
            }
          }
        });
      });
      this.addDomListener(document, "submit", async (e) => {
        if (!e.target || !e.target.getAttribute) return;
        const rtTopic = e.target.getAttribute("data-rt-submit");
        const apiTarget = e.target.getAttribute("data-api-submit");
        if (rtTopic || apiTarget) {
          const formInputs = e.target.querySelectorAll("[name]");
          formInputs.forEach((inputEl) => {
            const name = inputEl.name;
            if (name) {
              this.publish(`errors/${name}`, "");
              inputEl.classList.remove("invalid");
            }
          });
          const validatedInputs = e.target.querySelectorAll("[data-rt-validate]");
          let formIsValid = true;
          if (validatedInputs.length > 0 && typeof this.validateField === "function") {
            const formValues = Object.fromEntries(new FormData(e.target).entries());
            validatedInputs.forEach((inputEl) => {
              const rules = inputEl.getAttribute("data-rt-validate");
              const name = inputEl.name;
              if (rules && name) {
                const errorMsg = this.validateField(inputEl.value, rules, formValues);
                if (errorMsg) {
                  formIsValid = false;
                  inputEl.classList.add("invalid");
                  this.publish(`errors/${name}`, errorMsg);
                }
              }
            });
          }
          if (!formIsValid) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          const parentCtx = this.getClosestContext(e.target) || {};
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          if (rtTopic) {
            let resolvedTopic = rtTopic;
            for (const k in parentCtx) {
              const escapedK = escapeRegExp(k);
              resolvedTopic = resolvedTopic.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, "g"), parentCtx[k] !== void 0 && parentCtx[k] !== null ? parentCtx[k] : "");
            }
            this.publish(resolvedTopic, data);
          } else if (apiTarget) {
            let resolvedTarget = apiTarget;
            for (const k in parentCtx) {
              const escapedK = escapeRegExp(k);
              resolvedTarget = resolvedTarget.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, "g"), parentCtx[k] !== void 0 && parentCtx[k] !== null ? parentCtx[k] : "");
            }
            const parts = resolvedTarget.trim().split(" ");
            let method = parts.length > 1 ? parts[0].toUpperCase() : "POST";
            const path = parts.length > 1 ? parts[1] : parts[0];
            if (data._method) {
              method = String(data._method).toUpperCase();
            }
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
      const INTERACTION_EVENTS = ["click", "change", "submit", "input", "keydown", "keyup", "dblclick", "focus", "blur", "mouseenter", "mouseleave"];
      INTERACTION_EVENTS.forEach((evtName) => {
        this.addDomListener(document, evtName, async (e) => {
          if (!e.target || !e.target.closest) return;
          const rtBtn = e.target.closest(`[data-rt-${evtName}]`);
          const apiBtn = e.target.closest(`[data-api-${evtName}]`);
          if (rtBtn) {
            if (evtName === "submit") e.preventDefault();
            const topic = rtBtn.getAttribute(`data-rt-${evtName}`);
            const actionData = rtBtn.getAttribute("data-rt-payload");
            const parentCtx = this.getClosestContext(rtBtn) || {};
            let payload = {};
            if (actionData) {
              let resolvedDataStr = actionData;
              for (const k in parentCtx) {
                const escapedK = escapeRegExp(k);
                resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, "g"), parentCtx[k] !== void 0 && parentCtx[k] !== null ? parentCtx[k] : "");
              }
              try {
                payload = JSON.parse(resolvedDataStr);
              } catch {
                payload = {};
              }
            }
            this.publish(topic, payload);
          }
          if (apiBtn) {
            if (evtName === "submit") e.preventDefault();
            const apiTarget = apiBtn.getAttribute(`data-api-${evtName}`);
            const actionData = apiBtn.getAttribute("data-api-payload");
            const parentCtx = this.getClosestContext(apiBtn) || {};
            const parts = apiTarget.trim().split(" ");
            const method = parts.length > 1 ? parts[0].toUpperCase() : "POST";
            const path = parts.length > 1 ? parts[1] : parts[0];
            let payload = null;
            if (actionData) {
              let resolvedDataStr = actionData;
              for (const k in parentCtx) {
                const escapedK = escapeRegExp(k);
                resolvedDataStr = resolvedDataStr.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, "g"), parentCtx[k] !== void 0 && parentCtx[k] !== null ? parentCtx[k] : "");
              }
              try {
                payload = JSON.parse(resolvedDataStr);
              } catch {
                payload = null;
              }
            }
            try {
              const result = await this.api.request(method, path, payload);
              const resultBind = apiBtn.getAttribute("data-api-result");
              if (resultBind) this._updateDOM(resultBind, result);
              const redirect = apiBtn.getAttribute("data-api-redirect");
              if (redirect) window.location.href = redirect;
              if (apiBtn.hasAttribute("data-api-reload")) window.location.reload();
            } catch (err) {
              console.error(`[Dolphin] API ${evtName} Error:`, err);
            }
          }
          const storeActionBtn = e.target.closest(`[data-store-${evtName}]`);
          if (storeActionBtn) {
            if (evtName === "submit") e.preventDefault();
            const expr = storeActionBtn.getAttribute(`data-store-${evtName}`);
            if (expr) {
              this._executeStoreAction(expr, storeActionBtn);
            }
          }
        });
      });
      this.subscribe("#", (payload, topic) => {
        this._updateDOM(topic, payload);
      });
      this._scanAndFetchAPIBinds();
      this._scanStoreBinds();
      this._resolveImports();
      this._initSPARouter();
    };
    clientProto._scanAndFetchAPIBinds = async function() {
      if (typeof document === "undefined") return;
      const elements = document.querySelectorAll("[data-api-get]");
      for (const el of Array.from(elements)) {
        const path = el.getAttribute("data-api-get");
        if (!path) continue;
        if (typeof el.hasAttribute === "function" && el.hasAttribute("data-api-initialized")) continue;
        if (typeof el.setAttribute === "function") {
          el.setAttribute("data-api-initialized", "true");
        }
        try {
          const result = await this.api.get(path);
          const apiStore = el.getAttribute("data-api-store");
          if (apiStore) {
            const parts = apiStore.split(".");
            if (parts.length === 2) {
              this.setStoreState(parts[0], parts[1], result);
            }
          }
          const rtBind = el.getAttribute("data-rt-bind");
          if (rtBind && !apiStore) {
            this._updateDOM(rtBind, result);
          } else if (!apiStore) {
            const template = resolveTemplate(el);
            if (template && typeof result === "object" && result !== null) {
              const processedResult = this._applyDeclarativeDirectives(el, result);
              if (Array.isArray(processedResult)) {
                let combinedHTML = "";
                for (const item of processedResult) {
                  combinedHTML += renderTemplate(template, item);
                }
                scheduleDOMUpdate(el, combinedHTML);
              } else {
                scheduleDOMUpdate(el, renderTemplate(template, processedResult));
              }
            } else {
              if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                el.value = typeof result === "object" ? result.value !== void 0 ? result.value : "" : result;
              } else {
                const rawHTML = typeof result === "object" ? result.html || result.text || JSON.stringify(result) : String(result);
                el.innerHTML = sanitizeHTML(rawHTML);
              }
            }
          }
        } catch (e) {
          console.error("[Dolphin] API Get Error:", e);
        }
      }
    };
    clientProto._applyDeclarativeDirectives = function(el, payload) {
      let processedPayload = payload;
      if (typeof payload === "object" && payload !== null) {
        const applyFilterSearchSort = (arr) => {
          let result = [...arr];
          const filterAttr = el.getAttribute("data-rt-filter");
          if (filterAttr) {
            const parts = filterAttr.split("==");
            if (parts.length === 2) {
              const itemProp = parts[0].trim();
              const storeExpr = parts[1].trim();
              let filterVal = void 0;
              const storeParts = storeExpr.split(".");
              if (storeParts.length === 2) {
                filterVal = this.getStoreState(storeParts[0], storeParts[1]);
              } else {
                filterVal = payload[storeExpr] !== void 0 ? payload[storeExpr] : this.getStoreState("app", storeExpr);
              }
              if (filterVal !== void 0 && filterVal !== null && filterVal !== "") {
                result = result.filter((item) => item[itemProp] === filterVal);
              }
            }
          }
          const searchAttr = el.getAttribute("data-rt-search");
          if (searchAttr) {
            const parts = searchAttr.split("==");
            if (parts.length === 2) {
              const itemProp = parts[0].trim();
              const storeExpr = parts[1].trim();
              let searchVal = void 0;
              const storeParts = storeExpr.split(".");
              if (storeParts.length === 2) {
                searchVal = this.getStoreState(storeParts[0], storeParts[1]);
              } else {
                searchVal = payload[storeExpr] !== void 0 ? payload[storeExpr] : this.getStoreState("app", storeExpr);
              }
              if (searchVal !== void 0 && searchVal !== null && searchVal !== "") {
                const query = String(searchVal).toLowerCase();
                result = result.filter((item) => {
                  const val = item[itemProp];
                  return val !== void 0 && val !== null && String(val).toLowerCase().includes(query);
                });
              }
            }
          }
          const sortAttr = el.getAttribute("data-rt-sort");
          if (sortAttr) {
            let sortByVal = void 0;
            const storeParts = sortAttr.split(".");
            if (storeParts.length === 2) {
              sortByVal = this.getStoreState(storeParts[0], storeParts[1]);
            } else {
              sortByVal = payload[sortAttr] !== void 0 ? payload[sortAttr] : this.getStoreState("app", sortAttr);
            }
            if (sortByVal && sortByVal !== "") {
              if (sortByVal === "popular") {
                result.sort((a, b) => {
                  const rateA = a.rating?.rate || a.rate || 0;
                  const rateB = b.rating?.rate || b.rate || 0;
                  return rateB - rateA;
                });
              } else {
                let field = "";
                let direction = "asc";
                if (sortByVal.endsWith("-low") || sortByVal.endsWith("-asc")) {
                  field = sortByVal.replace("-low", "").replace("-asc", "");
                  direction = "asc";
                } else if (sortByVal.endsWith("-high") || sortByVal.endsWith("-desc")) {
                  field = sortByVal.replace("-high", "").replace("-desc", "");
                  direction = "desc";
                }
                if (field) {
                  result.sort((a, b) => {
                    const resolveVal = (obj, path) => {
                      return path.split(".").reduce((acc, part) => acc && acc[part], obj);
                    };
                    let valA = resolveVal(a, field);
                    let valB = resolveVal(b, field);
                    if (valA === void 0) valA = a[field];
                    if (valB === void 0) valB = b[field];
                    if (typeof valA === "string" && typeof valB === "string") {
                      return direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    }
                    const numA = Number(valA);
                    const numB = Number(valB);
                    if (!isNaN(numA) && !isNaN(numB)) {
                      return direction === "asc" ? numA - numB : numB - numA;
                    }
                    return 0;
                  });
                }
              }
            }
          }
          return result;
        };
        if (Array.isArray(payload)) {
          processedPayload = applyFilterSearchSort(payload);
        } else {
          let foundArrayKey = "";
          for (const key in payload) {
            if (Array.isArray(payload[key])) {
              foundArrayKey = key;
              break;
            }
          }
          if (foundArrayKey) {
            const processedArray = applyFilterSearchSort(payload[foundArrayKey]);
            processedPayload = {
              ...payload,
              [foundArrayKey]: processedArray
            };
          }
        }
      }
      return processedPayload;
    };
    clientProto._updateDOM = function(topic, payload) {
      if (typeof document === "undefined") return;
      const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
      elements.forEach((el) => {
        const processedPayload = this._applyDeclarativeDirectives(el, payload);
        if (el.getAttribute("data-rt-type") === "context" && typeof processedPayload === "object" && processedPayload !== null) {
          el._rtContext = processedPayload;
          const processNode = (node) => {
            if (node.hasAttribute("data-rt-text")) {
              const key = node.getAttribute("data-rt-text");
              if (key) {
                const val = evaluateExpression(key, processedPayload);
                if (val !== void 0 && val !== null) node.textContent = val;
              }
            }
            if (node.hasAttribute("data-rt-html")) {
              const key = node.getAttribute("data-rt-html");
              if (key) {
                const val = evaluateExpression(key, processedPayload);
                if (val !== void 0 && val !== null) {
                  node.innerHTML = sanitizeHTML(val);
                }
              }
            }
            if (node.hasAttribute("data-rt-attr")) {
              const attrStr = node.getAttribute("data-rt-attr");
              if (attrStr) {
                splitByUnquotedChar(attrStr, ",").forEach((b) => {
                  const pair = splitFirstUnquotedColon(b);
                  if (pair) {
                    const attrName = pair[0].trim();
                    const key = pair[1].trim();
                    if (attrName && key) {
                      const val = evaluateExpression(key, processedPayload);
                      if (val !== void 0 && val !== null) {
                        node.setAttribute(attrName, val);
                      }
                    }
                  }
                });
              }
            }
            if (node.hasAttribute("data-rt-class")) {
              const classStr = node.getAttribute("data-rt-class");
              if (classStr) {
                splitByUnquotedChar(classStr, ",").forEach((b) => {
                  const pair = splitFirstUnquotedColon(b);
                  if (pair) {
                    const className = pair[0].trim();
                    const key = pair[1].trim();
                    const classNames = className.split(/\s+/).filter(Boolean);
                    if (evaluateExpression(key, processedPayload)) {
                      classNames.forEach((c) => node.classList.add(c));
                    } else {
                      classNames.forEach((c) => node.classList.remove(c));
                    }
                  }
                });
              }
            }
            if (node.hasAttribute("data-rt-if")) {
              const key = node.getAttribute("data-rt-if");
              if (key) {
                if (evaluateExpression(key, processedPayload)) {
                  node.style.display = "";
                } else {
                  node.style.display = "none";
                }
              }
            }
            if (node.hasAttribute("data-rt-hide")) {
              const key = node.getAttribute("data-rt-hide");
              if (key) {
                if (evaluateExpression(key, processedPayload)) {
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
        const template = resolveTemplate(el);
        if (template && typeof processedPayload === "object" && processedPayload !== null) {
          if (Array.isArray(processedPayload)) {
            let combinedHTML = "";
            for (const item of processedPayload) {
              combinedHTML += renderTemplate(template, item);
            }
            scheduleDOMUpdate(el, combinedHTML);
          } else {
            scheduleDOMUpdate(el, renderTemplate(template, processedPayload));
          }
          return;
        }
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.value = typeof processedPayload === "object" ? processedPayload.value !== void 0 ? processedPayload.value : "" : processedPayload;
        } else if (template) {
          el.innerHTML = typeof processedPayload === "object" ? processedPayload.html || processedPayload.text || JSON.stringify(processedPayload) : String(processedPayload);
        } else {
          const rawHTML = typeof processedPayload === "object" ? processedPayload.html || processedPayload.text || JSON.stringify(processedPayload) : String(processedPayload);
          el.innerHTML = sanitizeHTML(rawHTML);
        }
      });
    };
    clientProto._resolveImports = async function(container) {
      if (typeof document === "undefined") return;
      const root = container || document.body || document;
      if (!root || typeof root.querySelectorAll !== "function") return;
      const elements = root.querySelectorAll("[data-import]");
      if (elements.length === 0) return;
      const resolveNode = async (el, resolvingSet) => {
        const src = el.getAttribute("data-import");
        if (!src) return;
        if (resolvingSet.has(src)) {
          console.warn(`[Dolphin Component Warning]: Circular import detected for "${src}". Skipping resolving.`);
          el.innerHTML = `<span style="color:red;font-weight:bold;">Circular import: ${src}</span>`;
          return;
        }
        resolvingSet.add(src);
        const hashIndex = src.indexOf("#");
        const url = hashIndex !== -1 ? src.substring(0, hashIndex) : src;
        const selector = hashIndex !== -1 ? src.substring(hashIndex) : null;
        let promise = componentPromiseCache.get(url);
        if (!promise) {
          promise = fetch(url).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          });
          promise.catch(() => componentPromiseCache.delete(url));
          componentPromiseCache.set(url, promise);
        }
        let content = "";
        try {
          content = await promise;
          if (selector && typeof DOMParser !== "undefined") {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, "text/html");
            const targetEl = doc.querySelector(selector);
            if (targetEl) {
              content = targetEl.outerHTML;
            } else {
              console.warn(`[Dolphin Component Warning]: Selector "${selector}" not found in imported file "${url}".`);
              content = `<span style="color:orange;font-weight:bold;">Selector ${selector} not found in ${url}</span>`;
            }
          }
        } catch (err) {
          console.error(`[Dolphin Component Error]: Failed to fetch component "${url}":`, err);
          content = `<span style="color:red;font-weight:bold;">Failed to import ${url}</span>`;
        }
        el.innerHTML = sanitizeHTML(content);
        el.removeAttribute("data-import");
        const nestedElements = el.querySelectorAll("[data-import]");
        if (nestedElements.length > 0) {
          const subPromises = Array.from(nestedElements).map((child) => resolveNode(child, new Set(resolvingSet)));
          await Promise.all(subPromises);
        }
        this._scanStoreBinds();
        this._scanAndFetchAPIBinds();
      };
      const promises = Array.from(elements).map((el) => resolveNode(el, /* @__PURE__ */ new Set()));
      await Promise.all(promises);
    };
    clientProto._initSPARouter = function() {
      if (typeof window === "undefined" || typeof document === "undefined") return;
      if (this._routerInitialized) return;
      this._routerInitialized = true;
      let _spaAbortController = null;
      const findViewport = () => {
        const selector = this.options.routerViewport || "main, #viewport, body";
        const selectors = selector.split(",").map((s) => s.trim());
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        return document.body;
      };
      const loadPage = async (url, pushState = true) => {
        try {
          if (this.options.debug) {
            console.log(`%c\u{1F6E3}\uFE0F [Dolphin Router]: Navigating to ${url}...`, "color: #3b82f6; font-weight: bold;");
          }
          if (_spaAbortController) {
            _spaAbortController.abort();
          }
          _spaAbortController = new AbortController();
          const signal = _spaAbortController.signal;
          const viewport = findViewport();
          if (this.options.routerTransitions && viewport) {
            viewport.classList.add("dolphin-fade-out");
            await new Promise((r) => setTimeout(r, 150));
          }
          const response = await fetch(url, { signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const html = await response.text();
          _spaAbortController = null;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          if (doc.title) {
            document.title = doc.title;
          }
          const newViewport = doc.querySelector(this.options.routerViewport || "main, #viewport, body");
          const currentViewport = findViewport();
          if (newViewport && currentViewport) {
            currentViewport.innerHTML = newViewport.innerHTML;
            Array.from(newViewport.attributes).forEach((attr) => {
              currentViewport.setAttribute(attr.name, attr.value);
            });
          } else if (currentViewport) {
            currentViewport.innerHTML = doc.body.innerHTML;
          }
          if (pushState) {
            window.history.pushState({ dolphinSpa: true, url }, "", url);
          }
          if (this.options.routerTransitions && currentViewport) {
            currentViewport.classList.remove("dolphin-fade-out");
            currentViewport.classList.add("dolphin-fade-in");
            setTimeout(() => currentViewport.classList.remove("dolphin-fade-in"), 300);
          }
          await this._resolveImports(currentViewport);
          this._scanStoreBinds();
          this._scanAndFetchAPIBinds();
        } catch (err) {
          if (err && err.name === "AbortError") return;
          console.error("[Dolphin Router Error]: Failed to route page:", err);
          window.location.href = url;
        }
      };
      this.addDomListener(document, "click", (e) => {
        const anchor = e.target.closest("a");
        if (!anchor) return;
        if (!anchor.hasAttribute("data-spa") && anchor.getAttribute("data-spa") !== "true") return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        e.preventDefault();
        loadPage(href);
      });
      this.addDomListener(window, "popstate", (e) => {
        if (e.state && e.state.dolphinSpa) {
          loadPage(e.state.url, false);
        } else if (e.state === null) {
          loadPage(window.location.pathname, false);
        }
      });
      if (this.options.routerTransitions) {
        const style = document.createElement("style");
        style.innerHTML = `
                .dolphin-fade-out {
                    opacity: 0;
                    transition: opacity 0.15s ease-in-out;
                }
                .dolphin-fade-in {
                    opacity: 0;
                }
                main, #viewport, body {
                    transition: opacity 0.15s ease-in-out;
                }
            `;
        document.head.appendChild(style);
      }
    };
  }

  // src/offline.ts
  var DolphinOffline = class {
    client;
    db;
    isOnline;
    memoryCache = /* @__PURE__ */ new Map();
    memoryMutations = [];
    constructor(client) {
      this.client = client;
      this.isOnline = typeof window !== "undefined" && typeof navigator !== "undefined" ? navigator.onLine : true;
      this.initDB();
      this.setupNetworkListeners();
    }
    initDB() {
      if (typeof indexedDB === "undefined") return;
      try {
        const request = indexedDB.open("dolphin_offline", 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("cache")) {
            db.createObjectStore("cache");
          }
          if (!db.objectStoreNames.contains("mutations")) {
            db.createObjectStore("mutations", { keyPath: "id", autoIncrement: true });
          }
        };
        request.onsuccess = (e) => {
          this.db = e.target.result;
          if (this.isOnline) {
            this.syncMutations();
          }
        };
      } catch (err) {
        console.warn("[Dolphin Offline] Failed to initialize IndexedDB:", err);
      }
    }
    setupNetworkListeners() {
      if (typeof window === "undefined") return;
      this.client.addDomListener(window, "online", () => {
        this.isOnline = true;
        this.client._dispatch("network:status", { online: true });
        this.syncMutations();
      });
      this.client.addDomListener(window, "offline", () => {
        this.isOnline = false;
        this.client._dispatch("network:status", { online: false });
      });
    }
    async getCache(key) {
      if (!this.db) {
        return this.memoryCache.get(key);
      }
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction("cache", "readonly");
          const store = transaction.objectStore("cache");
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.data : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    async setCache(key, data) {
      if (!this.db) {
        this.memoryCache.set(key, data);
        return;
      }
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction("cache", "readwrite");
          const store = transaction.objectStore("cache");
          store.put({ data, timestamp: Date.now() }, key);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            console.warn("[Dolphin Offline] setCache write failed for key:", key);
            resolve();
          };
        } catch {
          resolve();
        }
      });
    }
    async queueMutation(method, path, payload) {
      const mutation = {
        method,
        path,
        payload,
        timestamp: Date.now()
      };
      if (!this.db) {
        this.memoryMutations.push(mutation);
        return;
      }
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction("mutations", "readwrite");
          const store = transaction.objectStore("mutations");
          store.add(mutation);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            console.warn("[Dolphin Offline] queueMutation write failed:", method, path);
            this.memoryMutations.push(mutation);
            resolve();
          };
        } catch {
          resolve();
        }
      });
    }
    async getMutations() {
      if (!this.db) {
        return [...this.memoryMutations];
      }
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction("mutations", "readonly");
          const store = transaction.objectStore("mutations");
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }
    async removeMutation(id) {
      if (!this.db) {
        this.memoryMutations = this.memoryMutations.filter((m) => m.id !== id);
        return;
      }
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction("mutations", "readwrite");
          const store = transaction.objectStore("mutations");
          store.delete(id);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            console.warn("[Dolphin Offline] removeMutation failed for id:", id);
            resolve();
          };
        } catch {
          resolve();
        }
      });
    }
    async syncMutations() {
      const mutations = await this.getMutations();
      if (mutations.length === 0) return;
      console.log(`[Dolphin Offline] Syncing ${mutations.length} queued mutations...`);
      for (const mutation of mutations) {
        try {
          await this.client.api.requestDirect(mutation.method, mutation.path, mutation.payload);
          if (mutation.id !== void 0) {
            await this.removeMutation(mutation.id);
          } else {
            this.memoryMutations.shift();
          }
        } catch (err) {
          console.error(`[Dolphin Offline] Sync failed for mutation ${mutation.method} ${mutation.path}:`, err);
          if (err && err.status && err.status >= 400 && err.status < 500) {
            console.warn("[Dolphin Offline] Discarding invalid mutation.");
            if (mutation.id !== void 0) {
              await this.removeMutation(mutation.id);
            } else {
              this.memoryMutations.shift();
            }
          } else {
            break;
          }
        }
      }
    }
  };
  function attachOffline(clientProto) {
    clientProto._initOffline = function() {
      this.offline = new DolphinOffline(this);
    };
  }

  // src/validation.ts
  function validateField(value, rulesStr, allValues) {
    const rules = rulesStr.split(",");
    for (const rule of rules) {
      const parts = rule.trim().split(":");
      const ruleName = parts[0];
      const ruleArg = parts[1];
      if (ruleName === "required") {
        if (!value || value.trim() === "") {
          return "This field is required";
        }
      } else if (ruleName === "email") {
        if (value && value.trim() !== "") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return "Please enter a valid email address";
          }
        }
      } else if (ruleName === "min") {
        const minLen = parseInt(ruleArg, 10);
        if (!value || value.length < minLen) {
          return `Must be at least ${minLen} characters`;
        }
      } else if (ruleName === "match") {
        if (allValues && value !== allValues[ruleArg]) {
          return `Must match ${ruleArg}`;
        }
      }
    }
    return null;
  }
  function attachValidation(clientProto) {
    clientProto.validateField = validateField;
  }

  // src/animation.ts
  function attachAnimations(clientProto) {
    clientProto.animateElement = function(el, animationClass, durationMs = 300) {
      if (typeof el.animate !== "function") {
        el.classList.add(animationClass);
        setTimeout(() => el.classList.remove(animationClass), durationMs);
        return;
      }
      if (animationClass === "fade-in") {
        el.animate([
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ], { duration: durationMs, easing: "ease-out" });
      } else if (animationClass === "fade-out") {
        el.animate([
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(10px)" }
        ], { duration: durationMs, easing: "ease-in" });
      }
    };
    clientProto.staggerListItems = function(container, itemSelector, delayMs = 50) {
      if (typeof document === "undefined") return;
      const items = container.querySelectorAll(itemSelector);
      items.forEach((item, idx) => {
        item.style.animationDelay = `${idx * delayMs}ms`;
        item.classList.add("staggered-item");
      });
    };
  }

  // src/a11y.ts
  function attachA11y(clientProto) {
    clientProto._initA11y = function() {
      if (typeof document === "undefined") return;
      this.addDomListener(document, "keydown", (e) => {
        if (e.key !== "Tab") return;
        const trappedContainers = document.querySelectorAll("[data-rt-a11y-focus-trap]");
        trappedContainers.forEach((container) => {
          if (container.style.display === "none" || container.hasAttribute("aria-hidden") && container.getAttribute("aria-hidden") === "true") {
            return;
          }
          const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]';
          const focusableElements = Array.from(container.querySelectorAll(focusableSelectors));
          if (focusableElements.length === 0) return;
          const firstEl = focusableElements[0];
          const lastEl = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstEl) {
              lastEl.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastEl) {
              firstEl.focus();
              e.preventDefault();
            }
          }
        });
      });
      this.addDomListener(document, "keydown", (e) => {
        if (!["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;
        const keyNavLists = document.querySelectorAll("[data-rt-keynav]");
        keyNavLists.forEach((list) => {
          const items = Array.from(list.children);
          if (items.length === 0) return;
          let activeIdx = items.findIndex((el) => el.classList.contains("active") || document.activeElement === el);
          if (e.key === "ArrowDown") {
            activeIdx = (activeIdx + 1) % items.length;
            items[activeIdx].focus();
            items.forEach((item, idx) => {
              if (idx === activeIdx) item.classList.add("active");
              else item.classList.remove("active");
            });
            e.preventDefault();
          } else if (e.key === "ArrowUp") {
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items[activeIdx].focus();
            items.forEach((item, idx) => {
              if (idx === activeIdx) item.classList.add("active");
              else item.classList.remove("active");
            });
            e.preventDefault();
          } else if (e.key === "Enter" && activeIdx !== -1) {
            items[activeIdx].click();
            e.preventDefault();
          }
        });
      });
    };
    clientProto.autoAriaModal = function(modalEl, isOpen) {
      if (isOpen) {
        modalEl.setAttribute("role", "dialog");
        modalEl.setAttribute("aria-modal", "true");
        modalEl.setAttribute("aria-hidden", "false");
        modalEl.focus();
      } else {
        modalEl.setAttribute("aria-hidden", "true");
      }
    };
  }

  // src/i18n.ts
  function attachI18n(clientProto) {
    clientProto._initI18n = function() {
      this.i18n = this.i18n || {
        locale: "en",
        dicts: {}
      };
      if (typeof document === "undefined") return;
      const dictEls = document.querySelectorAll("[data-i18n-dict]");
      dictEls.forEach((el) => {
        const locale = el.getAttribute("data-i18n-dict");
        if (locale) {
          try {
            const dictData = JSON.parse(el.textContent || "{}");
            this.i18n.dicts[locale] = {
              ...this.i18n.dicts[locale] || {},
              ...dictData
            };
          } catch (e) {
            console.warn("[Dolphin i18n] Failed to parse dictionary for locale:", locale, e);
          }
        }
      });
      if (!this.i18n.locale && typeof navigator !== "undefined") {
        const browserLang = navigator.language.split("-")[0];
        if (this.i18n.dicts[browserLang]) {
          this.i18n.locale = browserLang;
        }
      }
      this.addDomListener(document, "click", (e) => {
        const switcher = e.target.closest("[data-i18n-switch]");
        if (switcher) {
          const newLocale = switcher.getAttribute("data-i18n-switch");
          if (newLocale) {
            this.setLocale(newLocale);
          }
        }
      });
      this.translateDOM();
    };
    clientProto.setLocale = function(locale) {
      this.i18n = this.i18n || { locale: "en", dicts: {} };
      this.i18n.locale = locale;
      this.translateDOM();
      this.publish("i18n/locale", locale);
    };
    clientProto.translateDOM = function() {
      if (typeof document === "undefined") return;
      this.i18n = this.i18n || { locale: "en", dicts: {} };
      const currentLocale = this.i18n.locale || "en";
      const dict = this.i18n.dicts[currentLocale] || {};
      const translateEls = document.querySelectorAll("[data-i18n-key]");
      translateEls.forEach((el) => {
        const key = el.getAttribute("data-i18n-key");
        if (!key) return;
        let translation = key.split(".").reduce((o, i) => o ? o[i] : null, dict);
        if (translation === void 0 || translation === null) {
          translation = key;
        }
        const paramsAttr = el.getAttribute("data-i18n-params");
        if (paramsAttr) {
          try {
            const params = JSON.parse(paramsAttr);
            const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            for (const k in params) {
              const escapedK = escapeRegExp(k);
              translation = translation.replace(new RegExp(`\\{\\{${escapedK}\\}\\}`, "g"), params[k]);
            }
          } catch {
          }
        }
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = translation;
        } else {
          el.textContent = translation;
        }
      });
    };
  }

  // src/dragdrop.ts
  function attachDragDrop(clientProto) {
    clientProto._initDragDrop = function() {
      if (typeof document === "undefined") return;
      this.addDomListener(document, "dragstart", (e) => {
        const dragEl = e.target.closest("[data-drag]");
        if (!dragEl) return;
        const payloadStr = dragEl.getAttribute("data-drag");
        if (payloadStr) {
          e.dataTransfer.setData("text/plain", payloadStr);
          e.dataTransfer.effectAllowed = "move";
          dragEl.classList.add("dragging");
        }
      });
      this.addDomListener(document, "dragend", (e) => {
        const dragEl = e.target.closest("[data-drag]");
        if (dragEl) {
          dragEl.classList.remove("dragging");
        }
      });
      this.addDomListener(document, "dragover", (e) => {
        const dropZone = e.target.closest("[data-drop]");
        if (dropZone) {
          e.preventDefault();
          dropZone.classList.add("drag-over");
        }
      });
      this.addDomListener(document, "dragleave", (e) => {
        const dropZone = e.target.closest("[data-drop]");
        if (dropZone) {
          dropZone.classList.remove("drag-over");
        }
      });
      this.addDomListener(document, "drop", (e) => {
        const dropZone = e.target.closest("[data-drop]");
        if (!dropZone) return;
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const topic = dropZone.getAttribute("data-drop");
        const dataStr = e.dataTransfer.getData("text/plain");
        if (topic && dataStr) {
          try {
            const payload = JSON.parse(dataStr);
            this.publish(topic, payload);
          } catch {
            this.publish(topic, { value: dataStr });
          }
        }
      });
      this.addDomListener(document, "dragover", (e) => {
        const sortableContainer = e.target.closest("[data-sortable]");
        if (!sortableContainer) return;
        e.preventDefault();
        const draggingEl = sortableContainer.querySelector(".dragging");
        if (!draggingEl) return;
        const siblings = Array.from(sortableContainer.querySelectorAll("[data-drag]:not(.dragging)"));
        const nextSibling = siblings.find((sibling) => {
          const box = sibling.getBoundingClientRect();
          const offset = e.clientY - box.top - box.height / 2;
          return offset < 0;
        });
        if (nextSibling) {
          sortableContainer.insertBefore(draggingEl, nextSibling);
        } else {
          sortableContainer.appendChild(draggingEl);
        }
      });
      this.addDomListener(document, "drop", (e) => {
        const sortableContainer = e.target.closest("[data-sortable]");
        if (!sortableContainer) return;
        const topic = sortableContainer.getAttribute("data-sortable");
        if (!topic) return;
        const elements = Array.from(sortableContainer.querySelectorAll("[data-drag]"));
        const newOrder = elements.map((el, index) => {
          const payloadStr = el.getAttribute("data-drag");
          try {
            return { index, payload: JSON.parse(payloadStr || "{}") };
          } catch {
            return { index, payload: payloadStr };
          }
        });
        this.publish(topic, newOrder);
      });
    };
  }

  // src/collab.ts
  function attachCollab(clientProto) {
    clientProto._initCollab = function() {
      if (typeof document === "undefined") return;
      const remoteCursors = /* @__PURE__ */ new Map();
      const cursorStaleTimers = /* @__PURE__ */ new Map();
      const CURSOR_STALE_MS = 5e3;
      this.addDomListener(document, "mousemove", (e) => {
        const shareContainers = document.querySelectorAll("[data-rt-cursor-share]");
        shareContainers.forEach((container) => {
          const room = container.getAttribute("data-rt-cursor-share");
          if (!room) return;
          const box = container.getBoundingClientRect();
          const xRatio = (e.clientX - box.left) / box.width;
          const yRatio = (e.clientY - box.top) / box.height;
          const now = Date.now();
          if (!container._lastSent || now - container._lastSent > 50) {
            container._lastSent = now;
            this.pubPush(`collab/${room}/cursor/${this.deviceId}`, {
              deviceId: this.deviceId,
              x: xRatio,
              y: yRatio
            });
          }
        });
      });
      this.addDomListener(document, "input", (e) => {
        const typingBind = e.target.getAttribute("data-rt-typing");
        if (!typingBind) return;
        const room = typingBind;
        const publishTyping = (isTyping) => {
          this.pubPush(`collab/${room}/typing/${this.deviceId}`, {
            deviceId: this.deviceId,
            typing: isTyping
          });
        };
        if (!e.target._isTyping) {
          e.target._isTyping = true;
          publishTyping(true);
        }
        if (e.target._typingTimer) clearTimeout(e.target._typingTimer);
        e.target._typingTimer = setTimeout(() => {
          e.target._isTyping = false;
          e.target._typingTimer = null;
          publishTyping(false);
        }, 2e3);
      });
      this.addDomListener(document, "input", (e) => {
        const crdtBind = e.target.getAttribute("data-rt-crdt");
        if (!crdtBind) return;
        const docName = crdtBind;
        const value = e.target.value;
        const now = Date.now();
        this.publish(`collab/${docName}/crdt`, {
          deviceId: this.deviceId,
          value,
          timestamp: now,
          cursorPos: e.target.selectionStart
        });
      });
      this.subscribe("collab/+/cursor/+", (payload, topic) => {
        const parts = topic.split("/");
        const room = parts[1];
        const remoteDeviceId = parts[3];
        if (remoteDeviceId === this.deviceId) return;
        const container = document.querySelector(`[data-rt-cursor-share="${room}"]`);
        if (!container) return;
        const cursorKey = `${room}::${remoteDeviceId}`;
        let cursorEl = remoteCursors.get(cursorKey);
        if (!cursorEl || !document.contains(cursorEl)) {
          cursorEl = document.createElement("div");
          cursorEl.className = `rt-cursor rt-cursor-${remoteDeviceId}`;
          cursorEl.style.position = "absolute";
          cursorEl.style.width = "10px";
          cursorEl.style.height = "10px";
          cursorEl.style.borderRadius = "50%";
          cursorEl.style.backgroundColor = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
          cursorEl.style.pointerEvents = "none";
          container.appendChild(cursorEl);
          remoteCursors.set(cursorKey, cursorEl);
        }
        const box = container.getBoundingClientRect();
        cursorEl.style.left = payload.x * box.width + "px";
        cursorEl.style.top = payload.y * box.height + "px";
        if (cursorStaleTimers.has(cursorKey)) {
          clearTimeout(cursorStaleTimers.get(cursorKey));
        }
        cursorStaleTimers.set(cursorKey, setTimeout(() => {
          const el = remoteCursors.get(cursorKey);
          if (el && el.parentNode) el.parentNode.removeChild(el);
          remoteCursors.delete(cursorKey);
          cursorStaleTimers.delete(cursorKey);
        }, CURSOR_STALE_MS));
      });
      this.subscribe("collab/+/crdt", (payload, topic) => {
        if (payload.deviceId === this.deviceId) return;
        const parts = topic.split("/");
        const docName = parts[1];
        const crdtInputs = document.querySelectorAll(`[data-rt-crdt="${docName}"]`);
        crdtInputs.forEach((input) => {
          if (!input._lastUpdate || payload.timestamp > input._lastUpdate) {
            input._lastUpdate = payload.timestamp;
            const originalPos = input.selectionStart;
            input.value = payload.value;
            if (document.activeElement === input) {
              input.setSelectionRange(originalPos, originalPos);
            }
          }
        });
      });
      this._collabCleanup = () => {
        cursorStaleTimers.forEach((t) => clearTimeout(t));
        cursorStaleTimers.clear();
        remoteCursors.forEach((el) => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        remoteCursors.clear();
      };
    };
  }

  // src/pwa.ts
  function attachPwa(clientProto) {
    clientProto.registerServiceWorker = async function(swPath = "/sw.js") {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        console.warn("[Dolphin PWA] Service Workers are not supported in this browser.");
        return null;
      }
      try {
        const registration = await navigator.serviceWorker.register(swPath);
        console.log("[Dolphin PWA] Service Worker registered successfully with scope:", registration.scope);
        return registration;
      } catch (e) {
        console.error("[Dolphin PWA] Service Worker registration failed:", e);
        return null;
      }
    };
    clientProto.subscribePushNotifications = async function(vapidPublicKey) {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("[Dolphin PWA] Push notifications are not supported in this browser.");
        return null;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const padding = "=".repeat((4 - vapidPublicKey.length % 4) % 4);
          const base64 = (vapidPublicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: outputArray
          });
        }
        console.log("[Dolphin PWA] Subscribed to push notifications:", subscription);
        return subscription;
      } catch (e) {
        console.error("[Dolphin PWA] Push notification subscription failed:", e);
        return null;
      }
    };
  }

  // src/testing.ts
  var DolphinTestUtils = class {
    static render(html) {
      if (typeof document === "undefined") {
        throw new Error("DolphinTestUtils.render requires a DOM document environment to execute.");
      }
      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.appendChild(container);
      return {
        container,
        find: (sel) => container.querySelector(sel),
        fireEvent: (el, eventType) => {
          const evt = document.createEvent("Event");
          evt.initEvent(eventType, true, true);
          el.dispatchEvent(evt);
        }
      };
    }
    static mockWebSocket() {
      const sentMessages = [];
      const mockWS = {
        readyState: 1,
        // OPEN
        send: (data) => {
          sentMessages.push(data);
        },
        close: jest.fn(),
        onopen: jest.fn(),
        onmessage: jest.fn(),
        onclose: jest.fn(),
        onerror: jest.fn(),
        sentMessages
      };
      global.WebSocket = class {
        static OPEN = 1;
        readyState = mockWS.readyState;
        send = mockWS.send;
        close = mockWS.close;
        set onopen(v) {
          mockWS.onopen = v;
        }
        get onopen() {
          return mockWS.onopen;
        }
        set onmessage(v) {
          mockWS.onmessage = v;
        }
        get onmessage() {
          return mockWS.onmessage;
        }
        set onclose(v) {
          mockWS.onclose = v;
        }
        get getonclose() {
          return mockWS.onclose;
        }
        constructor() {
          setTimeout(() => mockWS.onopen && mockWS.onopen(), 0);
        }
      };
      return mockWS;
    }
    static simulateClick(el) {
      const clickEvt = {
        target: el,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      const clickListeners = global.document._listeners?.["click"] || [];
      clickListeners.forEach((listener) => listener(clickEvt));
    }
    static simulateChange(el, value) {
      el.value = value;
      const changeEvt = {
        target: el,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn()
      };
      const changeListeners = global.document._listeners?.["change"] || [];
      changeListeners.forEach((listener) => listener(changeEvt));
    }
  };
  function attachTesting(clientProto) {
    clientProto.testing = DolphinTestUtils;
  }

  // src/index.ts
  attachDOMBinding(DolphinClient.prototype);
  attachOffline(DolphinClient.prototype);
  attachValidation(DolphinClient.prototype);
  attachAnimations(DolphinClient.prototype);
  attachA11y(DolphinClient.prototype);
  attachI18n(DolphinClient.prototype);
  attachDragDrop(DolphinClient.prototype);
  attachCollab(DolphinClient.prototype);
  attachPwa(DolphinClient.prototype);
  attachTesting(DolphinClient.prototype);
  if (typeof window !== "undefined") {
    window.DolphinClient = DolphinClient;
    document.addEventListener("DOMContentLoaded", () => {
      if (!window.dolphin) {
        const scriptEl = document.querySelector('script[src*="dolphin-client"]');
        const debugMode = scriptEl ? scriptEl.getAttribute("data-debug") === "true" : false;
        const dolphin = new DolphinClient(void 0, void 0, { debug: debugMode });
        window.dolphin = dolphin;
        if (debugMode) {
          console.log("%c\u{1F42C} [Dolphin Client] Auto-initialized local reactive engine!", "color: #06b6d4; font-weight: bold; font-size: 14px;");
          console.log('%c\u{1F449} Tip: You can access the client instance via "window.dolphin" in console.', "color: #94a3b8; font-style: italic;");
        }
        if (document.querySelector('[data-store-write="app.username"]')) {
          dolphin.setStoreState("app", "username", "\u0928\u092E\u0938\u094D\u0924\u0947 \u0938\u093E\u0925\u0940!");
        }
      }
    });
  }
  return __toCommonJS(index_exports);
})();
