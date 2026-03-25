type Handler = (ctx: any) => Promise<void> | void;

interface Route {
  method: string;
  path: string;
  handler: Handler;
  regex: RegExp;
  keys: string[];
}

export function createDolphinRouter() {
  const routes: Route[] = [];

  const addRoute = (method: string, path: string, handler: Handler) => {
    // Convert /users/:id to regex
    const keys: string[] = [];
    const pattern = path
      .replace(/:([^\/]+)/g, (_, key) => {
        keys.push(key);
        return '([^\\/]+)';
      })
      .replace(/\//g, '\\/');
    
    routes.push({
      method: method.toUpperCase(),
      path,
      handler,
      regex: new RegExp(`^${pattern}$`),
      keys
    });
  };

  return {
    get: (path: string, handler: Handler) => addRoute('GET', path, handler),
    post: (path: string, handler: Handler) => addRoute('POST', path, handler),
    put: (path: string, handler: Handler) => addRoute('PUT', path, handler),
    delete: (path: string, handler: Handler) => addRoute('DELETE', path, handler),
    patch: (path: string, handler: Handler) => addRoute('PATCH', path, handler),

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
}
