"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// test/auth/auth.test.ts
const auth_1 = require("./auth");
const node_crypto_1 = __importDefault(require("node:crypto"));
class MockAuthDB {
    users = [];
    tokens = [];
    async createUser(data) {
        const id = node_crypto_1.default.randomBytes(8).toString('hex');
        const u = { id, ...data };
        this.users.push(u);
        return u;
    }
    async findUserByEmail(email) {
        return this.users.find(u => u.email === email);
    }
    async findUserById(id) {
        return this.users.find(u => u.id === id);
    }
    async updateUser(id, data) {
        const idx = this.users.findIndex(u => u.id === id);
        if (idx > -1)
            this.users[idx] = { ...this.users[idx], ...data };
        return this.users[idx];
    }
    async saveRefreshToken(data) {
        this.tokens.push(data);
    }
    async findRefreshToken(token) {
        return this.tokens.find(t => t.token === token) || null;
    }
    async deleteRefreshToken(token) {
        this.tokens = this.tokens.filter(t => t.token !== token);
    }
}
describe('Auth Module', () => {
    let db;
    let auth;
    beforeEach(() => {
        db = new MockAuthDB();
        auth = (0, auth_1.createAuth)({
            secret: 'test-secret',
            cookieMaxAge: 1000 * 60 * 60,
            issuer: 'TestApp'
        });
    });
    describe('Registration', () => {
        it('registers a new user successfully', async () => {
            const user = await auth.register(db, {
                email: 'test@example.com',
                password: 'password123'
            });
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('user');
            expect(user.id).toBeDefined();
        });
        it('throws error for missing fields', async () => {
            await expect(auth.register(db, { email: '', password: '123' }))
                .rejects.toThrow('Missing fields');
        });
    });
    describe('Login', () => {
        beforeEach(async () => {
            await auth.register(db, {
                email: 'test@example.com',
                password: 'password123'
            });
        });
        it('logs in successfully with correct credentials', async () => {
            const result = await auth.login(db, {
                email: 'test@example.com',
                password: 'password123'
            });
            expect(result.accessToken).toBeDefined();
            expect(result.user.email).toBe('test@example.com');
            expect(result.user.role).toBe('user');
        });
        it('rejects invalid password', async () => {
            await expect(auth.login(db, {
                email: 'test@example.com',
                password: 'wrong'
            })).rejects.toThrow('Invalid credentials');
        });
        it('rejects non-existent email', async () => {
            await expect(auth.login(db, {
                email: 'nonexistent@example.com',
                password: 'password123'
            })).rejects.toThrow('Invalid credentials');
        });
    });
    describe('Middleware', () => {
        let token;
        let userId;
        beforeEach(async () => {
            const user = await auth.register(db, {
                email: 'middleware@example.com',
                password: 'password123'
            });
            userId = user.id;
            const loginResult = await auth.login(db, {
                email: 'middleware@example.com',
                password: 'password123'
            });
            token = loginResult.accessToken;
        });
        it('should allow access with valid token', async () => {
            const req = {
                headers: { authorization: `Bearer ${token}` },
                user: null
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            let nextCalled = false;
            const next = () => { nextCalled = true; };
            const middleware = auth.middleware();
            await middleware(req, res, next);
            expect(nextCalled).toBe(true);
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(userId);
        });
        it('should reject request without token', async () => {
            const req = {
                headers: {},
                user: null
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();
            const middleware = auth.middleware();
            await middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
        });
        it('should reject request with invalid token', async () => {
            const req = {
                headers: { authorization: 'Bearer invalid-token' },
                user: null
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();
            const middleware = auth.middleware();
            await middleware(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
        });
        it('should handle Dolphin style context (no res, no next)', async () => {
            const req = {
                headers: { authorization: `Bearer ${token}` },
                user: null
            };
            // Dolphin style: no res, next is not a function
            const res = undefined;
            let nextCalled = false;
            const next = () => { nextCalled = true; };
            const middleware = auth.middleware();
            await middleware(req, res, next);
            expect(nextCalled).toBe(true);
            expect(req.user).toBeDefined();
        });
    });
    describe('2FA', () => {
        let userId;
        beforeEach(async () => {
            const user = await auth.register(db, {
                email: '2fa@example.com',
                password: 'password123'
            });
            userId = user.id;
        });
        it('enables 2FA and returns QR code', async () => {
            const { secret, uri } = await auth.enable2FA(db, userId);
            expect(secret).toBeDefined();
            expect(secret.length).toBeGreaterThan(10);
            expect(uri).toMatch(/otpauth:\/\/totp\/TestApp:2fa(@|%40)example\.com/);
            expect(uri).toContain(`secret=${secret}`);
        });
        it('allows enabling 2FA multiple times (returns existing secret)', async () => {
            const first = await auth.enable2FA(db, userId);
            const second = await auth.enable2FA(db, userId);
            expect(second.secret).toBe(first.secret);
            expect(second.uri).toBe(first.uri);
        });
        it('rejects invalid TOTP verification', async () => {
            await auth.enable2FA(db, userId);
            await expect(auth.verify2FA(db, userId, '000000'))
                .rejects.toThrow('Invalid verification token');
        });
    });
    describe('Refresh Token', () => {
        let refreshToken;
        beforeEach(async () => {
            await auth.register(db, {
                email: 'refresh@example.com',
                password: 'password123'
            });
            await auth.login(db, {
                email: 'refresh@example.com',
                password: 'password123'
            });
            refreshToken = db.tokens[0].token;
        });
        it('refreshes token successfully', async () => {
            const newSession = await auth.refresh(db, refreshToken);
            expect(newSession.accessToken).toBeDefined();
            expect(newSession.user.email).toBe('refresh@example.com');
        });
        it('detects token reuse', async () => {
            await auth.refresh(db, refreshToken);
            await expect(auth.refresh(db, refreshToken))
                .rejects.toThrow('Token reuse detected');
        });
        it('rejects expired token', async () => {
            const shortAuth = (0, auth_1.createAuth)({
                secret: 'test-secret',
                cookieMaxAge: 1
            });
            await shortAuth.register(db, {
                email: 'expired@example.com',
                password: 'password123'
            });
            await shortAuth.login(db, {
                email: 'expired@example.com',
                password: 'password123'
            });
            const user = db.users.find(u => u.email === 'expired@example.com');
            const token = db.tokens.find(t => t.userId === user?.id)?.token;
            await new Promise(resolve => setTimeout(resolve, 10));
            await expect(shortAuth.refresh(db, token))
                .rejects.toThrow('Invalid or expired refresh token');
        });
    });
    describe('Logout', () => {
        let refreshToken;
        beforeEach(async () => {
            await auth.register(db, {
                email: 'logout@example.com',
                password: 'password123'
            });
            await auth.login(db, {
                email: 'logout@example.com',
                password: 'password123'
            });
            refreshToken = db.tokens[0].token;
        });
        it('logs out successfully', async () => {
            const result = await auth.logout(db, refreshToken);
            expect(result.success).toBe(true);
            const token = await db.findRefreshToken(refreshToken);
            expect(token).toBeNull();
        });
    });
    describe('Rate Limiting', () => {
        it('limits login attempts', async () => {
            await auth.register(db, {
                email: 'ratelimit@example.com',
                password: 'password123'
            });
            let rateLimited = false;
            for (let i = 0; i < 7; i++) {
                try {
                    await auth.login(db, {
                        email: 'ratelimit@example.com',
                        password: 'wrong'
                    });
                }
                catch (err) {
                    if (err.message === 'Rate limit exceeded') {
                        rateLimited = true;
                        expect(err.status).toBe(429);
                        break;
                    }
                }
            }
            expect(rateLimited).toBe(true);
        });
    });
});
//# sourceMappingURL=auth.test.js.map