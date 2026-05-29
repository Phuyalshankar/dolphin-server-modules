export class AuthHandler {
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
            const res = await this.client.api.post('/api/auth/refresh', null, { _isRetry: true });
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
