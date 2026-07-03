/**
 * Serverless Adapter for Dolphin Server Modules
 * 
 * DolphinServer को handler AWS Lambda, Vercel Edge Functions,
 * र Cloudflare Workers मा run गर्न मिल्ने बनाउँछ।
 * 
 * Usage:
 *   import { toLambda, toVercel, toCloudflare } from 'dolphin-server-modules/adapters/serverless';
 *   import { createDolphinServer } from 'dolphin-server-modules/server';
 * 
 *   const app = createDolphinServer();
 *   app.get('/hello', (ctx) => ctx.json({ hello: 'world' }));
 * 
 *   // AWS Lambda
 *   export const handler = toLambda(app);
 * 
 *   // Vercel
 *   export default toVercel(app);
 * 
 *   // Cloudflare Workers
 *   export default toCloudflare(app);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServerlessContext {
  /** Original platform-specific event object */
  event?: any;
  /** Lambda context / Vercel RequestContext / etc. */
  platformContext?: any;
}

// ─── Body Parser ─────────────────────────────────────────────────────────────

function parseBody(body: string | null | undefined, contentType: string = ''): any {
  if (!body) return {};
  try {
    if (contentType.includes('application/json')) return JSON.parse(body);
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(body).entries());
    }
    return JSON.parse(body);
  } catch {
    return {};
  }
}

// ─── Dolphin App Handler (shared core) ───────────────────────────────────────

/**
 * Internal: run a dolphin app against a normalised request, collect response.
 */
async function runDolphinApp(
  app: any,
  method: string,
  path: string,
  headers: Record<string, string>,
  body: any,
  query: Record<string, string>,
  serverlessCtx: ServerlessContext = {}
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let responseStatus = 200;
  let responseBody = '';
  let responseSent = false;

  const send = (data: any, contentType: string, status: number) => {
    if (responseSent) return;
    responseSent = true;
    responseStatus = status;
    responseHeaders['Content-Type'] = contentType;
    responseBody = contentType === 'application/json' ? JSON.stringify(data) : String(data);
  };

  // Minimal mock of Node.js IncomingMessage
  const req: any = {
    method: method.toUpperCase(),
    url: path + (Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''),
    headers,
    serverless: serverlessCtx,
    socket: { remoteAddress: headers['x-forwarded-for'] ?? '127.0.0.1' },
  };

  // Minimal mock of Node.js ServerResponse
  const res: any = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader: (name: string, value: string) => { responseHeaders[name.toLowerCase()] = value; },
    getHeader: (name: string) => responseHeaders[name.toLowerCase()],
    removeHeader: (name: string) => { delete responseHeaders[name.toLowerCase()]; },
    writeHead: (status: number, hdrs?: Record<string, string>) => {
      responseStatus = status;
      if (hdrs) Object.assign(responseHeaders, hdrs);
    },
    end: (data?: any) => {
      if (responseSent) return;
      responseSent = true;
      res.writableEnded = true;
      if (data) responseBody = String(data);
    },
    write: (data: any) => { responseBody += String(data); },
    json: (data: any, status?: number) => send(data, 'application/json', status ?? responseStatus),
    text: (data: any, status?: number) => send(data, 'text/plain', status ?? responseStatus),
    status: (code: number) => { responseStatus = code; return res; },
  };

  const ctx: any = {
    req,
    res,
    params: {},
    query,
    body,
    state: {},
    serverless: serverlessCtx,

    json: (data: any, status?: number) => {
      send(data, 'application/json', status ?? responseStatus);
      return ctx;
    },
    text: (data: any, status?: number) => {
      send(data, 'text/plain', status ?? responseStatus);
      return ctx;
    },
    html: (data: any, status?: number) => {
      send(data, 'text/html', status ?? responseStatus);
      return ctx;
    },
    status: (code: number) => {
      responseStatus = code;
      return ctx;
    },
    setHeader: (name: string, value: string) => {
      responseHeaders[name.toLowerCase()] = value;
      return ctx;
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
  };

  // Match route and run handlers
  const matched = app.match?.(method, path);
  if (!matched) {
    return { statusCode: 404, headers: responseHeaders, body: JSON.stringify({ error: 'Not Found' }) };
  }

  ctx.params = matched.params ?? {};

  for (const handler of matched.handlers) {
    if (responseSent) break;
    const result = await handler(ctx);
    if (result !== undefined && result !== null && !responseSent) {
      ctx.json(result);
    }
  }

  if (!responseSent) {
    responseBody = JSON.stringify({ error: 'No response from handler' });
    responseStatus = 500;
  }

  return { statusCode: responseStatus, headers: responseHeaders, body: responseBody };
}

// ─── AWS Lambda ───────────────────────────────────────────────────────────────

/**
 * toLambda()
 * Wraps a Dolphin app as an AWS Lambda handler.
 * Compatible with Lambda Function URLs, API Gateway v1, and API Gateway v2.
 * 
 * @example
 * // handler.ts
 * const app = createDolphinServer();
 * app.get('/hello', (ctx) => ctx.json({ hello: 'world' }));
 * export const handler = toLambda(app);
 */
export function toLambda(app: any) {
  return async (event: any, context: any) => {
    // Support both API Gateway v1 (requestContext.httpMethod) and v2 (requestContext.http.method)
    const method =
      event.httpMethod ??
      event.requestContext?.http?.method ??
      event.requestContext?.httpMethod ??
      'GET';

    // Path: API GW v2 uses rawPath, v1 uses path
    const path = event.rawPath ?? event.path ?? '/';

    // Query params
    const query: Record<string, string> = {};
    if (event.queryStringParameters) {
      Object.assign(query, event.queryStringParameters);
    }
    if (event.rawQueryString) {
      for (const [k, v] of new URLSearchParams(event.rawQueryString)) {
        query[k] = v;
      }
    }

    // Headers (lowercase)
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(event.headers ?? {})) {
      headers[k.toLowerCase()] = String(v);
    }

    // Body
    let rawBody = event.body ?? '';
    if (event.isBase64Encoded && rawBody) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    }
    const body = parseBody(rawBody, headers['content-type']);

    const result = await runDolphinApp(app, method, path, headers, body, query, {
      event,
      platformContext: context,
    });

    return {
      statusCode: result.statusCode,
      headers: result.headers,
      body: result.body,
      // API Gateway v2 multiValueHeaders not needed when using headers
    };
  };
}

// ─── Vercel Edge / Serverless Functions ──────────────────────────────────────

/**
 * toVercel()
 * Wraps a Dolphin app as a Vercel Serverless Function handler (Node.js runtime).
 * Also compatible with Next.js API routes.
 * 
 * @example
 * // api/hello.ts (Vercel / Next.js pages/api)
 * const app = createDolphinServer();
 * app.get('/api/hello', (ctx) => ctx.json({ hello: 'world' }));
 * export default toVercel(app);
 */
export function toVercel(app: any) {
  return async (req: any, res: any) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`);
    const path = url.pathname;

    const query: Record<string, string> = {};
    for (const [k, v] of url.searchParams) query[k] = v;
    // Also use pre-parsed query from Next.js
    if (req.query && typeof req.query === 'object') {
      Object.assign(query, req.query);
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers ?? {})) {
      headers[k.toLowerCase()] = String(v);
    }

    const body = req.body ?? {};

    const result = await runDolphinApp(app, method, path, headers, body, query, {
      event: req,
      platformContext: res,
    });

    res.status(result.statusCode);
    for (const [k, v] of Object.entries(result.headers)) {
      res.setHeader(k, v);
    }
    res.end(result.body);
  };
}

// ─── Cloudflare Workers ───────────────────────────────────────────────────────

/**
 * toCloudflare()
 * Wraps a Dolphin app as a Cloudflare Workers fetch handler.
 * Compatible with Cloudflare Pages Functions as well.
 * 
 * @example
 * // worker.ts
 * const app = createDolphinServer();
 * app.get('/hello', (ctx) => ctx.json({ hello: 'world' }));
 * 
 * export default toCloudflare(app);
 * 
 * // Cloudflare Pages Function
 * export const onRequest = toCloudflare(app);
 */
export function toCloudflare(app: any) {
  const fetchHandler = {
    async fetch(request: Request, env?: any, ctx?: any): Promise<Response> {
      const url = new URL(request.url);
      const method = request.method;
      const path = url.pathname;

      const query: Record<string, string> = {};
      for (const [k, v] of url.searchParams) query[k] = v;

      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

      let body: any = {};
      try {
        const contentType = headers['content-type'] ?? '';
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          if (contentType.includes('application/json')) {
            body = await request.json();
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await request.text();
            body = Object.fromEntries(new URLSearchParams(text).entries());
          }
        }
      } catch { body = {}; }

      const result = await runDolphinApp(app, method, path, headers, body, query, {
        event: request,
        platformContext: { env, ctx },
      });

      return new Response(result.body, {
        status: result.statusCode,
        headers: result.headers,
      });
    },
  };

  // Also support Cloudflare Pages onRequest format
  const pagesHandler = async (context: any): Promise<Response> => {
    return fetchHandler.fetch(context.request, context.env, context);
  };

  // Support both: default export (Workers) and named onRequest (Pages)
  (fetchHandler as any).onRequest = pagesHandler;

  return fetchHandler;
}

// ─── Generic HTTP Handler ─────────────────────────────────────────────────────

/**
 * toNodeHandler()
 * Wraps a Dolphin app as a standard Node.js (req, res) handler.
 * Useful for any Node-based serverless runtime (Netlify Functions, etc.)
 * 
 * @example
 * import { createServer } from 'http';
 * const app = createDolphinServer();
 * const server = createServer(toNodeHandler(app));
 */
export function toNodeHandler(app: any) {
  return async (req: any, res: any) => {
    const host = req.headers?.host ?? 'localhost';
    const url = new URL(req.url ?? '/', `http://${host}`);
    const method = req.method ?? 'GET';
    const path = url.pathname;

    const query: Record<string, string> = {};
    for (const [k, v] of url.searchParams) query[k] = v;

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers ?? {})) {
      headers[k.toLowerCase()] = String(v);
    }

    // Read body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const body = parseBody(rawBody, headers['content-type']);

    const result = await runDolphinApp(app, method, path, headers, body, query);

    res.statusCode = result.statusCode;
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
    res.end(result.body);
  };
}
