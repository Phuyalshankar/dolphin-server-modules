import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

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
  private wss: WebSocketServer | null = null;

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
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (request, socket, head) => {
      const { pathname, search } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const matched = this.matchRoute(pathname);

      if (!matched) {
        socket.destroy();
        return;
      }

      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        const targetUrl = new URL(matched.target);
        const wsProtocol = targetUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const targetWsUrl = `${wsProtocol}//${targetUrl.host}${pathname}${search}`;

        const targetWs = new WebSocket(targetWsUrl);

        targetWs.on('open', () => {
          // Bidirectional message forwarding
          ws.on('message', (message, isBinary) => {
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(message, { binary: isBinary });
            }
          });

          targetWs.on('message', (message, isBinary) => {
            if (ws.readyState === WebSocket.OPEN) {
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
