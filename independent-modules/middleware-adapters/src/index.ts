/**
 * @dolphin/middleware-adapters
 *
 * Framework-agnostic Express-style middleware for Node.js.
 * Works with: Express · Fastify · Next.js · Hono · Koa · NestJS · Vanilla Node.js
 *
 * All middleware follows the standard (req, res, next) signature — the same
 * pattern used by Express and supported natively (or via adapter plugins) by
 * every major Node.js framework.
 *
 * Quick start:
 *   import { rateLimiter, cors, authGuard, requestLogger } from '@dolphin/middleware-adapters';
 *
 *   app.use(requestLogger());
 *   app.use(cors({ origin: 'https://myapp.com', credentials: true }));
 *   app.use(rateLimiter({ max: 100, windowMs: 60_000 }));
 *   app.use(authGuard({ secret: process.env.JWT_SECRET }));
 */

export { rateLimiter }  from './core/rate-limit.js';
export { cors }         from './core/cors.js';
export { authGuard }    from './core/auth-guard.js';
export { requestLogger } from './core/logger.js';

export type {
  DolphinMiddleware,
  DolphinReq,
  DolphinRes,
  NextFn,
  RateLimitOptions,
  CorsOptions,
  AuthGuardOptions,
  LoggerOptions,
  RequestLog,
} from './types.js';
