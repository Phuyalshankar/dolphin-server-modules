import http from 'node:http';
export declare function createDolphinServer(options?: {
    port?: number;
    host?: string;
    realtime?: any;
}): {
    http: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    wss: import("ws").Server<typeof import("ws"), typeof http.IncomingMessage>;
    use: (prefixOrMw: string | any, mw?: any) => void;
    listen: (port?: number, callback?: () => void) => http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    close: () => http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    get: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    post: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    put: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    delete: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    patch: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    all: (path: string, ...handlers: import("../router/router").Handler[]) => void;
    _routes: import("../router/router").Route[];
    match(method: string, url: string): {
        handlers: import("../router/router").Handler[];
        params: Record<string, string>;
    } | null;
};
