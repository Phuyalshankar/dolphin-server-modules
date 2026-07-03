import { rateLimiter } from '../index.js';

const mockReq = (ip = '1.2.3.4') => ({
  method: 'GET', url: '/test', path: '/test',
  headers: { 'x-forwarded-for': ip } as any,
  ip,
});

const mockRes = () => {
  const hdrs: Record<string, string> = {};
  let code = 200; let body: any = null;
  return {
    get statusCode() { return code; },
    set statusCode(v: number) { code = v; },
    headersSent: false, writableEnded: false,
    setHeader: (k: string, v: string) => { hdrs[k] = v; },
    getHeader: (k: string) => hdrs[k],
    end: (b?: any) => { body = b; },
    status: function(s: number) { code = s; return this; },
    json: function(b: any) { body = b; return this; },
    _hdrs: hdrs, _body: () => body,
  };
};

const next = jest.fn();

beforeEach(() => next.mockClear());

describe('rateLimiter', () => {
  test('passes request under limit', async () => {
    const mw = rateLimiter({ max: 5, windowMs: 60_000 });
    const req = mockReq('10.0.0.1'); const res = mockRes();
    await mw(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('blocks after exceeding max', async () => {
    const mw = rateLimiter({ max: 3, windowMs: 60_000 });
    const req = mockReq('10.0.0.2'); 
    for (let i = 0; i < 3; i++) await mw(req as any, mockRes() as any, next);
    next.mockClear();
    const res = mockRes();
    await mw(req as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  test('sets X-RateLimit headers', async () => {
    const mw = rateLimiter({ max: 10, windowMs: 60_000 });
    const req = mockReq('10.0.0.3'); const res = mockRes();
    await mw(req as any, res as any, next);
    expect(res._hdrs['X-RateLimit-Limit']).toBe('10');
    expect(res._hdrs['X-RateLimit-Remaining']).toBeDefined();
  });

  test('skip function bypasses limiting', async () => {
    const mw = rateLimiter({ max: 1, windowMs: 60_000, skip: () => true });
    const req = mockReq('10.0.0.4');
    for (let i = 0; i < 5; i++) { next.mockClear(); await mw(req as any, mockRes() as any, next); expect(next).toHaveBeenCalled(); }
  });

  test('custom keyBy per user', async () => {
    const mw = rateLimiter({ max: 2, windowMs: 60_000, keyBy: (r: any) => r.headers['x-user-id'] });
    const r1 = { ...mockReq(), headers: { 'x-user-id': 'u1' } };
    const r2 = { ...mockReq(), headers: { 'x-user-id': 'u2' } };
    await mw(r1 as any, mockRes() as any, next);
    await mw(r1 as any, mockRes() as any, next);
    await mw(r1 as any, mockRes() as any, next);
    const res2 = mockRes();
    next.mockClear();
    await mw(r2 as any, res2 as any, next);
    expect(next).toHaveBeenCalled(); // u2 not limited
  });
});
