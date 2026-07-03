import crypto from 'node:crypto';
import type { AuthGuardOptions, DolphinMiddleware } from '../types.js';

// ─── Minimal timing-safe JWT verify (HS256, no extra deps) ───────────────

const b64uDecode = (s: string) => Buffer.from(s, 'base64url');

function verifyJWT(token: string, secret: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [hdr, payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret)
    .update(`${hdr}.${payload}`)
    .digest('base64url');

  const sigBuf = b64uDecode(sig);
  const expBuf = b64uDecode(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }

  const decoded = JSON.parse(b64uDecode(payload).toString());
  if (decoded.exp && Date.now() / 1000 > decoded.exp) throw new Error('Token expired');
  return decoded;
}

// ─── Path matching (supports exact + prefix wildcard) ─────────────────────

const isExcluded = (path: string, patterns: string[]): boolean =>
  patterns.some(p => p.endsWith('*') ? path.startsWith(p.slice(0, -1)) : path === p);

/**
 * authGuard()
 * JWT auth guard — attaches verified payload to req.user.
 * Timing-safe verification, no extra dependencies.
 *
 * @example
 * // Express / Fastify / NestJS
 * app.use(authGuard({ secret: process.env.JWT_SECRET }));
 *
 * // Protect specific routes only
 * app.use('/api/admin', authGuard({ secret: JWT_SECRET }));
 *
 * // Next.js App Router middleware.ts
 * const guard = authGuard({ secret: JWT_SECRET, exclude: ['/api/auth/*'] });
 * export function middleware(req, res) { ... }
 *
 * // With cookie
 * authGuard({ secret: JWT_SECRET, tokenFrom: 'cookie', cookieName: 'session' });
 */
export function authGuard(options: AuthGuardOptions): DolphinMiddleware {
  const { secret, require2FA = false } = options;
  const tokenFrom  = options.tokenFrom  ?? 'header';
  const cookieName = options.cookieName ?? 'token';
  const queryParam = options.queryParam ?? 'token';
  const exclude    = options.exclude    ?? [];
  const message    = options.message    ?? { error: 'Unauthorized' };

  const sendUnauth = (res: any, status: number, body: any) => {
    if (res.headersSent || res.writableEnded) return;
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof res.status === 'function') {
      res.status(status).json?.(body) ?? res.end(payload);
    } else {
      res.statusCode = status;
      res.setHeader?.('Content-Type', 'application/json');
      res.end(payload);
    }
  };

  const extractToken = (req: any): string | null => {
    if (tokenFrom === 'header') {
      const auth = req.headers?.['authorization'] ?? req.headers?.['Authorization'];
      if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
    }
    if (tokenFrom === 'cookie') {
      // Works with cookie-parser (req.cookies) or raw header
      const fromParsed = req.cookies?.[cookieName];
      if (fromParsed) return fromParsed;
      const raw = req.headers?.['cookie'] as string | undefined;
      if (raw) {
        const match = raw.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
        if (match) return match[1];
      }
    }
    if (tokenFrom === 'query') {
      return req.query?.[queryParam] ?? null;
    }
    return null;
  };

  return (req, res, next) => {
    const path = req.path ?? req.url?.split('?')[0] ?? '/';

    if (isExcluded(path, exclude)) return next();

    const token = extractToken(req);
    if (!token) return sendUnauth(res, 401, message);

    let decoded: Record<string, any>;
    try {
      decoded = verifyJWT(token, secret);
    } catch {
      return sendUnauth(res, 401, message);
    }

    if (require2FA && decoded.twoFactorVerified !== true) {
      return sendUnauth(res, 403, { error: '2FA verification required' });
    }

    // Attach decoded payload to req.user (works across all frameworks)
    (req as any).user = decoded;
    next();
  };
}
