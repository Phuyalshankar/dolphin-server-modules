import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createDolphinRouter } from '../router/router';

export function createDolphinServer(options: { port?: number; host?: string, realtime?: any } = {}) {
  const router = createDolphinRouter();
  const middlewares: any[] = [];
  const wss = new WebSocketServer({ noServer: true });

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
        let result: any;
        const handlers = match.handlers;
        
        for (let i = 0; i < handlers.length; i++) {
          if (res.headersSent || res.writableEnded) break;
          
          const handler = handlers[i];
          await new Promise<void>(async (resolve, reject) => {
            try {
              // If it's a middleware (takes ctx and next)
              if (handler.length >= 2) {
                result = await handler(ctx, resolve);
              } else {
                // If it's a regular handler
                result = await handler(ctx);
                resolve();
              }
            } catch (err) {
              reject(err);
            }
          });
        }

        // If no response sent, send the last handler result or 204
        if (!res.headersSent) {
          if (result !== undefined && result !== null) {
            // Apply status from result if it's a valid number, otherwise use pendingStatus
            const status = (typeof result.status === 'number' && result.status >= 100 && result.status < 600) 
              ? result.status 
              : pendingStatus;
            send(result, 'application/json', status);
          } else {
            send(null, 'application/json', 204);
          }
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

  // --- WebSocket Upgrade Handling ---
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
    
    if (pathname === '/phone' || pathname === '/realtime') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  if (options.realtime) {
    wss.on('connection', (ws, request) => {
      // Automatic device extraction from URL or header (placeholder)
      const deviceId = new URL(request.url!, `http://h`).searchParams.get('deviceId') || 'anonymous';
      
      options.realtime.register(deviceId, ws);
      
      ws.on('message', (data) => {
        options.realtime.handle(data, ws, deviceId);
      });

      ws.on('close', () => options.realtime.unregister(deviceId));
      ws.on('error', () => options.realtime.unregister(deviceId));
    });
  }

  return {
    ...router,
    http: server,
    wss,
    use: (prefixOrMw: string | any, mw?: any) => {
      if (typeof prefixOrMw === 'string' && mw && typeof mw.match === 'function') {
        router.use(prefixOrMw, mw);
      } else {
        middlewares.push(prefixOrMw);
      }
    },
    listen: (port: number = options.port || 3000, callback?: () => void) => {
      return server.listen(port, options.host || '0.0.0.0', callback);
    },
    close: () => server.close()
  };
}