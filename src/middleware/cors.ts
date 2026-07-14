/**
 * cors() — Universal CORS Middleware for Dolphin Server & Express
 *
 * Dolphin Server मा:
 *   app.use(cors());
 *   app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
 *
 * Express मा:
 *   app.use(cors());
 *   app.use(cors({ origin: ['https://myapp.com', 'http://localhost:5173'] }));
 */

export interface CorsOptions {
  /** Allow गर्ने origin(s). Default: '*'  */
  origin?: string | string[] | ((origin: string) => boolean);
  /** Allow गर्ने HTTP methods. Default: सबै */
  methods?: string[];
  /** Allow गर्ने headers. Default: सबै common headers */
  allowedHeaders?: string[];
  /** credentials (cookies/auth headers) allow गर्ने. Default: false */
  credentials?: boolean;
  /** Preflight cache duration (seconds). Default: 86400 (24h) */
  maxAge?: number;
}

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-dolphin-platform',
  'x-dolphin-key',
];

function resolveOrigin(
  allowed: CorsOptions['origin'],
  requestOrigin: string | undefined
): string {
  if (!allowed || allowed === '*') return '*';
  if (!requestOrigin) return '*';

  if (typeof allowed === 'string') {
    return allowed === requestOrigin ? requestOrigin : '';
  }
  if (Array.isArray(allowed)) {
    return allowed.includes(requestOrigin) ? requestOrigin : '';
  }
  if (typeof allowed === 'function') {
    return allowed(requestOrigin) ? requestOrigin : '';
  }
  return '*';
}

function applyHeaders(
  setHeader: (name: string, value: string) => void,
  options: CorsOptions,
  requestOrigin: string | undefined
) {
  const originValue = resolveOrigin(options.origin, requestOrigin);
  if (originValue) {
    setHeader('Access-Control-Allow-Origin', originValue);
  }

  if (options.credentials) {
    setHeader('Access-Control-Allow-Credentials', 'true');
  }

  setHeader(
    'Access-Control-Allow-Methods',
    (options.methods || DEFAULT_METHODS).join(', ')
  );

  setHeader(
    'Access-Control-Allow-Headers',
    (options.allowedHeaders || DEFAULT_HEADERS).join(', ')
  );

  setHeader(
    'Access-Control-Max-Age',
    String(options.maxAge ?? 86400)
  );

  // Vary header — browser caching को लागि
  if (options.origin && options.origin !== '*') {
    setHeader('Vary', 'Origin');
  }
}

/**
 * cors() factory — Dolphin Server र Express दुवैमा काम गर्छ
 *
 * @example
 * // Dolphin Server
 * import { cors } from 'dolphin-server-modules/middleware/cors';
 * app.use(cors());
 * app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
 *
 * @example
 * // Express
 * import { cors } from 'dolphin-server-modules/middleware/cors';
 * app.use(cors({ origin: ['https://myapp.com', 'http://localhost:5173'] }));
 */
export function cors(options: CorsOptions = {}) {
  // Returns Express-compatible middleware (req, res, next)
  // Dolphin Server ले automatically 3-arg function detect गरेर Express style मा run गर्छ
  return function corsMiddleware(req: any, res: any, next: () => void) {
    const requestOrigin = req.headers?.origin as string | undefined;

    applyHeaders(
      (name, value) => res.setHeader(name, value),
      options,
      requestOrigin
    );

    // OPTIONS preflight request — immediately return
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}
