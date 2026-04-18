"use strict";
// dolphin-server-modules/auth-controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDolphinAuthController = void 0;
const auth_1 = require("../auth/auth");
const node_crypto_1 = __importDefault(require("node:crypto"));
// ✅ यो फङ्सनले ब्राउजरबाट आएको Raw Header बाट कुकी निकाल्छ
const getCookie = (req, name) => {
    const cookieHeader = req.headers?.cookie || req.req?.headers?.cookie;
    if (!cookieHeader)
        return undefined;
    const match = cookieHeader.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : undefined;
};
const createDolphinAuthController = (db, authConfig) => {
    const authCore = (0, auth_1.createAuth)({
        secret: authConfig.secret,
        cookieMaxAge: authConfig.cookieMaxAge,
        issuer: authConfig.issuer,
        rateLimit: authConfig.rateLimit,
        redisClient: authConfig.redisClient,
        secureCookies: authConfig.secureCookies ?? false
    });
    const verifyPassword = async (password, hash) => {
        try {
            const argon2 = await Promise.resolve().then(() => __importStar(require('argon2')));
            return await argon2.verify(hash, password);
        }
        catch {
            return false;
        }
    };
    const hashPassword = async (password) => {
        const argon2 = await Promise.resolve().then(() => __importStar(require('argon2')));
        return await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2
        });
    };
    const generateResetToken = () => node_crypto_1.default.randomBytes(32).toString('hex');
    const handlers = {
        register: async (ctx) => {
            try {
                const user = await authCore.register(db, ctx.body);
                return { success: true, data: user };
            }
            catch (err) {
                return { success: false, error: err.message, status: err.status || 400 };
            }
        },
        login: async (ctx) => {
            try {
                const dolphinRes = {
                    cookie: (name, value, options) => {
                        const maxAgeSec = Math.floor(options.maxAge / 1000);
                        const secureFlag = options.secure ? '; Secure' : '';
                        // ✅ Path=/ थप्नु अनिवार्य छ, नत्र अरु Route मा कुकी जाँदैन
                        ctx.res.setHeader('Set-Cookie', `${name}=${value}; HttpOnly; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secureFlag}`);
                    }
                };
                const result = await authCore.login(db, ctx.body, dolphinRes);
                return { success: true, ...result };
            }
            catch (err) {
                return { success: false, error: err.message, status: err.status || 401 };
            }
        },
        refresh: async (ctx) => {
            try {
                // ✅ नयाँ तरिका (१००% चल्छ): सिधै Header बाट कुकी तान्ने
                const refreshToken = getCookie(ctx.req, 'rt');
                if (!refreshToken) {
                    return { success: false, error: 'No refresh token provided', status: 401 };
                }
                const dolphinRes = {
                    cookie: (name, value, options) => {
                        const maxAgeSec = Math.floor(options.maxAge / 1000);
                        const secureFlag = options.secure ? '; Secure' : '';
                        ctx.res.setHeader('Set-Cookie', `${name}=${value}; HttpOnly; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secureFlag}`);
                    }
                };
                const result = await authCore.refresh(db, refreshToken, dolphinRes);
                return { success: true, ...result };
            }
            catch (err) {
                return { success: false, error: err.message, status: 401 };
            }
        },
        // ✅ FIXED: TypeScript error solved safely
        logout: async (ctx) => {
            try {
                const refreshToken = getCookie(ctx.req, 'rt');
                // ✅ Safe check: only call logout if token exists
                if (refreshToken) {
                    await authCore.logout(db, refreshToken);
                }
                // ✅ Path=/ नभए कुकी पूर्ण रुपमा डिलेट हुँदैन
                ctx.res.setHeader('Set-Cookie', 'rt=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax');
                return { success: true };
            }
            catch (err) {
                return { success: false, error: err.message };
            }
        },
        me: async (ctx) => {
            try {
                const user = ctx.req.user;
                if (!user)
                    throw new Error('Unauthorized');
                const { password, recoveryCodes, twoFactorSecret, ...safe } = user;
                return { success: true, data: safe };
            }
            catch (err) {
                return { success: false, error: err.message, status: 401 };
            }
        },
        changePassword: async (ctx) => {
            try {
                const userId = ctx.req.user?.id;
                if (!userId)
                    throw new Error('Unauthorized');
                const { oldPassword, newPassword } = ctx.body;
                if (!oldPassword || !newPassword)
                    throw new Error('Old and new password required');
                if (newPassword.length < 8)
                    throw new Error('Password must be at least 8 characters');
                const user = await db.findUserById(userId);
                if (!user)
                    throw new Error('User not found');
                const isValid = await verifyPassword(oldPassword, user.password);
                if (!isValid)
                    throw new Error('Current password is incorrect');
                const hashedPassword = await hashPassword(newPassword);
                await db.updateUser(userId, { password: hashedPassword });
                return { success: true, message: 'Password changed successfully' };
            }
            catch (err) {
                return { success: false, error: err.message, status: 400 };
            }
        },
        forgotPassword: async (ctx) => {
            try {
                const { email } = ctx.body;
                if (!email)
                    throw new Error('Email required');
                const user = await db.findUserByEmail(email);
                if (!user)
                    return { success: true, message: 'If email exists, reset link sent' };
                const resetToken = generateResetToken();
                const resetExpires = new Date(Date.now() + 3600000);
                await db.updateUser(user.id, { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires });
                const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
                return { success: true, message: 'Reset link sent', ...(process.env.NODE_ENV !== 'production' && { resetLink }) };
            }
            catch (err) {
                return { success: false, error: err.message, status: 400 };
            }
        },
        resetPassword: async (ctx) => {
            try {
                const { token, newPassword } = ctx.body;
                if (!token || !newPassword)
                    throw new Error('Token and password required');
                if (newPassword.length < 8)
                    throw new Error('Password must be at least 8 characters');
                let user = db.read ? (await db.read('User', { resetPasswordToken: token }))?.[0] : await db.findUserByResetToken(token);
                if (!user)
                    throw new Error('Invalid or expired reset token');
                if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date())
                    throw new Error('Reset token has expired');
                const hashedPassword = await hashPassword(newPassword);
                await db.updateUser(user.id, { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null });
                return { success: true, message: 'Password reset successfully' };
            }
            catch (err) {
                return { success: false, error: err.message, status: 400 };
            }
        },
        resendResetLink: async (ctx) => {
            try {
                const { email } = ctx.body;
                if (!email)
                    throw new Error('Email required');
                const user = await db.findUserByEmail(email);
                if (!user)
                    return { success: true, message: 'If email exists, reset link sent' };
                const resetToken = generateResetToken();
                const resetExpires = new Date(Date.now() + 3600000);
                await db.updateUser(user.id, { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires });
                const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
                return { success: true, message: 'Reset link sent', ...(process.env.NODE_ENV !== 'production' && { resetLink }) };
            }
            catch (err) {
                return { success: false, error: err.message, status: 400 };
            }
        },
        enable2FA: async (ctx) => {
            try {
                const result = await authCore.enable2FA(db, ctx.req.user.id);
                return { success: true, ...result };
            }
            catch (err) {
                return { success: false, error: err.message };
            }
        },
        verify2FA: async (ctx) => {
            try {
                const { totp } = ctx.body;
                const result = await authCore.verify2FA(db, ctx.req.user.id, totp);
                return { success: true, ...result };
            }
            catch (err) {
                return { success: false, error: err.message };
            }
        },
        disable2FA: async (ctx) => {
            try {
                const { totp } = ctx.body;
                await authCore.disable2FA(db, ctx.req.user.id, totp);
                return { success: true };
            }
            catch (err) {
                return { success: false, error: err.message };
            }
        },
    };
    const middleware = {
        requireAuth: async (ctx, next) => {
            await authCore.middleware()(ctx.req, ctx.res, next);
        },
        require2FA: async (ctx, next) => {
            await authCore.middleware({ require2FA: true })(ctx.req, ctx.res, next);
        },
        requireAdmin: async (ctx, next) => {
            await authCore.middleware()(ctx.req, ctx.res, async () => {
                if (ctx.req.user?.role !== 'admin') {
                    ctx.res.statusCode = 403;
                    ctx.res.end(JSON.stringify({ error: 'Admin access required' }));
                    return;
                }
                if (next)
                    await next();
            });
        }
    };
    const utilities = {
        sanitize: (user) => {
            if (!user)
                return null;
            const { password, recoveryCodes, twoFactorSecret, pending2FASecret, resetPasswordToken, resetPasswordExpires, ...safe } = user;
            return safe;
        }
    };
    return { ...handlers, ...middleware, ...utilities };
};
exports.createDolphinAuthController = createDolphinAuthController;
exports.default = exports.createDolphinAuthController;
//# sourceMappingURL=authController.js.map