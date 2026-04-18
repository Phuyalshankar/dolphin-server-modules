export type Handler = (ctx: any, next?: Function) => Promise<any> | any;
export interface Route {
    method: string;
    path: string;
    handlers: Handler[];
    regex: RegExp;
    keys: string[];
}
export declare function createDolphinRouter(): {
    get: (path: string, ...handlers: Handler[]) => void;
    post: (path: string, ...handlers: Handler[]) => void;
    put: (path: string, ...handlers: Handler[]) => void;
    delete: (path: string, ...handlers: Handler[]) => void;
    patch: (path: string, ...handlers: Handler[]) => void;
    all: (path: string, ...handlers: Handler[]) => void;
    /**
     * Mount a sub-router or middleware.
     * app.use('/auth', authRouter)
     */
    use: (prefix: string, subRouter: any) => void;
    _routes: Route[];
    match(method: string, url: string): {
        handlers: Handler[];
        params: Record<string, string>;
    } | null;
};
