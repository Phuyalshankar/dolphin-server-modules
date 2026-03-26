export type Handler = (ctx: any) => Promise<void> | void;

export interface Route {
  method: string;
  path: string;
  handler: Handler;
  regex: RegExp;
  keys: string[];
}

export function createDolphinRouter() {
  const routes: Route[] = [];

  const addRoute = (method: string, path: string, handler: Handler) => {
    // Normalize path to remove trailing slashes unless it's just /
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
    
    const keys: string[] = [];
    const pattern = normalizedPath
      .replace(/:([^\/]+)/g, (_, key) => {
        keys.push(key);
        return '([^\\/]+)';
      })
      .replace(/\//g, '\\/');
    
    routes.push({
      method: method.toUpperCase(),
      path: normalizedPath,
      handler,
      regex: new RegExp(`^${pattern}$`),
      keys
    });
  };

  const router = {
    get: (path: string, handler: Handler) => addRoute('GET', path, handler),
    post: (path: string, handler: Handler) => addRoute('POST', path, handler),
    put: (path: string, handler: Handler) => addRoute('PUT', path, handler),
    delete: (path: string, handler: Handler) => addRoute('DELETE', path, handler),
    patch: (path: string, handler: Handler) => addRoute('PATCH', path, handler),
    all: (path: string, handler: Handler) => addRoute('ALL', path, handler),

    /** 
     * Mount a sub-router or middleware.
     * app.use('/auth', authRouter)
     */
    use: (prefix: string, subRouter: any) => {
      if (typeof prefix !== 'string') {
        // Fallback for global middleware handling if needed
        return;
      }

      const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '');
      
      // If subRouter is another Dolphin router, merge its routes
      if (subRouter && typeof subRouter.match === 'function' && subRouter._routes) {
        for (const sr of subRouter._routes) {
            const fullPath = normalizedPrefix + (sr.path === '/' ? '' : sr.path);
            addRoute(sr.method, fullPath || '/', sr.handler);
        }
      }
    },

    // Internal getter for route merging
    _routes: routes,

    match(method: string, url: string) {
      const path = url.split('?')[0];
      const m = method.toUpperCase();

      for (const route of routes) {
        if (route.method !== m && route.method !== 'ALL') continue;
        
        const match = path.match(route.regex);
        if (match) {
          const params: Record<string, string> = {};
          route.keys.forEach((key, i) => {
            params[key] = match[i + 1];
          });
          return { handler: route.handler, params };
        }
      }
      return null;
    }
  };

  return router;
}
