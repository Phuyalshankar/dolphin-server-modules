import http from 'node:http';

/**
 * DolphinRPCServer
 * Exposes service classes dynamically over HTTP with zero configuration.
 */
export class DolphinRPCServer {
  private services = new Map<string, any>();
  private server: http.Server | null = null;

  /**
   * Register a service instance under a specific name.
   */
  register(serviceName: string, serviceInstance: any) {
    this.services.set(serviceName, serviceInstance);
  }

  /**
   * Start the RPC server.
   */
  listen(port: number, host: string = '0.0.0.0', callback?: () => void) {
    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      try {
        const chunks: any[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const bodyStr = Buffer.concat(chunks).toString();
        const payload = JSON.parse(bodyStr);

        const { service, method, args } = payload;
        const instance = this.services.get(service);
        if (!instance) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Service "${service}" not found` }));
          return;
        }

        const fn = instance[method];
        if (typeof fn !== 'function') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Method "${method}" not found on service "${service}"` }));
          return;
        }

        // Invoke the method dynamically with arguments
        const result = await fn.apply(instance, args || []);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    });

    this.server.listen(port, host, callback);
    return this.server;
  }

  /**
   * Stop the RPC server.
   */
  close(callback?: () => void) {
    if (this.server) {
      this.server.close(callback);
    }
  }
}

/**
 * DolphinRPCClient
 * Provides dynamic, Proxy-based invocation of remote service methods with full async support.
 */
export class DolphinRPCClient {
  private host: string;
  private port: number;

  constructor(options: { url?: string; host?: string; port?: number } = {}) {
    if (options.url) {
      const parsed = new URL(options.url);
      this.host = parsed.hostname;
      this.port = parseInt(parsed.port || '80');
    } else {
      this.host = options.host || 'localhost';
      this.port = options.port || 3000;
    }
  }

  /**
   * Obtain a dynamically proxied client for the specified service.
   */
  getService<T = any>(serviceName: string): T {
    return new Proxy({}, {
      get: (target, method: string) => {
        return (...args: any[]) => {
          return new Promise((resolve, reject) => {
            const payload = JSON.stringify({ service: serviceName, method, args });
            
            const req = http.request({
              host: this.host,
              port: this.port,
              path: '/',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            }, (res) => {
              const chunks: any[] = [];
              res.on('data', chunk => chunks.push(chunk));
              res.on('end', () => {
                const responseStr = Buffer.concat(chunks).toString();
                try {
                  const data = JSON.parse(responseStr);
                  if (data.error) {
                    reject(new Error(data.error));
                  } else {
                    resolve(data.result);
                  }
                } catch {
                  reject(new Error(`Failed to parse response: ${responseStr}`));
                }
              });
            });

            req.on('error', (err) => reject(err));
            req.write(payload);
            req.end();
          });
        };
      }
    }) as T;
  }
}
