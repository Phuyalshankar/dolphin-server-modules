import http from 'node:http';
export declare function createDolphinServer(options?: {
    port?: number;
    host?: string;
    realtime?: any;
    allowedWebSocketPaths?: string[];
}): {
    http: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    wss: import("ws").Server<typeof import("ws").default, typeof http.IncomingMessage>;
    use: (prefixOrMw: string | any, mw?: any) => void;
    listen: (port?: number, callback?: () => void) => http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    close: () => http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    get: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    post: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    put: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    delete: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    patch: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    all: (path: string, ...handlers: import("../index.js").Handler[]) => void;
    _routes: import("../index.js").Route[];
    match(method: string, url: string): {
        handlers: import("../index.js").Handler[];
        params: Record<string, string>;
    } | null;
};
