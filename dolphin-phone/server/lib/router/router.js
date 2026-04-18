"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDolphinRouter = createDolphinRouter;
function createDolphinRouter() {
    const routes = [];
    const addRoute = (method, path, ...handlers) => {
        // Normalize path to remove trailing slashes unless it's just /
        const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
        const keys = [];
        const pattern = normalizedPath
            .replace(/:([^\/]+)/g, (_, key) => {
            keys.push(key);
            return '([^\\/]+)';
        })
            .replace(/\//g, '\\/');
        routes.push({
            method: method.toUpperCase(),
            path: normalizedPath,
            handlers,
            regex: new RegExp(`^${pattern}$`),
            keys
        });
    };
    const router = {
        get: (path, ...handlers) => addRoute('GET', path, ...handlers),
        post: (path, ...handlers) => addRoute('POST', path, ...handlers),
        put: (path, ...handlers) => addRoute('PUT', path, ...handlers),
        delete: (path, ...handlers) => addRoute('DELETE', path, ...handlers),
        patch: (path, ...handlers) => addRoute('PATCH', path, ...handlers),
        all: (path, ...handlers) => addRoute('ALL', path, ...handlers),
        /**
         * Mount a sub-router or middleware.
         * app.use('/auth', authRouter)
         */
        use: (prefix, subRouter) => {
            if (typeof prefix !== 'string') {
                // Fallback for global middleware handling if needed
                return;
            }
            const normalizedPrefix = prefix === '/' ? '' : prefix.replace(/\/$/, '');
            // If subRouter is another Dolphin router, merge its routes
            if (subRouter && typeof subRouter.match === 'function' && subRouter._routes) {
                for (const sr of subRouter._routes) {
                    const fullPath = normalizedPrefix + (sr.path === '/' ? '' : sr.path);
                    addRoute(sr.method, fullPath || '/', ...sr.handlers);
                }
            }
        },
        // Internal getter for route merging
        _routes: routes,
        match(method, url) {
            const path = url.split('?')[0];
            const m = method.toUpperCase();
            for (const route of routes) {
                if (route.method !== m && route.method !== 'ALL')
                    continue;
                const match = path.match(route.regex);
                if (match) {
                    const params = {};
                    route.keys.forEach((key, i) => {
                        params[key] = match[i + 1];
                    });
                    return { handlers: route.handlers, params };
                }
            }
            return null;
        }
    };
    return router;
}
//# sourceMappingURL=router.js.map