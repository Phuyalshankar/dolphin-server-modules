import crypto from 'node:crypto';
import { authGuard } from '../index.js';

const SECRET = 'test-secret-key-minimum-32-chars!!';

const b64u = (s: string) => Buffer.from(s).toString('base64url');

function makeToken(payload: object, secret = SECRET, expOffset = 3600): string {
  const hdr = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const pl  = b64u(JSON.stringify({ ...payload, iat: now, exp: now + expOffset }));
  const sig = crypto.createHmac('sha256', secret).update(`${hdr}.${pl}`).digest('base64url');
  return `${hdr}.${pl}.${sig}`;
}

const mockRes = () => {
  let code = 200; let body: any = null;
  return {
    get statusCode() { return code; }, set statusCode(v) { code = v; },
    headersSent: false, writableEnded: false,
    setHeader: jest.fn(),
    end: (b?: any) => { body = b; },
    status: function(s: number) { code = s; return this; },
    json: function(b: any) { body = b; return this; },
    _body: () => body,
  };
};

const req = (token?: string, path = '/api/data') => ({
  method: 'GET', url: path, path,
  headers: token ? { authorization: `Bearer ${token}` } : {} as any,
  query: {},
});

const next = jest.fn();
beforeEach(() => next.mockClear());

describe('authGuard', () => {
  test('passes valid token and sets req.user', () => {
    const mw = authGuard({ secret: SECRET });
    const token = makeToken({ id: '123', role: 'user' });
    const r = req(token) as any;
    mw(r, mockRes() as any, next);
    expect(next).toHaveBeenCalled();
    expect(r.user).toMatchObject({ id: '123', role: 'user' });
  });

  test('blocks missing token', () => {
    const mw = authGuard({ secret: SECRET });
    const res = mockRes();
    mw(req() as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('blocks wrong secret', () => {
    const mw = authGuard({ secret: SECRET });
    const token = makeToken({ id: '1' }, 'wrong-secret-32-chars-xxxxxxxxxx');
    const res = mockRes();
    mw(req(token) as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('blocks expired token', () => {
    const mw = authGuard({ secret: SECRET });
    const token = makeToken({ id: '1' }, SECRET, -100); // expired
    const res = mockRes();
    mw(req(token) as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('excludes paths correctly', () => {
    const mw = authGuard({ secret: SECRET, exclude: ['/public', '/api/auth/*'] });
    const res1 = mockRes(); const res2 = mockRes(); const res3 = mockRes();
    mw(req(undefined, '/public') as any, res1 as any, next);
    mw(req(undefined, '/api/auth/login') as any, res2 as any, next);
    mw(req(undefined, '/api/data') as any, res3 as any, next);
    expect(next).toHaveBeenCalledTimes(2); // public + auth/* excluded
    expect(res3.statusCode).toBe(401);     // /api/data not excluded → blocked
  });

  test('blocks when 2FA not verified', () => {
    const mw = authGuard({ secret: SECRET, require2FA: true });
    const token = makeToken({ id: '1', twoFactorVerified: false });
    const res = mockRes();
    mw(req(token) as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('passes when 2FA verified', () => {
    const mw = authGuard({ secret: SECRET, require2FA: true });
    const token = makeToken({ id: '1', twoFactorVerified: true });
    mw(req(token) as any, mockRes() as any, next);
    expect(next).toHaveBeenCalled();
  });

  test('reads token from cookie', () => {
    const mw = authGuard({ secret: SECRET, tokenFrom: 'cookie', cookieName: 'session' });
    const token = makeToken({ id: '42' });
    const r = { method: 'GET', path: '/api', url: '/api', headers: { cookie: `session=${token}` }, query: {} };
    mw(r as any, mockRes() as any, next);
    expect(next).toHaveBeenCalled();
  });
});
