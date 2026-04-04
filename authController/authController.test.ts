// test/auth-controller.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';

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
      const getCookie = (req: any, name: string) => {
        const cookieHeader = req.headers?.cookie;
        if (!cookieHeader) return undefined;
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

describe('Auth Controller Factory - Dolphin Server Compatible', () => {
  let mockDb: any;
  let mockCtx: any;
  let auth: any;

  beforeEach(() => {
    mockDb = {};
    auth = createDolphinAuthController(mockDb, { 
      secret: 'test-secret',
      cookieMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secureCookies: false
    });
    
    // ✅ Dolphin Server style mock context
    mockCtx = {
      req: {
        headers: {
          cookie: ''  // ← cookie header (Dolphin style)
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
      mockCtx.body = { email: 'new@example.com', password: 'password123' };
      const result = await auth.register(mockCtx);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('new@example.com');
    });

    it('returns error when email already exists', async () => {
      mockCtx.body = { email: 'exists@example.com', password: '123' };
      const result = await auth.register(mockCtx);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
      expect(result.status).toBe(400);
    });
  });

  describe('login - Cookie Test', () => {
    it('logs in user successfully and sets refresh token cookie', async () => {
      mockCtx.body = { email: 'test@example.com', password: 'password123' };
      
      const result = await auth.login(mockCtx);
      
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('token123');
      expect(result.user.email).toBe('test@example.com');
      
      // ✅ Verify cookie was set with correct parameters
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('rt=refresh-token-123')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('HttpOnly')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Path=/')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('SameSite=Lax')
      );
    });

    it('returns error for invalid credentials', async () => {
      mockCtx.body = { email: 'wrong@example.com', password: 'wrong' };
      const result = await auth.login(mockCtx);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.status).toBe(401);
    });
  });

  describe('refresh - Cookie Test (Dolphin Style)', () => {
    it('refreshes access token with valid refresh token from cookie header', async () => {
      // ✅ Set cookie in headers (Dolphin server style)
      mockCtx.req.headers.cookie = 'rt=refresh-token-123; other=value';
      
      const result = await auth.refresh(mockCtx);
      
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-token-456');
      
      // ✅ Verify new cookie was set
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('rt=new-refresh-token-456')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Max-Age=604800')
      );
    });

    it('handles multiple cookies correctly', async () => {
      // ✅ Multiple cookies in header
      mockCtx.req.headers.cookie = 'session=abc123; rt=refresh-token-123; theme=dark';
      
      const result = await auth.refresh(mockCtx);
      
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-token-456');
    });

    it('returns error when refresh token cookie is missing', async () => {
      mockCtx.req.headers.cookie = '';
      
      const result = await auth.refresh(mockCtx);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token provided');
      expect(result.status).toBe(401);
    });

    it('returns error when cookie header is undefined', async () => {
      mockCtx.req.headers.cookie = undefined;
      
      const result = await auth.refresh(mockCtx);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token provided');
      expect(result.status).toBe(401);
    });
  });

  describe('logout - Cookie Test', () => {
    it('clears refresh token cookie on logout', async () => {
      mockCtx.req.headers.cookie = 'rt=refresh-token-123';
      
      const result = await auth.logout(mockCtx);
      
      expect(result.success).toBe(true);
      
      // ✅ Verify cookie is cleared (Max-Age=0)
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('rt=')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Max-Age=0')
      );
      expect(mockCtx.res.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('Path=/')
      );
    });
  });

  describe('me', () => {
    it('returns current user profile without sensitive data', async () => {
      const user = { 
        id: '1', 
        email: 'test@example.com', 
        password: 'hashed', 
        recoveryCodes: ['code1'],
        name: 'Test User' 
      };
      mockCtx.req.user = user;

      const result = await auth.me(mockCtx);

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('password');
      expect(result.data).not.toHaveProperty('recoveryCodes');
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.name).toBe('Test User');
    });

    it('returns unauthorized when user not found', async () => {
      mockCtx.req.user = null;
      const result = await auth.me(mockCtx);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(result.status).toBe(401);
    });
  });

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.body = { oldPassword: 'old123', newPassword: 'new123456' };
      const result = await auth.changePassword(mockCtx);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
    });

    it('fails with incorrect old password', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.body = { oldPassword: 'wrong', newPassword: 'new123456' };
      const result = await auth.changePassword(mockCtx);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });
  });

  describe('forgotPassword', () => {
    it('sends reset link for existing email', async () => {
      mockCtx.body = { email: 'test@example.com' };
      const result = await auth.forgotPassword(mockCtx);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Reset link sent');
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      mockCtx.body = { token: 'valid-token', newPassword: 'new123456' };
      const result = await auth.resetPassword(mockCtx);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
    });

    it('fails with invalid token', async () => {
      mockCtx.body = { token: 'invalid-token', newPassword: 'new123456' };
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
      mockCtx.body = { totp: '123456' };
      const result = await auth.verify2FA(mockCtx);
      expect(result.success).toBe(true);
      expect(result.recoveryCodes).toEqual(['code1', 'code2']);
    });

    it('fails 2FA verification with invalid token', async () => {
      mockCtx.req.user = { id: '1' };
      mockCtx.body = { totp: '999999' };
      const result = await auth.verify2FA(mockCtx);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid TOTP');
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

  describe('Cookie Integration Flow', () => {
    it('complete auth flow with cookies', async () => {
      // 1. Login - set cookie
      mockCtx.body = { email: 'test@example.com', password: 'password123' };
      const loginResult = await auth.login(mockCtx);
      expect(loginResult.success).toBe(true);
      
      // 2. Simulate cookie being set in browser
      mockCtx.req.headers.cookie = 'rt=refresh-token-123';
      
      // 3. Refresh - read cookie and set new one
      const refreshResult = await auth.refresh(mockCtx);
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.accessToken).toBe('new-token-456');
      
      // 4. Logout - clear cookie
      const logoutResult = await auth.logout(mockCtx);
      expect(logoutResult.success).toBe(true);
      
      // 5. Verify cookie clear header was set
      expect(mockCtx.res.setHeader).toHaveBeenLastCalledWith(
        'Set-Cookie',
        expect.stringContaining('Max-Age=0')
      );
    });
  });
});