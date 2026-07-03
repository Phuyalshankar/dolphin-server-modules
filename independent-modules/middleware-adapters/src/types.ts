/**
 * Dolphin Middleware Adapters — Shared Types
 * Express-style (req, res, next) — compatible with Express, Fastify,
 * Next.js, Hono, Koa (via koa-connect), NestJS, and any Node.js framework.
 */

// ─── Express-compatible types (no express dependency needed) ──────────────

export interface DolphinReq {
  method?: string;
  url?: string;
  path?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, any>;
  cookies?: Record<string, string>;
  user?: any;
  [key: string]: any;
}

export interface DolphinRes {
  statusCode?: number;
  status?: (code: number) => DolphinRes;
  json?: (body: any) => void;
  end?: (body?: any) => void;
  setHeader?: (name: string, value: string) => void;
  getHeader?: (name: string) => string | undefined;
  headersSent?: boolean;
  writableEnded?: boolean;
  [key: string]: any;
}

export type NextFn = (err?: any) => void;

/** Standard Express-style middleware — works across all frameworks */
export type DolphinMiddleware = (
  req: DolphinReq,
  res: DolphinRes,
  next: NextFn
) => void | Promise<void>;

// ─── Rate Limit ────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Time window in milliseconds. Default: 60_000 (1 min) */
  windowMs?: number;
  /** Max requests per window per key. Default: 60 */
  max?: number;
  /** Custom key extractor. Default: IP address */
  keyBy?: (req: DolphinReq) => string;
  /** Response message when limited. Default: JSON error */
  message?: string | object;
  /** Optional ioredis client for multi-server/distributed limiting */
  redisClient?: any;
  /** Return true to skip rate limiting for this request */
  skip?: (req: DolphinReq) => boolean;
  /** Add X-RateLimit-* headers. Default: true */
  headers?: boolean;
}

// ─── CORS ──────────────────────────────────────────────────────────────────

export interface CorsOptions {
  /** Allowed origins. '*' = all. Default: '*' */
  origin?: string | string[] | ((origin: string) => boolean);
  /** Allowed methods. Default: GET,HEAD,PUT,PATCH,POST,DELETE */
  methods?: string[];
  /** Allowed request headers */
  allowedHeaders?: string[];
  /** Headers exposed to the browser */
  exposedHeaders?: string[];
  /** Allow cookies/auth headers. Default: false */
  credentials?: boolean;
  /** Preflight cache seconds. Default: 86400 */
  maxAge?: number;
}

// ─── Auth Guard ────────────────────────────────────────────────────────────

export interface AuthGuardOptions {
  /** JWT secret (HS256) */
  secret: string;
  /** Token source. Default: 'header' (Authorization: Bearer ...) */
  tokenFrom?: 'header' | 'cookie' | 'query';
  /** Cookie name when tokenFrom='cookie'. Default: 'token' */
  cookieName?: string;
  /** Query param when tokenFrom='query'. Default: 'token' */
  queryParam?: string;
  /** Paths to exclude from auth check (exact or prefix with *) */
  exclude?: string[];
  /** Require 2FA verification. Default: false */
  require2FA?: boolean;
  /** Custom 401 response body */
  message?: string | object;
}

// ─── Logger ────────────────────────────────────────────────────────────────

export interface LoggerOptions {
  /** 'json' for structured logs, 'pretty' for dev. Default: 'json' */
  format?: 'json' | 'pretty';
  /** Return true to skip logging this request */
  skip?: (req: DolphinReq) => boolean;
  /** Custom output function. Default: process.stdout.write */
  output?: (log: RequestLog) => void;
}

export interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  status: number;
  durationMs: number;
}
