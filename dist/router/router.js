class TrieNode {
    segment = '';
    isParam = false;
    paramName = '';
    isWildcard = false;
    children = new Map();
    paramChild = null;
    wildcardChild = null;
    // Stores handlers and schemas for methods, e.g., GET, POST, ALL
    handlers = new Map();
}
export function createDolphinRouter() {
    const root = new TrieNode();
    const routes = [];
    const addRoute = (method, path, optsOrHandler, ...restHandlers) => {
        let schema = undefined;
        let handlers = [];
        // Parse options vs handler signature
        if (typeof optsOrHandler === 'object' && optsOrHandler !== null && !('req' in optsOrHandler)) {
            schema = optsOrHandler.schema;
            handlers = restHandlers;
        }
        else {
            handlers = [optsOrHandler, ...restHandlers];
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
            }
            else if (segment === '*' || segment.startsWith('*')) {
                if (!curr.wildcardChild) {
                    const node = new TrieNode();
                    node.segment = segment;
                    node.isWildcard = true;
                    curr.wildcardChild = node;
                }
                curr = curr.wildcardChild;
                break; // Wildcard matches all remaining path parts
            }
            else {
                if (!curr.children.has(segment)) {
                    const node = new TrieNode();
                    node.segment = segment;
                    curr.children.set(segment, node);
                }
                curr = curr.children.get(segment);
            }
        }
        curr.handlers.set(m, { handlers, schema });
    };
    const router = {
        get(path, optsOrHandler, ...handlers) {
            addRoute('GET', path, optsOrHandler, ...handlers);
            return router;
        },
        post(path, optsOrHandler, ...handlers) {
            addRoute('POST', path, optsOrHandler, ...handlers);
            return router;
        },
        put(path, optsOrHandler, ...handlers) {
            addRoute('PUT', path, optsOrHandler, ...handlers);
            return router;
        },
        delete(path, optsOrHandler, ...handlers) {
            addRoute('DELETE', path, optsOrHandler, ...handlers);
            return router;
        },
        patch(path, optsOrHandler, ...handlers) {
            addRoute('PATCH', path, optsOrHandler, ...handlers);
            return router;
        },
        all(path, optsOrHandler, ...handlers) {
            addRoute('ALL', path, optsOrHandler, ...handlers);
            return router;
        },
        use(prefix, subRouter) {
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
        match(method, path) {
            const urlPath = path.split('?')[0];
            const segments = urlPath.split('/').filter(Boolean);
            const m = method.toUpperCase();
            const search = (node, idx, currentParams) => {
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
                    const res = search(node.children.get(segment), idx + 1, currentParams);
                    if (res)
                        return res;
                }
                // 2. Param match
                if (node.paramChild) {
                    const nextParams = { ...currentParams, [node.paramChild.paramName]: segment };
                    const res = search(node.paramChild, idx + 1, nextParams);
                    if (res)
                        return res;
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
//# sourceMappingURL=router.js.map