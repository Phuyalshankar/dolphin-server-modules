export class APIHandler {
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
    async request(method, path, body = null, options = {}) {
        const _isRetry = options._isRetry === true;
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
        
        const fetchOptions = { ...options };
        delete fetchOptions._isRetry;

        try {
            const response = await fetch(url, {
                method,
                headers,
                signal: controller.signal,
                ...(body ? { body: JSON.stringify(body) } : {}),
                ...fetchOptions,
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
                    return this.request(method, path, body, { ...options, _isRetry: true });
                }
            }

            const contentType = response.headers.get('content-type') || '';
            const data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();

            if (!response.ok) throw { status: response.status, data };

            // Hookless auth token auto-save
            if (data && typeof data === 'object') {
                if (data.accessToken) {
                    this.client.setToken(data.accessToken);
                    if (data.user) this.client.auth.user = data.user;
                }
            }

            // Auto-broadcast data changes
            if (this.client.options.autoBroadcast && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
                const cleanPath = path.startsWith('/') ? path.substring(1) : path;
                this.client.publish(cleanPath, { method: method.toUpperCase(), payload: body, result: data });
            }

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
