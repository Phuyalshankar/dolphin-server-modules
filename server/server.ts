import http from 'node:http';
import { createDolphinRouter } from '../router/router';

export function createDolphinServer(options: { port?: number; host?: string } = {}) {
  const router = createDolphinRouter();
  const middlewares: any[] = [];

  const server = http.createServer(async (req: any, res: any) => {
    // Store status for chaining
    let pendingStatus: number = 200;

    // Helper to send response
    const send = (data: any, contentType: string, status?: number) => {
      if (res.headersSent) return;
      const finalStatus = status !== undefined ? status : pendingStatus;
      res.statusCode = finalStatus;
      res.setHeader('Content-Type', contentType);
      
      if (contentType === 'application/json') {
        res.end(JSON.stringify(data));
      } else {
        res.end(String(data));
      }
      pendingStatus = 200; // Reset after send
    };

    // Add response helpers
    res.json = (data: any, status?: number) => send(data, 'application/json', status);
    res.text = (data: any, status?: number) => send(data, 'text/plain', status);
    res.html = (data: any, status?: number) => send(data, 'text/html', status);

    const host = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url!, `http://${host}`);

    const ctx: any = {
      req,
      res,
      params: {},
      query: Object.fromEntries(parsedUrl.searchParams),
      body: {},
      state: {},
      
      json: (data: any, status?: number) => {
        send(data, 'application/json', status);
        return ctx;
      },
      
      text: (data: any, status?: number) => {
        send(data, 'text/plain', status);
        return ctx;
      },
      
      html: (data: any, status?: number) => {
        send(data, 'text/html', status);
        return ctx;
      },
      
      status: (code: number) => {
        pendingStatus = code;
        return ctx;
      },
      
      setHeader: (name: string, value: string) => {
        res.setHeader(name, value);
        return ctx;
      },
      
      getHeader: (name: string) => {
        return req.headers[name.toLowerCase()];
      }
    };

    // Global middleware execution
    for (const mw of middlewares) {
      if (res.writableEnded) return;
      await new Promise(resolve => {
        if (mw.length === 3) {
          mw(req, res, resolve);
        } else {
          mw(ctx, resolve);
        }
      });
    }

    // Body parsing for POST/PUT/PATCH
    const contentType = req.headers['content-type'] || '';
    if (['POST', 'PUT', 'PATCH'].includes(req.method!)) {
      if (contentType.includes('multipart/form-data')) {
        // Handled by third-party middlewares like multer. Just sync to ctx.
        if ((req as any).body) ctx.body = (req as any).body;
        if ((req as any).file) ctx.file = (req as any).file;
        if ((req as any).files) ctx.files = (req as any).files;
      } else {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const rawBody = Buffer.concat(chunks).toString();
        
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(rawBody);
            ctx.body = parsed;
            req.body = parsed;
          } catch {
            ctx.body = {};
            req.body = {};
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const parsed = Object.fromEntries(new URLSearchParams(rawBody));
          ctx.body = parsed;
          req.body = parsed;
        } else {
          ctx.body = rawBody;
          req.body = rawBody;
        }
      }
    }

    // Matching route
    const match = router.match(req.method!, parsedUrl.pathname);
    if (match) {
      ctx.params = match.params;
      req.params = match.params;
      try {
        await match.handler(ctx);
        // If no response sent, send 204
        if (!res.headersSent) {
          send(null, 'application/json', 204);
        }
      } catch (err: any) {
        console.error('Server Handler Error:', err);
        if (!res.headersSent) {
          send({ error: err.message || 'Internal Server Error' }, 'application/json', err.status || 500);
        }
      }
    } else {
      if (!res.headersSent) {
        send({ error: 'Not Found' }, 'application/json', 404);
      }
    }
  });

  return {
    ...router,
    use: (prefixOrMw: string | any, mw?: any) => {
      if (typeof prefixOrMw === 'string' && mw && typeof mw.match === 'function') {
        router.use(prefixOrMw, mw);
      } else {
        middlewares.push(prefixOrMw);
      }
    },
    listen: (port: number = options.port || 3000, callback?: () => void) => {
      server.listen(port, options.host || '0.0.0.0', callback);
    },
    close: () => server.close()
  };
}