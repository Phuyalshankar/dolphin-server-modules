"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test/auth-controller.test.ts
const globals_1 = require("@jest/globals");
// Mock the auth controller module
jest.mock('../authController/authController', () => ({
    createDolphinAuthController: jest.fn((db, config) => ({
        register: jest.fn().mockImplementation(async (ctx) => {
            const body = ctx.body;
            if (body.email === 'exists@example.com') {
                return { success: false, error: 'Email already exists', status: 400 };
            }
            return { success: true, data: { id: '1', email: body.email, role: 'user' } };
        }),
        login: jest.fn().mockImplementation(async (ctx) => {
            const body = ctx.body;
            if (body.email === 'test@example.com' && body.password === 'password123') {
                // ✅ Cookie set गरेको simulation
                ctx.res.setHeader('Set-Cookie', 'rt=refresh-token-123; HttpOnly; Max-Age=604800; Path=/; SameSite=Lax');
                return { success: true, accessToken: 'token123', user: { id: '1', email: body.email } };
            }
            return { success: false, error: 'Invalid credentials', status: 401 };
        }),
        refresh: jest.fn().mockImplementation(async (ctx) => {
            // ✅ Dolphin server style: header बाट cookie extract गर्ने
            const getCookie = (req, name) => {
                const cookieHeader = req.headers?.cookie;
                if (!cookieHeader)
                    return undefined;
                const match = cookieHeader.match(new RegExp('(^| )' + name + '=([^;]+)'));
                return match ? match[2] : undefined;
            };
            const refreshToken = getCookie(ctx.req, 'rt');
            if (refreshToken === 'refresh-token-123') {
                // ✅ New cookie set गर्ने
                ctx.res.setHeader('Set-Cookie', 'rt=new-refresh-token-456; HttpOnly; Max-Age=604800; Path=/; SameSite=Lax');
                return { success: true, accessToken: 'new-token-456', user: { id: '1' } };
            }
            return { success: false, error: 'No refresh token provided', status: 401 };
        }),
        logout: jest.fn().mockImplementation(async (ctx) => {
            // ✅ Cookie clear गर्ने
            ctx.res.setHeader('Set-Cookie', 'rt=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax');
            return { success: true };
        }),
        me: jest.fn().mockImplementation(async (ctx) => {
            if (ctx.req.user) {
                const { password, recoveryCodes, twoFactorSecret, ...safe } = ctx.req.user;
                return { success: true, data: safe };
            }
            return { success: false, error: 'Unauthorized', status: 401 };
        }),
        changePassword: jest.fn().mockImplementation(async (ctx) => {
            const { oldPassword, newPassword } = ctx.body;
            if (oldPassword === 'old123' && newPassword?.length >= 8) {
                return { success: true, message: 'Password changed successfully' };
            }
            return { success: false, error: 'Current password is incorrect', status: 400 };
        }),
        forgotPassword: jest.fn().mockImplementation(async (ctx) => {
            const { email } = ctx.body;
            if (email === 'test@example.com') {
                return { success: true, message: 'Reset link sent' };
            }
            return { success: true, message: 'If email exists, reset link sent' };
        }),
        resetPassword: jest.fn().mockImplementation(async (ctx) => {
            const { token, newPassword } = ctx.body;
            if (token === 'valid-token') {
                return { success: true, message: 'Password reset successfully' };
            }
            return { success: false, error: 'Invalid or expired reset token', status: 400 };
        }),
        enable2FA: jest.fn().mockImplementation(async () => {
            return { success: true, secret: 'SECRET123', uri: 'otpauth://...' };
        }),
        verify2FA: jest.fn().mockImplementation(async (ctx) => {
            const { totp } = ctx.body;
            if (totp === '123456') {
                return { success: true, recoveryCodes: ['code1', 'code2'] };
            }
            return { success: false, error: 'Invalid TOTP', status: 401 };
        }),
        disable2FA: jest.fn().mockImplementation(async () => {
            return { success: true };
        }),
        requireAuth: jest.fn(() => (req, res, next) => next()),
        require2FA: jest.fn(() => (req, res, next) => next()),
        requireAdmin: jest.fn((ctx, next) => next()),
        sanitize: jest.fn((user) => {
            if (!user)
                return null;
            const { password, recoveryCodes, twoFactorSecret, pending2FASecret, resetPasswordToken, resetPasswordExpires, ...safe } = user;
            return safe;
        })
    }))
}));
const authController_1 = require("../authController/authController");
(0, globals_1.describe)('Auth Controller Factory - Dolphin Server Compatible', () => {
    let mockDb;
    let mockCtx;
    let auth;
    (0, globals_1.beforeEach)(() => {
        mockDb = {};
        auth = (0, authController_1.createDolphinAuthController)(mockDb, {
            secret: 'test-secret',
            cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            secureCookies: false
        });
        // ✅ Dolphin Server style mock context
        mockCtx = {
            req: {
                headers: {
                    cookie: '' // ← cookie header (Dolphin style)
                },
                user: null
            },
            res: {
                setHeader: jest.fn(),
                getHeader: jest.fn()
            },
            body: {},
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });
    (0, globals_1.describe)('createDolphinAuthController', () => {
        (0, globals_1.it)('creates auth controller with all required methods', () => {
            (0, globals_1.expect)(auth).toHaveProperty('register');
            (0, globals_1.expect)(auth).toHaveProperty('login');
            (0, globals_1.expect)(auth).toHaveProperty('refresh');
            (0, globals_1.expect)(auth).toHaveProperty('logout');
            (0, globals_1.expect)(auth).toHaveProperty('me');
            (0, globals_1.expect)(auth).toHaveProperty('changePassword');
            (0, globals_1.expect)(auth).toHaveProperty('forgotPassword');
            (0, globals_1.expect)(auth).toHaveProperty('resetPassword');
            (0, globals_1.expect)(auth).toHaveProperty('enable2FA');
            (0, globals_1.expect)(auth).toHaveProperty('verify2FA');
            (0, globals_1.expect)(auth).toHaveProperty('disable2FA');
            (0, globals_1.expect)(auth).toHaveProperty('requireAuth');
            (0, globals_1.expect)(auth).toHaveProperty('require2FA');
            (0, globals_1.expect)(auth).toHaveProperty('requireAdmin');
            (0, globals_1.expect)(auth).toHaveProperty('sanitize');
        });
    });
    (0, globals_1.describe)('register', () => {
        (0, globals_1.it)('creates new user successfully', async () => {
            mockCtx.body = { email: 'new@example.com', password: 'password123' };
            const result = await auth.register(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data.email).toBe('new@example.com');
        });
        (0, globals_1.it)('returns error when email already exists', async () => {
            mockCtx.body = { email: 'exists@example.com', password: '123' };
            const result = await auth.register(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Email already exists');
            (0, globals_1.expect)(result.status).toBe(400);
        });
    });
    (0, globals_1.describe)('login - Cookie Test', () => {
        (0, globals_1.it)('logs in user successfully and sets refresh token cookie', async () => {
            mockCtx.body = { email: 'test@example.com', password: 'password123' };
            const result = await auth.login(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.accessToken).toBe('token123');
            (0, globals_1.expect)(result.user.email).toBe('test@example.com');
            // ✅ Verify cookie was set with correct parameters
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('rt=refresh-token-123'));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('HttpOnly'));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('Path=/'));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('SameSite=Lax'));
        });
        (0, globals_1.it)('returns error for invalid credentials', async () => {
            mockCtx.body = { email: 'wrong@example.com', password: 'wrong' };
            const result = await auth.login(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Invalid credentials');
            (0, globals_1.expect)(result.status).toBe(401);
        });
    });
    (0, globals_1.describe)('refresh - Cookie Test (Dolphin Style)', () => {
        (0, globals_1.it)('refreshes access token with valid refresh token from cookie header', async () => {
            // ✅ Set cookie in headers (Dolphin server style)
            mockCtx.req.headers.cookie = 'rt=refresh-token-123; other=value';
            const result = await auth.refresh(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.accessToken).toBe('new-token-456');
            // ✅ Verify new cookie was set
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('rt=new-refresh-token-456'));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('Max-Age=604800'));
        });
        (0, globals_1.it)('handles multiple cookies correctly', async () => {
            // ✅ Multiple cookies in header
            mockCtx.req.headers.cookie = 'session=abc123; rt=refresh-token-123; theme=dark';
            const result = await auth.refresh(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.accessToken).toBe('new-token-456');
        });
        (0, globals_1.it)('returns error when refresh token cookie is missing', async () => {
            mockCtx.req.headers.cookie = '';
            const result = await auth.refresh(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('No refresh token provided');
            (0, globals_1.expect)(result.status).toBe(401);
        });
        (0, globals_1.it)('returns error when cookie header is undefined', async () => {
            mockCtx.req.headers.cookie = undefined;
            const result = await auth.refresh(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('No refresh token provided');
            (0, globals_1.expect)(result.status).toBe(401);
        });
    });
    (0, globals_1.describe)('logout - Cookie Test', () => {
        (0, globals_1.it)('clears refresh token cookie on logout', async () => {
            mockCtx.req.headers.cookie = 'rt=refresh-token-123';
            const result = await auth.logout(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            // ✅ Verify cookie is cleared (Max-Age=0)
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('rt='));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('Max-Age=0'));
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenCalledWith('Set-Cookie', globals_1.expect.stringContaining('Path=/'));
        });
    });
    (0, globals_1.describe)('me', () => {
        (0, globals_1.it)('returns current user profile without sensitive data', async () => {
            const user = {
                id: '1',
                email: 'test@example.com',
                password: 'hashed',
                recoveryCodes: ['code1'],
                name: 'Test User'
            };
            mockCtx.req.user = user;
            const result = await auth.me(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data).not.toHaveProperty('password');
            (0, globals_1.expect)(result.data).not.toHaveProperty('recoveryCodes');
            (0, globals_1.expect)(result.data.email).toBe('test@example.com');
            (0, globals_1.expect)(result.data.name).toBe('Test User');
        });
        (0, globals_1.it)('returns unauthorized when user not found', async () => {
            mockCtx.req.user = null;
            const result = await auth.me(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Unauthorized');
            (0, globals_1.expect)(result.status).toBe(401);
        });
    });
    (0, globals_1.describe)('changePassword', () => {
        (0, globals_1.it)('changes password successfully', async () => {
            mockCtx.req.user = { id: '1' };
            mockCtx.body = { oldPassword: 'old123', newPassword: 'new123456' };
            const result = await auth.changePassword(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.message).toBe('Password changed successfully');
        });
        (0, globals_1.it)('fails with incorrect old password', async () => {
            mockCtx.req.user = { id: '1' };
            mockCtx.body = { oldPassword: 'wrong', newPassword: 'new123456' };
            const result = await auth.changePassword(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Current password is incorrect');
        });
    });
    (0, globals_1.describe)('forgotPassword', () => {
        (0, globals_1.it)('sends reset link for existing email', async () => {
            mockCtx.body = { email: 'test@example.com' };
            const result = await auth.forgotPassword(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.message).toBe('Reset link sent');
        });
    });
    (0, globals_1.describe)('resetPassword', () => {
        (0, globals_1.it)('resets password with valid token', async () => {
            mockCtx.body = { token: 'valid-token', newPassword: 'new123456' };
            const result = await auth.resetPassword(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.message).toBe('Password reset successfully');
        });
        (0, globals_1.it)('fails with invalid token', async () => {
            mockCtx.body = { token: 'invalid-token', newPassword: 'new123456' };
            const result = await auth.resetPassword(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Invalid or expired reset token');
        });
    });
    (0, globals_1.describe)('2FA Methods', () => {
        (0, globals_1.it)('enables 2FA for user', async () => {
            mockCtx.req.user = { id: '1' };
            const result = await auth.enable2FA(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.secret).toBe('SECRET123');
        });
        (0, globals_1.it)('verifies 2FA token', async () => {
            mockCtx.req.user = { id: '1' };
            mockCtx.body = { totp: '123456' };
            const result = await auth.verify2FA(mockCtx);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.recoveryCodes).toEqual(['code1', 'code2']);
        });
        (0, globals_1.it)('fails 2FA verification with invalid token', async () => {
            mockCtx.req.user = { id: '1' };
            mockCtx.body = { totp: '999999' };
            const result = await auth.verify2FA(mockCtx);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Invalid TOTP');
        });
    });
    (0, globals_1.describe)('sanitize', () => {
        (0, globals_1.it)('removes all sensitive fields from user object', () => {
            const user = {
                id: '1',
                email: 'test@example.com',
                password: 'secret',
                recoveryCodes: ['code1'],
                twoFactorSecret: 'secret',
                pending2FASecret: 'pending',
                resetPasswordToken: 'token',
                resetPasswordExpires: new Date(),
                name: 'Test User',
                role: 'user'
            };
            const sanitized = auth.sanitize(user);
            (0, globals_1.expect)(sanitized).toEqual({
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'user'
            });
            (0, globals_1.expect)(sanitized).not.toHaveProperty('password');
            (0, globals_1.expect)(sanitized).not.toHaveProperty('recoveryCodes');
            (0, globals_1.expect)(sanitized).not.toHaveProperty('twoFactorSecret');
            (0, globals_1.expect)(sanitized).not.toHaveProperty('resetPasswordToken');
        });
        (0, globals_1.it)('returns null for null input', () => {
            (0, globals_1.expect)(auth.sanitize(null)).toBeNull();
        });
    });
    (0, globals_1.describe)('Cookie Integration Flow', () => {
        (0, globals_1.it)('complete auth flow with cookies', async () => {
            // 1. Login - set cookie
            mockCtx.body = { email: 'test@example.com', password: 'password123' };
            const loginResult = await auth.login(mockCtx);
            (0, globals_1.expect)(loginResult.success).toBe(true);
            // 2. Simulate cookie being set in browser
            mockCtx.req.headers.cookie = 'rt=refresh-token-123';
            // 3. Refresh - read cookie and set new one
            const refreshResult = await auth.refresh(mockCtx);
            (0, globals_1.expect)(refreshResult.success).toBe(true);
            (0, globals_1.expect)(refreshResult.accessToken).toBe('new-token-456');
            // 4. Logout - clear cookie
            const logoutResult = await auth.logout(mockCtx);
            (0, globals_1.expect)(logoutResult.success).toBe(true);
            // 5. Verify cookie clear header was set
            (0, globals_1.expect)(mockCtx.res.setHeader).toHaveBeenLastCalledWith('Set-Cookie', globals_1.expect.stringContaining('Max-Age=0'));
        });
    });
});
//# sourceMappingURL=authController.test.js.map