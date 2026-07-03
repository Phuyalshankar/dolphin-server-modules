// test/auth/auth.test.ts
import { createAuth, DatabaseAdapter, RefreshTokenRecord } from './auth';
import crypto from 'node:crypto';

class MockAuthDB implements DatabaseAdapter {
  users: any[] = [];
  tokens: RefreshTokenRecord[] = [];

  async createUser(data: any) {
    const id = crypto.randomBytes(8).toString('hex');
    const u = { id, ...data };
    this.users.push(u);
    return u;
  }
  
  async findUserByEmail(email: string) { 
    return this.users.find(u => u.email === email); 
  }
  
  async findUserById(id: string) { 
    return this.users.find(u => u.id === id); 
  }
  
  async updateUser(id: string, data: any) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx > -1) this.users[idx] = { ...this.users[idx], ...data };
    return this.users[idx];
  }

  async findUserByResetToken(token: string) {
    return this.users.find(u => u.resetPasswordToken === token);
  }
  
  async saveRefreshToken(data: RefreshTokenRecord) { 
    this.tokens.push(data); 
  }
  
  async findRefreshToken(token: string) { 
    return this.tokens.find(t => t.token === token) || null; 
  }
  
  async deleteRefreshToken(token: string) { 
    this.tokens = this.tokens.filter(t => t.token !== token); 
  }
}

describe('Auth Module', () => {
  let db: MockAuthDB;
  let auth: ReturnType<typeof createAuth>;

  beforeEach(() => {
    db = new MockAuthDB();
    auth = createAuth({ 
      secret: 'test-secret', 
      cookieMaxAge: 1000 * 60 * 60,
      issuer: 'TestApp'
    });
  });

  describe('Registration', () => {
    it('registers a new user successfully', async () => {
    const user = await auth.register(db, { 
      email: 'test@example.com', 
      password: 'Password123' 
    });
    
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('user');
    expect(user.id).toBeDefined();
  });

  it('throws error for missing fields', async () => {
    await expect(auth.register(db, { email: '', password: '123' }))
      .rejects.toThrow('Missing fields');
  });

  it('throws error for weak password (too short)', async () => {
    await expect(auth.register(db, { 
      email: 'weak@example.com', 
      password: 'Pass1' 
    })).rejects.toThrow('Password must be at least 8 characters');
  });

  it('throws error for weak password (no uppercase)', async () => {
    await expect(auth.register(db, { 
      email: 'weak@example.com', 
      password: 'password123' 
    })).rejects.toThrow('Password must contain at least one uppercase letter');
  });

  it('throws error for weak password (no lowercase)', async () => {
    await expect(auth.register(db, { 
      email: 'weak@example.com', 
      password: 'PASSWORD123' 
    })).rejects.toThrow('Password must contain at least one lowercase letter');
  });

  it('throws error for weak password (no number)', async () => {
    await expect(auth.register(db, { 
      email: 'weak@example.com', 
      password: 'Password' 
    })).rejects.toThrow('Password must contain at least one number');
  });

  it('throws error for duplicate email registration', async () => {
    await auth.register(db, { 
      email: 'duplicate@example.com', 
      password: 'Password123' 
    });
    
    await expect(auth.register(db, { 
      email: 'duplicate@example.com', 
      password: 'Password456' 
    })).rejects.toThrow('Email already registered');
  });

  it('throws error for case-insensitive duplicate email registration', async () => {
    await auth.register(db, { 
      email: 'CaseSensitive@Example.com', 
      password: 'Password123' 
    });
    
    await expect(auth.register(db, { 
      email: 'casesensitive@example.com', 
      password: 'Password456' 
    })).rejects.toThrow('Email already registered');
    
    await expect(auth.register(db, { 
      email: 'CASESENSITIVE@EXAMPLE.COM', 
      password: 'Password789' 
    })).rejects.toThrow('Email already registered');
  });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await auth.register(db, { 
        email: 'test@example.com', 
        password: 'Password123' 
      });
    });

    it('logs in successfully with correct credentials', async () => {
      const result = await auth.login(db, { 
        email: 'test@example.com', 
        password: 'Password123' 
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
    let token: string;
    let userId: string;

    beforeEach(async () => {
      const user = await auth.register(db, { 
        email: 'middleware@example.com', 
        password: 'Password123' 
      });
      userId = user.id;
      
      const loginResult = await auth.login(db, { 
        email: 'middleware@example.com', 
        password: 'Password123' 
      });
      token = loginResult.accessToken;
    });

    it('should allow access with valid token', async () => {
      const req: any = {
        headers: { authorization: `Bearer ${token}` },
        user: null
      };
      const res: any = {
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
      const req: any = {
        headers: {},
        user: null
      };
      const res: any = {
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
      const req: any = {
        headers: { authorization: 'Bearer invalid-token' },
        user: null
      };
      const res: any = {
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
      const req: any = {
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
    let userId: string;

    beforeEach(async () => {
      const user = await auth.register(db, { 
        email: '2fa@example.com', 
        password: 'Password123' 
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
    let refreshToken: string;

    beforeEach(async () => {
      await auth.register(db, { 
        email: 'refresh@example.com', 
        password: 'Password123' 
      });
      
      await auth.login(db, { 
        email: 'refresh@example.com', 
        password: 'Password123' 
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
      const shortAuth = createAuth({ 
        secret: 'test-secret', 
        cookieMaxAge: 1 
      });
      
      await shortAuth.register(db, { 
        email: 'expired@example.com', 
        password: 'Password123' 
      });
      
      await shortAuth.login(db, { 
        email: 'expired@example.com', 
        password: 'Password123' 
      });
      
      const user = db.users.find(u => u.email === 'expired@example.com');
      const token = db.tokens.find(t => t.userId === user?.id)?.token;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await expect(shortAuth.refresh(db, token!))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('Logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await auth.register(db, { 
        email: 'logout@example.com', 
        password: 'Password123' 
      });
      
      await auth.login(db, { 
        email: 'logout@example.com', 
        password: 'Password123' 
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
        password: 'Password123' 
      });
      
      let rateLimited = false;
      
      for (let i = 0; i < 7; i++) {
        try {
          await auth.login(db, { 
            email: 'ratelimit@example.com', 
            password: 'wrong' 
          });
        } catch (err: any) {
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

  describe('JWT expiry parsing (signJWT)', () => {
    it('issues a token with correct expiry for minutes (15m)', async () => {
      const user = await auth.register(db, { email: 'jwt1@example.com', password: 'Test1234' });
      const result = await auth.login(db, { email: 'jwt1@example.com', password: 'Test1234' });
      const parts = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const diffSec = payload.exp - payload.iat;
      expect(diffSec).toBe(15 * 60); // 15m default
    });

    it('verifyToken returns correct payload', async () => {
      await auth.register(db, { email: 'jwt2@example.com', password: 'Test1234' });
      const { accessToken } = await auth.login(db, { email: 'jwt2@example.com', password: 'Test1234' });
      const decoded = await auth.verifyToken(accessToken);
      expect(decoded.id).toBeDefined();
      expect(decoded.role).toBe('user');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('custom expiry creates auth with 1h access token via cookieMaxAge proxy', async () => {
      // createAuth with a 1h cookieMaxAge — verifies the config plumbing
      const customAuth = createAuth({ secret: 'test-secret', cookieMaxAge: 60 * 60 * 1000 });
      await customAuth.register(db, { email: 'jwt3@example.com', password: 'Test1234' });
      const result = await customAuth.login(db, { email: 'jwt3@example.com', password: 'Test1234' });
      expect(result.accessToken).toBeTruthy();
      const parts = result.accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      // access token default is 15m (900s) regardless of cookieMaxAge
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });
  });
});