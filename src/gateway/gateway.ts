import http from 'node:http';
import { EventEmitter } from 'node:events';

class LazyWebSocketServer extends EventEmitter {
  private realWss: any = null;
  private pendingEvents: [string | symbol, (...args: any[]) => void][] = [];

  constructor() {
    super();
  }

  private async init() {
    if (this.realWss) return;
    try {
      const wsMod = await import('ws');
      this.realWss = new wsMod.WebSocketServer({ noServer: true, maxPayload: 100 * 1024 * 1024 }); // 100MB max payload
      for (const [event, listener] of this.pendingEvents) {
        this.realWss.on(event, listener);
      }
      this.pendingEvents = [];
    } catch (err) {
      console.warn('⚠️ WebSockets are not supported in this runtime environment.', err);
    }
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (this.realWss) {
      this.realWss.on(event, listener);
    } else {
      this.pendingEvents.push([event, listener]);
    }
    return this;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    if (this.realWss) {
      return this.realWss.emit(event, ...args);
    }
    return super.emit(event, ...args);
  }

  handleUpgrade(request: any, socket: any, head: any, cb: any) {
    this.init().then(() => {
      if (this.realWss) {
        this.realWss.handleUpgrade(request, socket, head, cb);
      } else {
        socket.destroy();
      }
    });
  }

  close() {
    if (this.realWss) {
      this.realWss.close();
    }
  }
}

export interface GatewayRouteOptions {
  routes: { [prefix: string]: string };
}

/**
 * DolphinAPIGateway
 * A lightweight, high-performance API Gateway supporting HTTP stream piping and
 * dynamic WebSocket upgrade tunnel proxying with zero third-party routing dependencies.
 */
export class DolphinAPIGateway {
  private routes: { prefix: string; target: string; isWildcard: boolean }[] = [];
  private server: http.Server | null = null;
  private wss: LazyWebSocketServer | null = null;

  constructor(options: GatewayRouteOptions) {
    // Sort routes by specificity (longer prefixes first) to prevent routing clashes
    const sortedKeys = Object.keys(options.routes).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
      const isWildcard = key.endsWith('*');
      const prefix = isWildcard ? key.slice(0, -1) : key;
      this.routes.push({
        prefix,
        target: options.routes[key].replace(/\/$/, ''),
        isWildcard
      });
    }
  }

  /**
   * Find matching routing rule for the request path.
   */
  private matchRoute(pathname: string) {
    for (const r of this.routes) {
      if (r.isWildcard && pathname.startsWith(r.prefix)) {
        return r;
      }
      if (!r.isWildcard && pathname === r.prefix) {
        return r;
      }
    }
    return null;
  }

  /**
   * Start the API Gateway.
   */
  listen(port: number, host: string = '0.0.0.0', callback?: () => void) {
    this.server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const matched = this.matchRoute(parsedUrl.pathname);

      if (!matched) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Route Not Found' }));
        return;
      }

      // Proxy HTTP Request Streams
      const targetUrl = new URL(matched.target);
      const targetPath = parsedUrl.pathname + parsedUrl.search;

      const proxyReq = http.request({
        host: targetUrl.hostname,
        port: targetUrl.port ? parseInt(targetUrl.port) : (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetPath,
        method: req.method,
        headers: req.headers
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Gateway Proxy Error: ${err.message}` }));
      });

      req.pipe(proxyReq);
    });

    // Handle WebSocket Tunneling
    this.wss = new LazyWebSocketServer();

    this.server.on('upgrade', (request, socket, head) => {
      const { pathname, search } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const matched = this.matchRoute(pathname);

      if (!matched) {
        socket.destroy();
        return;
      }

      this.wss?.handleUpgrade(request, socket, head, async (ws: any) => {
        const targetUrl = new URL(matched.target);
        const wsProtocol = targetUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const targetWsUrl = `${wsProtocol}//${targetUrl.host}${pathname}${search}`;

        const wsMod = await import('ws');
        const WebSocketClass = wsMod.WebSocket || wsMod.default || wsMod;
        const targetWs = new WebSocketClass(targetWsUrl);

        targetWs.on('open', () => {
          // Bidirectional message forwarding
          ws.on('message', (message: any, isBinary: any) => {
            if (targetWs.readyState === WebSocketClass.OPEN) {
              targetWs.send(message, { binary: isBinary });
            }
          });

          targetWs.on('message', (message: any, isBinary: any) => {
            if (ws.readyState === WebSocketClass.OPEN) {
              ws.send(message, { binary: isBinary });
            }
          });
        });

        // Event coordination & active socket cleanup
        ws.on('close', () => targetWs.close());
        targetWs.on('close', () => ws.close());

        ws.on('error', () => targetWs.close());
        targetWs.on('error', () => ws.close());
      });
    });

    this.server.listen(port, host, callback);
    return this.server;
  }

  /**
   * Stop the API Gateway.
   */
  close(callback?: () => void) {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close(callback);
    }
  }
}
