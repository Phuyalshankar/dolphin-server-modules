import http from 'node:http';
import { createDolphinRouter } from '../router/router';

export function createDolphinServer(options: { port?: number; host?: string } = {}) {
  const router = createDolphinRouter();
  const middlewares: any[] = [];

  const server = http.createServer(async (req: any, res: any) => {
    // Utility for JSON responses
    res.json = (data: any, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url!, `http://${host}`);

    const ctx: any = {
      req,
      res,
      params: {},
      query: Object.fromEntries(parsedUrl.searchParams),
      body: {},
      state: {},
      json: res.json,
      status: (code: number) => {
        res.statusCode = code;
        return ctx;
      }
    };

    // Global middleware execution
    for (const mw of middlewares) {
      if (res.writableEnded) return;
      await new Promise(resolve => {
        if (mw.length === 3) {
          mw(req, res, resolve); // Native Express signature
        } else {
          mw(ctx, resolve); // Dolphin Context signature
        }
      });
    }

    // Body parsing for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method!) && req.headers['content-type']?.includes('application/json')) {
      const chunks: any[] = [];
      for await (const chunk of req) chunks.push(chunk);
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString());
        ctx.body = parsed;
        req.body = parsed; // Standard Express compatibility
      } catch {
        ctx.body = {};
        req.body = {};
      }
    }

    // Matching route
    const match = router.match(req.method!, parsedUrl.pathname);
    if (match) {
      ctx.params = match.params;
      req.params = match.params; // Standard Express compatibility
      try {
        await match.handler(ctx);
      } catch (err: any) {
        console.error('Server Handler Error:', err);
        ctx.json({ error: err.message || 'Internal Server Error' }, err.status || 500);
      }
    } else {
      ctx.json({ error: 'Not Found' }, 404);
    }
  });

  return {
    ...router, // Mixin router methods (get, post, etc.)
    use: (mw: any) => middlewares.push(mw),
    listen: (port: number = options.port || 3000, callback?: () => void) => {
      server.listen(port, options.host || '0.0.0.0', callback);
    },
    close: () => server.close()
  };
}
