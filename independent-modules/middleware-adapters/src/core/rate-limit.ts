import type { RateLimitOptions, DolphinMiddleware, DolphinReq } from '../types.js';

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * rateLimiter()
 * Sliding-window rate limiter. In-memory by default; pass a Redis client
 * for distributed (multi-server) limiting.
 *
 * Works with: Express · Fastify (via @fastify/middie) · Next.js ·
 *             Koa (via koa-connect) · Hono · NestJS · Vanilla Node.js
 *
 * @example
 * // Express
 * app.use(rateLimiter({ max: 100, windowMs: 60_000 }));
 *
 * // Next.js API route
 * const limiter = rateLimiter({ max: 20 });
 * export default function handler(req, res) {
 *   limiter(req, res, () => { res.json({ ok: true }); });
 * }
 *
 * // Fastify
 * await fastify.register(require('@fastify/middie'));
 * fastify.use(rateLimiter({ max: 50 }));
 */
export function rateLimiter(options: RateLimitOptions = {}): DolphinMiddleware {
  const windowMs  = options.windowMs  ?? 60_000;
  const max       = options.max       ?? 60;
  const showHdrs  = options.headers   ?? true;
  const message   = options.message   ?? { error: 'Too many requests, please try again later.' };
  const skip      = options.skip;
  const redis     = options.redisClient ?? null;

  const getIp = (req: DolphinReq): string =>
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.ip
    ?? req.socket?.remoteAddress
    ?? 'unknown';

  const keyBy = options.keyBy ?? getIp;

  // In-memory store
  const store = new Map<string, WindowEntry>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of store) if (now >= e.resetAt) store.delete(k);
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  const incrementMemory = (key: string) => {
    const now = Date.now();
    let e = store.get(key);
    if (!e || now >= e.resetAt) { e = { count: 0, resetAt: now + windowMs }; store.set(key, e); }
    e.count++;
    return e;
  };

  const incrementRedis = async (key: string): Promise<WindowEntry> => {
    const rk = `dolphin:rl:${key}`;
    const now = Date.now();
    const pl  = redis.pipeline();
    pl.incr(rk);
    pl.pexpire(rk, windowMs);
    const [[, count]] = await pl.exec();
    return { count: count as number, resetAt: now + windowMs };
  };

  const sendJson = (res: any, status: number, hdrs: Record<string, string>, body: any) => {
    if (res.headersSent || res.writableEnded) return;
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    if (typeof res.status === 'function') {
      // Express / NestJS / Fastify with plugin
      Object.entries(hdrs).forEach(([k, v]) => res.setHeader?.(k, v));
      res.status(status).json?.(body) ?? res.end(payload);
    } else {
      // Vanilla Node.js / Next.js raw handler
      res.statusCode = status;
      Object.entries(hdrs).forEach(([k, v]) => res.setHeader?.(k, v));
      res.setHeader?.('Content-Type', 'application/json');
      res.end(payload);
    }
  };

  return async (req, res, next) => {
    if (skip?.(req)) return next();

    const key = keyBy(req);
    const { count, resetAt } = redis
      ? await incrementRedis(key)
      : incrementMemory(key);

    const remaining  = Math.max(0, max - count);
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    const hdrs: Record<string, string> = showHdrs ? {
      'X-RateLimit-Limit':     String(max),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
    } : {};

    if (showHdrs) {
      Object.entries(hdrs).forEach(([k, v]) => res.setHeader?.(k, v));
    }

    if (count > max) {
      return sendJson(res, 429, { ...hdrs, 'Retry-After': String(retryAfter) }, message);
    }

    next();
  };
}
