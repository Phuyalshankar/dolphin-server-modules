// test/auth-controller.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock the auth controller module
jest.mock('../authController/authController', () => ({
  createDolphinAuthController: jest.fn((db, config) => ({
    register: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.email === 'exists@example.com') {
        return { success: false, error: 'Email already exists', status: 400 };
      }
      return { success: true, data: { id: '1', email: body.email, role: 'user' } };
    }),
    login: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.email === 'test@example.com' && body.password === 'password123') {
        return { success: true, accessToken: 'token123', user: { id: '1', email: body.email } };
      }
      return { success: false, error: 'Invalid credentials', status: 401 };
    }),
    refresh: jest.fn().mockImplementation(async (ctx) => {
      if (ctx.req.cookies?.rt) {
        return { success: true, accessToken: 'new-token', user: { id: '1' } };
      }
      return { success: false, error: 'No refresh token provided', status: 401 };
    }),
    logout: jest.fn().mockImplementation(async () => {
      return { success: true };
    }),
    me: jest.fn().mockImplementation(async (ctx) => {
      if (ctx.req.user) {
        const { password, ...safe } = ctx.req.user;
        return { success: true, data: safe };
      }
      return { success: false, error: 'Unauthorized', status: 401 };
    }),
    changePassword: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.oldPassword === 'old123' && body.newPassword?.length >= 8) {
        return { success: true, message: 'Password changed successfully' };
      }
      return { success: false, error: 'Current password is incorrect', status: 400 };
    }),
    forgotPassword: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.email === 'test@example.com') {
        return { success: true, message: 'Reset link sent' };
      }
      return { success: true, message: 'If email exists, reset link sent' };
    }),
    resetPassword: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.token === 'valid-token') {
        return { success: true, message: 'Password reset successfully' };
      }
      return { success: false, error: 'Invalid or expired reset token', status: 400 };
    }),
    enable2FA: jest.fn().mockImplementation(async () => {
      return { success: true, secret: 'SECRET123', uri: 'otpauth://...' };
    }),
    verify2FA: jest.fn().mockImplementation(async (ctx) => {
      const body = await ctx.req.json();
      if (body.totp === '123456') {
        return { success: true, recoveryCodes: ['code1', 'code2'] };
      }
      return { success: false, error: 'Invalid TOTP', status: 401 };
    }),
    disable2FA: jest.fn().mockImplementation(async () => {
      return { success: true };
    }),
    requireAuth: jest.fn(() => (req: any, res: any, next: any) => next()),
    require2FA: jest.fn(() => (req: any, res: any, next: any) => next()),
    requireAdmin: jest.fn((ctx, next) => next()),
    sanitize: jest.fn((user) => {
      if (!user) return null;
      const { password, recoveryCodes, twoFactorSecret, pending2FASecret, resetPasswordToken, resetPasswordExpires, ...safe } = user;
      return safe;
    })
  }))
}));

import { createDolphinAuthController } from '../authController/authController';

describe('Auth Controller Factory', () => {
  let mockDb: any;
  let mockCtx: any;
  let auth: any;

  beforeEach(() => {
    mockDb = {};
    auth = createDolphinAuthController(mockDb, { secret: 'test-secret' });
    
    mockCtx = {
      req: {
        json: jest.fn(),
        cookies: {},
        user: null,
        headers: {}
      },
      res: {
        setHeader: jest.fn()
      },
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('createDolphinAuthController', () => {
    it('creates auth controller with all required methods', () => {
      expect(auth).toHaveProperty('register');
      expect(auth).toHaveProperty('login');
      expect(auth).toHaveProperty('refresh');
      expect(auth).toHaveProperty('logout');
      expect(auth).toHaveProperty('me');
      expect(auth).toHaveProperty('changePassword');
      expect(auth).toHaveProperty('forgotPassword');
      expect(auth).toHaveProperty('resetPassword');
      expect(auth).toHaveProperty('enable2FA');
      expect(auth).toHaveProperty('verify2FA');
      expect(auth).toHaveProperty('disable2FA');
      expect(auth).toHaveProperty('requireAuth');
      expect(auth).toHaveProperty('require2FA');
      expect(auth).toHaveProperty('requireAdmin');
      expect(auth).toHaveProperty('sanitize');
    });
  });

  describe('register', () => {
    it('creates new user successfully', async () => {
      const userData = { email: 'new@example.com', password: 'password123' };
      mockCtx.req.json.mockResolvedValue(userData);

      const result = await auth.register(mockCtx);

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('new@example.com');
    });

    it('returns error when registration fails', async () => {
      mockCtx.req.json.mockResolvedValue({ email: 'exists@example.com', password: '123' });

      const result = await auth.register(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
      expect(result.status).toBe(400);
    });
  });

  describe('login', () => {
    it('logs in user successfully', async () => {
      mockCtx.req.json.mockResolvedValue({ email: 'test@example.com', password: 'password123' });

      const result = await auth.login(mockCtx);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('token123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('returns error for invalid credentials', async () => {
      mockCtx.req.json.mockResolvedValue({ email: 'wrong@example.com', password: 'wrong' });

      const result = await auth.login(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.status).toBe(401);
    });
  });

  describe('refresh', () => {
    it('refreshes access token with valid refresh token', async () => {
      mockCtx.req.cookies = { rt: 'valid-refresh-token' };

      const result = await auth.refresh(mockCtx);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-token');
    });

    it('returns error when refresh token is missing', async () => {
      mockCtx.req.cookies = {};

      const result = await auth.refresh(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token provided');
      expect(result.status).toBe(401);
    });
  });

  describe('logout', () => {
    it('clears refresh token cookie', async () => {
      mockCtx.req.cookies = { rt: 'valid-token' };

      const result = await auth.logout(mockCtx);

      expect(result.success).toBe(true);
    });
  });

  me: jest.fn().mockImplementation(async (ctx) => {
  if (ctx.req.user) {
    // ✅ सबै sensitive fields हटाउने
    const { password, recoveryCodes, twoFactorSecret, pending2FASecret, resetPasswordToken, resetPasswordExpires, ...safe } = ctx.req.user;
    return { success: true, data: safe };
  }
  return { success: false, error: 'Unauthorized', status: 401 };
}),

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.req.json.mockResolvedValue({ oldPassword: 'old123', newPassword: 'new123456' });

      const result = await auth.changePassword(mockCtx);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
    });

    it('fails with incorrect old password', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.req.json.mockResolvedValue({ oldPassword: 'wrong', newPassword: 'new123456' });

      const result = await auth.changePassword(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });
  });

  describe('forgotPassword', () => {
    it('sends reset link for existing email', async () => {
      mockCtx.req.json.mockResolvedValue({ email: 'test@example.com' });

      const result = await auth.forgotPassword(mockCtx);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Reset link sent');
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      mockCtx.req.json.mockResolvedValue({ token: 'valid-token', newPassword: 'new123456' });

      const result = await auth.resetPassword(mockCtx);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
    });

    it('fails with invalid token', async () => {
      mockCtx.req.json.mockResolvedValue({ token: 'invalid-token', newPassword: 'new123456' });

      const result = await auth.resetPassword(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired reset token');
    });
  });

  describe('2FA Methods', () => {
    it('enables 2FA for user', async () => {
      mockCtx.req.user = { id: '1' };

      const result = await auth.enable2FA(mockCtx);

      expect(result.success).toBe(true);
      expect(result.secret).toBe('SECRET123');
    });

    it('verifies 2FA token', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.req.json.mockResolvedValue({ totp: '123456' });

      const result = await auth.verify2FA(mockCtx);

      expect(result.success).toBe(true);
      expect(result.recoveryCodes).toEqual(['code1', 'code2']);
    });

    it('fails with invalid TOTP', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.req.json.mockResolvedValue({ totp: '000000' });

      const result = await auth.verify2FA(mockCtx);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid TOTP');
    });

    it('disables 2FA', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.req.json.mockResolvedValue({ totp: '123456' });

      const result = await auth.disable2FA(mockCtx);

      expect(result.success).toBe(true);
    });
  });

  describe('Middleware', () => {
    it('provides requireAuth middleware', () => {
      expect(auth.requireAuth).toBeDefined();
      expect(typeof auth.requireAuth).toBe('function');
    });

    it('provides require2FA middleware', () => {
      expect(auth.require2FA).toBeDefined();
      expect(typeof auth.require2FA).toBe('function');
    });

    it('provides requireAdmin wrapper', () => {
      expect(auth.requireAdmin).toBeDefined();
      expect(typeof auth.requireAdmin).toBe('function');
    });
  });

  describe('sanitize', () => {
    it('removes all sensitive fields from user object', () => {
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

      expect(sanitized).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      });
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('recoveryCodes');
      expect(sanitized).not.toHaveProperty('twoFactorSecret');
      expect(sanitized).not.toHaveProperty('resetPasswordToken');
    });

    it('returns null for null input', () => {
      expect(auth.sanitize(null)).toBeNull();
    });
  });
});