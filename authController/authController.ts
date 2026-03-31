// dolphin-server-modules/auth-controller.ts
import { createAuth } from "../auth/auth";
import crypto from 'node:crypto';

export const createDolphinAuthController = (db: any, authConfig: any) => {
  const authCore = createAuth(authConfig);

  const verifyPassword = async (password: string, hash: string) => {
    try {
      const argon2 = await import('argon2');
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  };

  const hashPassword = async (password: string) => {
    const argon2 = await import('argon2');
    return await argon2.hash(password, { 
      type: argon2.argon2id, 
      memoryCost: 19456, 
      timeCost: 2 
    });
  };

  const generateResetToken = () => crypto.randomBytes(32).toString('hex');

  // ======= CONTROLLERS =======
  const handlers = {
    register: async (ctx: any) => {
      try {
        const user = await authCore.register(db, ctx.body);
        return { success: true, data: user };
      } catch (err: any) {
        return { success: false, error: err.message, status: err.status || 400 };
      }
    },

    login: async (ctx: any) => {
      try {
        const result = await authCore.login(db, ctx.body, ctx.res);
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message, status: err.status || 401 };
      }
    },

    refresh: async (ctx: any) => {
      try {
        const refreshToken = ctx.req.cookies?.rt;
        const result = await authCore.refresh(db, refreshToken, ctx.res);
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message, status: 401 };
      }
    },

    logout: async (ctx: any) => {
      try {
        const refreshToken = ctx.req.cookies?.rt;
        await authCore.logout(db, refreshToken);
        ctx.res.setHeader('Set-Cookie', 'rt=; HttpOnly; Max-Age=0');
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    me: async (ctx: any) => {
      try {
        const user = ctx.req.user;
        if (!user) throw new Error('Unauthorized');
        const { password, recoveryCodes, twoFactorSecret, ...safe } = user;
        return { success: true, data: safe };
      } catch (err: any) {
        return { success: false, error: err.message, status: 401 };
      }
    },

    changePassword: async (ctx: any) => {
      try {
        const userId = ctx.req.user?.id;
        if (!userId) throw new Error('Unauthorized');
        const { oldPassword, newPassword } = ctx.body;
        if (!oldPassword || !newPassword) throw new Error('Old and new password required');
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');

        const user = await db.findUserById(userId);
        if (!user) throw new Error('User not found');

        const isValid = await verifyPassword(oldPassword, user.password);
        if (!isValid) throw new Error('Current password is incorrect');

        const hashedPassword = await hashPassword(newPassword);
        await db.updateUser(userId, { password: hashedPassword });
        return { success: true, message: 'Password changed successfully' };
      } catch (err: any) {
        return { success: false, error: err.message, status: 400 };
      }
    },

    forgotPassword: async (ctx: any) => {
      try {
        const { email } = ctx.body;
        if (!email) throw new Error('Email required');

        const user = await db.findUserByEmail(email);
        if (!user) return { success: true, message: 'If email exists, reset link sent' };

        const resetToken = generateResetToken();
        const resetExpires = new Date(Date.now() + 3600000);
        await db.updateUser(user.id, { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires });

        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        return { success: true, message: 'Reset link sent', ...(process.env.NODE_ENV !== 'production' && { resetLink }) };
      } catch (err: any) {
        return { success: false, error: err.message, status: 400 };
      }
    },

    resetPassword: async (ctx: any) => {
      try {
        const { token, newPassword } = ctx.body;
        if (!token || !newPassword) throw new Error('Token and password required');
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters');

        let user = db.read ? (await db.read('User', { resetPasswordToken: token }))?.[0] : await db.findUserByResetToken(token);
        if (!user) throw new Error('Invalid or expired reset token');
        if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date()) throw new Error('Reset token has expired');

        const hashedPassword = await hashPassword(newPassword);
        await db.updateUser(user.id, { password: hashedPassword, resetPasswordToken: null, resetPasswordExpires: null });

        return { success: true, message: 'Password reset successfully' };
      } catch (err: any) {
        return { success: false, error: err.message, status: 400 };
      }
    },

    resendResetLink: async (ctx: any) => {
      try {
        const { email } = ctx.body;
        if (!email) throw new Error('Email required');
        const user = await db.findUserByEmail(email);
        if (!user) return { success: true, message: 'If email exists, reset link sent' };

        const resetToken = generateResetToken();
        const resetExpires = new Date(Date.now() + 3600000);
        await db.updateUser(user.id, { resetPasswordToken: resetToken, resetPasswordExpires: resetExpires });

        const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        return { success: true, message: 'Reset link sent', ...(process.env.NODE_ENV !== 'production' && { resetLink }) };
      } catch (err: any) {
        return { success: false, error: err.message, status: 400 };
      }
    },

    enable2FA: async (ctx: any) => {
      try {
        const result = await authCore.enable2FA(db, ctx.req.user.id);
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    verify2FA: async (ctx: any) => {
      try {
        const { totp } = ctx.body;
        const result = await authCore.verify2FA(db, ctx.req.user.id, totp);
        return { success: true, ...result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    disable2FA: async (ctx: any) => {
      try {
        const { totp } = ctx.body;
        await authCore.disable2FA(db, ctx.req.user.id, totp);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  };

  // ======= MIDDLEWARE =======
  const middleware = {
    requireAuth: async (ctx: any, next: Function) => {
      await authCore.middleware()(ctx.req, ctx.res, next);
    },
    require2FA: async (ctx: any, next: Function) => {
      await authCore.middleware({ require2FA: true })(ctx.req, ctx.res, next);
    },
    requireAdmin: async (ctx: any, next: Function) => {
      await authCore.middleware()(ctx.req, ctx.res, async () => {
        if (ctx.req.user?.role !== 'admin') {
          ctx.res.statusCode = 403;
          ctx.res.end(JSON.stringify({ error: 'Admin access required' }));
          return;
        }
        await next();
      });
    }
  };

  // ======= UTILITIES =======
  const utilities = {
    sanitize: (user: any) => {
      if (!user) return null;
      const { password, recoveryCodes, twoFactorSecret, pending2FASecret, resetPasswordToken, resetPasswordExpires, ...safe } = user;
      return safe;
    }
  };

  return { ...handlers, ...middleware, ...utilities };
};

export default createDolphinAuthController;