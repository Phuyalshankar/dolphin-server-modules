import type { LoggerOptions, DolphinMiddleware, RequestLog } from '../types.js';

const getIp = (req: any): string =>
  (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
  ?? req.ip
  ?? req.socket?.remoteAddress
  ?? 'unknown';

/**
 * requestLogger()
 * Lightweight structured request logger. No dependencies.
 * Hooks into res.end to capture status + duration.
 *
 * @example
 * app.use(requestLogger());                          // JSON (production)
 * app.use(requestLogger({ format: 'pretty' }));     // Colored (dev)
 * app.use(requestLogger({ skip: r => r.url === '/health' })); // skip health
 */
export function requestLogger(options: LoggerOptions = {}): DolphinMiddleware {
  const format = options.format ?? 'json';
  const skip   = options.skip;
  const output = options.output;

  const colors = {
    reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m',
  };

  const methodColor = (m: string) => {
    if (m === 'GET')    return colors.green;
    if (m === 'POST')   return colors.cyan;
    if (m === 'DELETE') return colors.red;
    return colors.yellow;
  };

  const statusColor = (s: number) =>
    s >= 500 ? colors.red : s >= 400 ? colors.yellow : colors.green;

  const write = (log: RequestLog) => {
    if (output) return output(log);

    if (format === 'pretty') {
      const mc = methodColor(log.method);
      const sc = statusColor(log.status);
      process.stdout.write(
        `${colors.gray}${log.timestamp}${colors.reset} ` +
        `${mc}${log.method.padEnd(7)}${colors.reset} ` +
        `${log.path.padEnd(40)} ` +
        `${sc}${log.status}${colors.reset} ` +
        `${colors.gray}${log.durationMs}ms${colors.reset}\n`
      );
    } else {
      process.stdout.write(JSON.stringify(log) + '\n');
    }
  };

  return (req, res, next) => {
    if (skip?.(req as any)) return next();

    const start  = Date.now();
    const method = req.method ?? 'GET';
    const path   = req.path ?? (req.url?.split('?')[0] ?? '/');
    const ip     = getIp(req);

    // Patch res.end to capture status after response is sent
    const originalEnd = res.end?.bind(res);
    if (originalEnd) {
      (res as any).end = (...args: any[]) => {
        const log: RequestLog = {
          timestamp:  new Date().toISOString(),
          method,
          path,
          ip,
          status:     res.statusCode ?? 200,
          durationMs: Date.now() - start,
        };
        write(log);
        return originalEnd(...args);
      };
    }

    next();
  };
}
