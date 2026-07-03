import { z } from 'zod';
export type UnwrapSchema<S> = S extends z.ZodSchema<infer T> ? T : any;
export interface RouteOptions<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any> {
    schema?: {
        params?: P;
        query?: Q;
        body?: B;
    };
}
export interface DolphinContext<Params = any, Query = any, Body = any, State = any> {
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
export type Handler<Params = any, Query = any, Body = any, State = any> = (ctx: DolphinContext<Params, Query, Body, State>, next?: Function) => Promise<any> | any;
export interface Route {
    method: string;
    path: string;
    handlers: Handler[];
    schema?: any;
}
export declare function createDolphinRouter(): {
    get<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    post<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    put<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    delete<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    patch<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    all<P extends z.ZodSchema<any> = any, Q extends z.ZodSchema<any> = any, B extends z.ZodSchema<any> = any>(path: string, optsOrHandler: RouteOptions<P, Q, B> | Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>, ...handlers: Handler<UnwrapSchema<P>, UnwrapSchema<Q>, UnwrapSchema<B>>[]): /*elided*/ any;
    use(prefix: string, subRouter: any): /*elided*/ any;
    _routes: Route[];
    match(method: string, path: string): {
        handlers: Handler[];
        schema?: any;
        params: Record<string, string>;
    } | null;
};
