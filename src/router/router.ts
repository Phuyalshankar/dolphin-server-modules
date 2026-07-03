import { z } from 'zod';

export type UnwrapSchema<S> = S extends z.ZodSchema<infer T> ? T : any;

export interface RouteOptions<
  P extends z.ZodSchema<any> = any,
  Q extends z.ZodSchema<any> = any,
  B extends z.ZodSchema<any> = any
> {
  schema?: {
    params?: P;
    query?: Q;
    body?: B;
  };
}

export interface DolphinContext<
  Params = any,
  Query = any,
  Body = any,
  State = any
> {
  req: any;
  res: any;
  params: Params;
  query: Query;
  body: Body;
  state: State;
  json: (data: any, status?: number) => this;
  text: (data: any, status?: number) => this;
  html: (data: any, status?: number) => this;
  status: (code: number) => this;
  setHeader: (name: string, value: string) => this;
  getHeader: (name: string) => string | undefined;
}

export type Handler<
  Params = any,
  Query = any,
  Body = any,
  State = any
> = (
  ctx: DolphinContext<Params, Query, Body, State>,
  next?: Function
) => Promise<any> | any;

export interface Route {
  method: string;
  path: string;
  handlers: Handler[];
  schema?: any;
}

class TrieNode {
  segment: string = '';
  isParam: boolean = false;
  paramName: string = '';
  isWildcard: boolean = false;

  children = new Map<string, TrieNode>();
  paramChild: TrieNode | null = null;
  wildcardChild: TrieNode | null = null;

  // Stores handlers and schemas for methods, e.g., GET, POST, ALL
  handlers = new Map<string, { handlers: Handler[]; schema?: any }>();
}

export function createDolphinRouter() {
  const root = new TrieNode();
  const routes: Route[] = [];

  const addRoute = (
    method: string,
    path: string,
    optsOrHandler: RouteOptions | Handler,
    ...restHandlers: Handler[]
  ) => {
    let schema: any = undefined;
    let handlers: Handler[] = [];

    // Parse options vs handler signature
    if (typeof optsOrHandler === 'object' && optsOrHandler !== null && !('req' in optsOrHandler)) {
      schema = (optsOrHandler as RouteOptions).schema;
      handlers = restHandlers;
    } else {
      handlers = [optsOrHandler as Handler, ...restHandlers];
    }

    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
    const m = method.toUpperCase();

    // Maintain flat routes list for subrouter .use() compatibility
    routes.push({
      method: m,
      path: normalizedPath,
      handlers,
      schema,
    });

    // Split path into segments
    const segments = normalizedPath.split('/').filter(Boolean);
    let curr = root;

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        if (!curr.paramChild) {
          const node = new TrieNode();
          node.segment = segment;
          node.isParam = true;
          node.paramName = segment.slice(1);
          curr.paramChild = node;
        }
        curr = curr.paramChild;
      } else if (segment === '*' || segment.startsWith('*')) {
        if (!curr.wildcardChild) {
          const node = new TrieNode();
          node.segment = segment;
          node.isWildcard = true;
          curr.wildcardChild = node;
        }
        curr = curr.wildcardChild;
        break; // Wildcard matches all remaining path parts
      } else {
        if (!curr.children.has(segment)) {
          const node = new TrieNode();
          node.segment = segment;
          curr.children.set(segment, node);
        }
        curr = curr.children.get(segment)!;
      }
    }

    curr.handlers.set(m, { handlers, schema });
  };

  const router = {
    get<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('GET', path, optsOrHandler as any, ...handlers);
      return router;
    },

    post<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('POST', path, optsOrHandler as any, ...handlers);
      return router;
    },

    put<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('PUT', path, optsOrHandler as any, ...handlers);
      return router;
    },

    delete<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('DELETE', path, optsOrHandler as any, ...handlers);
      return router;
    },

    patch<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('PATCH', path, optsOrHandler as any, ...handlers);
      return router;
    },

    all<
      P extends z.ZodSchema<any> = any,
      Q extends z.ZodSchema<any> = any,
      B extends z.ZodSchema<any> = any
    >(
      path: string,
      optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>,
      ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]
    ) {
      addRoute('ALL', path, optsOrHandler as any, ...handlers);
      return router;
    },

    use(prefix: string, subRouter: any) {
      if (typeof prefix !== 'string') {
        return router;
      }
      const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '');
      if (subRouter && typeof subRouter.match === 'function' && subRouter._routes) {
        for (const sr of subRouter._routes) {
          const fullPath = normalizedPrefix + (sr.path === '/' ? '' : sr.path);
          addRoute(sr.method, fullPath || '/', { schema: sr.schema }, ...sr.handlers);
        }
      }
      return router;
    },

    _routes: routes,

    match(method: string, path: string) {
      const urlPath = path.split('?')[0];
      const segments = urlPath.split('/').filter(Boolean);
      const m = method.toUpperCase();

      const search = (
        node: TrieNode,
        idx: number,
        currentParams: Record<string, string>
      ): { handlers: Handler[]; schema?: any; params: Record<string, string> } | null => {
        if (idx === segments.length) {
          const routeData = node.handlers.get(m) || node.handlers.get('ALL');
          if (routeData) {
            return {
              handlers: routeData.handlers,
              schema: routeData.schema,
              params: currentParams,
            };
          }
          if (node.wildcardChild) {
            const wildcardData = node.wildcardChild.handlers.get(m) || node.wildcardChild.handlers.get('ALL');
            if (wildcardData) {
              return {
                handlers: wildcardData.handlers,
                schema: wildcardData.schema,
                params: currentParams,
              };
            }
          }
          return null;
        }

        const segment = segments[idx];

        // 1. Static match
        if (node.children.has(segment)) {
          const res = search(node.children.get(segment)!, idx + 1, currentParams);
          if (res) return res;
        }

        // 2. Param match
        if (node.paramChild) {
          const nextParams = { ...currentParams, [node.paramChild.paramName]: segment };
          const res = search(node.paramChild, idx + 1, nextParams);
          if (res) return res;
        }

        // 3. Wildcard match
        if (node.wildcardChild) {
          const wildcardData = node.wildcardChild.handlers.get(m) || node.wildcardChild.handlers.get('ALL');
          if (wildcardData) {
            const rest = segments.slice(idx).join('/');
            const nextParams = { ...currentParams, '*': rest };
            return {
              handlers: wildcardData.handlers,
              schema: wildcardData.schema,
              params: nextParams,
            };
          }
        }

        return null;
      };

      if (segments.length === 0) {
        const routeData = root.handlers.get(m) || root.handlers.get('ALL');
        if (routeData) {
          return {
            handlers: routeData.handlers,
            schema: routeData.schema,
            params: {},
          };
        }
        if (root.wildcardChild) {
          const wildcardData = root.wildcardChild.handlers.get(m) || root.wildcardChild.handlers.get('ALL');
          if (wildcardData) {
            return {
              handlers: wildcardData.handlers,
              schema: wildcardData.schema,
              params: { '*': '' },
            };
          }
        }
        return null;
      }

      return search(root, 0, {});
    }
  };

  return router;
}
