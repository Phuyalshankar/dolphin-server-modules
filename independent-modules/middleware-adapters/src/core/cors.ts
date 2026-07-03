import type { CorsOptions, DolphinMiddleware } from '../types.js';

const DEFAULT_METHODS  = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];
const DEFAULT_HEADERS  = ['Content-Type', 'Authorization'];

/**
 * cors()
 * Flexible CORS middleware — works with every Node.js framework.
 *
 * @example
 * // Express / Fastify / NestJS
 * app.use(cors({ origin: 'https://myapp.com', credentials: true }));
 *
 * // Next.js API route
 * const corsMiddleware = cors({ origin: ['https://a.com', 'https://b.com'] });
 * export default function handler(req, res) {
 *   corsMiddleware(req, res, () => { res.json({ ok: true }); });
 * }
 */
export function cors(options: CorsOptions = {}): DolphinMiddleware {
  const methods     = options.methods       ?? DEFAULT_METHODS;
  const allowHdrs   = options.allowedHeaders ?? DEFAULT_HEADERS;
  const exposeHdrs  = options.exposedHeaders ?? [];
  const credentials = options.credentials    ?? false;
  const maxAge      = options.maxAge         ?? 86400;
  const originOpt   = options.origin         ?? '*';

  const isAllowed = (origin: string): boolean => {
    if (originOpt === '*')           return true;
    if (typeof originOpt === 'function') return originOpt(origin);
    if (Array.isArray(originOpt))    return originOpt.includes(origin);
    return originOpt === origin;
  };

  return (req, res, next) => {
    const origin = req.headers['origin'] as string | undefined;

    const setHdr = (k: string, v: string) => res.setHeader?.(k, v);

    // Determine allowed origin header value
    if (originOpt === '*' && !credentials) {
      setHdr('Access-Control-Allow-Origin', '*');
    } else if (origin && isAllowed(origin)) {
      setHdr('Access-Control-Allow-Origin', origin);
      setHdr('Vary', 'Origin');
    }

    if (credentials) {
      setHdr('Access-Control-Allow-Credentials', 'true');
    }

    if (exposeHdrs.length) {
      setHdr('Access-Control-Expose-Headers', exposeHdrs.join(', '));
    }

    // Preflight
    if (req.method === 'OPTIONS') {
      setHdr('Access-Control-Allow-Methods', methods.join(', '));
      setHdr('Access-Control-Allow-Headers', allowHdrs.join(', '));
      setHdr('Access-Control-Max-Age', String(maxAge));
      res.statusCode = 204;
      res.end?.('');
      return;
    }

    next();
  };
}
