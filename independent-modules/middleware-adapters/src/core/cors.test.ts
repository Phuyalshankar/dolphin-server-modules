import { cors } from '../index.js';

const req = (origin?: string, method = 'GET') => ({
  method, url: '/test', path: '/test',
  headers: origin ? { origin } : {} as any,
});

const mockRes = () => {
  const h: Record<string, string> = {};
  let code = 200; let ended = false;
  return {
    get statusCode() { return code; }, set statusCode(v) { code = v; },
    setHeader: (k: string, v: string) => { h[k] = v; },
    end: () => { ended = true; },
    _hdrs: h, _ended: () => ended,
  };
};

const next = jest.fn();
beforeEach(() => next.mockClear());

describe('cors', () => {
  test('allows all origins by default', () => {
    const mw = cors();
    const res = mockRes();
    mw(req('https://example.com') as any, res as any, next);
    expect(res._hdrs['Access-Control-Allow-Origin']).toBe('*');
    expect(next).toHaveBeenCalled();
  });

  test('allows specific origin', () => {
    const mw = cors({ origin: 'https://allowed.com' });
    const res = mockRes();
    mw(req('https://allowed.com') as any, res as any, next);
    expect(res._hdrs['Access-Control-Allow-Origin']).toBe('https://allowed.com');
  });

  test('blocks disallowed origin', () => {
    const mw = cors({ origin: 'https://allowed.com' });
    const res = mockRes();
    mw(req('https://bad.com') as any, res as any, next);
    expect(res._hdrs['Access-Control-Allow-Origin']).toBeUndefined();
  });

  test('handles preflight OPTIONS', () => {
    const mw = cors();
    const res = mockRes();
    mw(req('https://x.com', 'OPTIONS') as any, res as any, next);
    expect(res.statusCode).toBe(204);
    expect(res._ended()).toBe(true);
    expect(res._hdrs['Access-Control-Allow-Methods']).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  test('sets credentials header', () => {
    const mw = cors({ origin: 'https://app.com', credentials: true });
    const res = mockRes();
    mw(req('https://app.com') as any, res as any, next);
    expect(res._hdrs['Access-Control-Allow-Credentials']).toBe('true');
  });

  test('supports array of origins', () => {
    const mw = cors({ origin: ['https://a.com', 'https://b.com'] });
    const r1 = mockRes(); const r2 = mockRes(); const r3 = mockRes();
    mw(req('https://a.com') as any, r1 as any, next);
    mw(req('https://b.com') as any, r2 as any, next);
    mw(req('https://c.com') as any, r3 as any, next);
    expect(r1._hdrs['Access-Control-Allow-Origin']).toBe('https://a.com');
    expect(r2._hdrs['Access-Control-Allow-Origin']).toBe('https://b.com');
    expect(r3._hdrs['Access-Control-Allow-Origin']).toBeUndefined();
  });

  test('supports function origin', () => {
    const mw = cors({ origin: (o) => o.endsWith('.trusted.com') });
    const r1 = mockRes(); const r2 = mockRes();
    mw(req('https://api.trusted.com') as any, r1 as any, next);
    mw(req('https://evil.com') as any, r2 as any, next);
    expect(r1._hdrs['Access-Control-Allow-Origin']).toBe('https://api.trusted.com');
    expect(r2._hdrs['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
