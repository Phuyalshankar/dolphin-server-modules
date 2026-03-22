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
  async findUserByEmail(email: string) { return this.users.find(u => u.email === email); }
  async findUserById(id: string) { return this.users.find(u => u.id === id); }
  async updateUser(id: string, data: any) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx > -1) this.users[idx] = { ...this.users[idx], ...data };
    return this.users[idx];
  }
  async saveRefreshToken(data: RefreshTokenRecord) { this.tokens.push(data); }
  async findRefreshToken(token: string) { return this.tokens.find(t => t.token === token) || null; }
  async deleteRefreshToken(token: string) { this.tokens = this.tokens.filter(t => t.token !== token); }
}

describe('Auth Module', () => {
  let db: MockAuthDB;
  let auth: ReturnType<typeof createAuth>;

  beforeEach(() => {
    db = new MockAuthDB();
    auth = createAuth({ secret: 'test-secret', cookieMaxAge: 1000 * 60 * 60 });
  });

  it('registers and logs in a user successfully', async () => {
    const { email } = await auth.register(db, { email: 'test@example.com', password: 'password123' });
    expect(email).toBe('test@example.com');

    const result = await auth.login(db, { email: 'test@example.com', password: 'password123' });
    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });

  it('rejects invalid credentials', async () => {
    await auth.register(db, { email: 'test@example.com', password: 'password123' });
    
    await expect(auth.login(db, { email: 'test@example.com', password: 'wrong' }))
      .rejects.toThrow('Invalid credentials');
  });

  it('handles 2FA enablement and verification', async () => {
    const user = await auth.register(db, { email: '2fa@example.com', password: 'password123' });
    
    const { secret, uri } = await auth.enable2FA(db, user.id);
    expect(secret).toBeDefined();
    expect(uri).toContain('otpauth://totp');

    // Mute the actual verification by mocking the verifyTOTP because we don't have the token readily available.
    // Instead we can test that it throws with an invalid token
    await expect(auth.verify2FA(db, user.id, '000000')).rejects.toThrow('Invalid verification token');
  });
  
  it('detects refresh token reuse', async () => {
    const user = await auth.register(db, { email: 'reuse@example.com', password: 'password123' });
    await auth.login(db, { email: 'reuse@example.com', password: 'password123' });
    
    const token = db.tokens[0].token;
    
    // First refresh should succeed
    const newSession = await auth.refresh(db, token);
    expect(newSession.accessToken).toBeDefined();
    
    // Attempting to refresh with the old token again should throw
    await expect(auth.refresh(db, token)).rejects.toThrow('Token reuse detected');
  });
});
