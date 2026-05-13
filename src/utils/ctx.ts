/**
 * Dolphin Universal Context Builder
 * 
 * Dolphin modules (auth-controller, crud, router) ले ctx object use गर्छन्।
 * यो helper ले कुनै पनि framework को req/res बाट ctx बनाउँछ।
 * 
 * ─── Express ──────────────────────────────────────────────────────
 *   import { createCtx } from 'dolphin-server-modules/utils/ctx';
 *   app.post('/login', (req, res) => auth.login(createCtx(req, res)));
 *
 * ─── Fastify ──────────────────────────────────────────────────────
 *   fastify.post('/login', (req, reply) =>
 *     auth.login(createCtx(req.raw, reply.raw, req.body, req.params, req.query))
 *   );
 *
 * ─── Next.js API Route ────────────────────────────────────────────
 *   export default async function handler(req, res) {
 *     return auth.login(createCtx(req, res));
 *   }
 *
 * ─── Hono ─────────────────────────────────────────────────────────
 *   app.post('/login', async (c) => {
 *     const ctx = createCtx(c.req.raw, c.res, await c.req.json(), c.req.param());
 *     return auth.login(ctx);
 *   });
 */

export interface DolphinCtx {
    req:    any;
    res:    any;
    params: Record<string, string>;
    query:  Record<string, string>;
    body:   any;
    state:  Record<string, any>;
    json:   (data: any, status?: number) => DolphinCtx;
    text:   (data: any, status?: number) => DolphinCtx;
    html:   (data: any, status?: number) => DolphinCtx;
    status: (code: number) => DolphinCtx;
    setHeader: (name: string, value: string) => DolphinCtx;
    getHeader: (name: string) => string | undefined;
}

/**
 * कुनै पनि framework को req/res बाट Dolphin ctx बनाउने
 * @param req  - Express req / Fastify request.raw / Next.js req / Node.js IncomingMessage
 * @param res  - Express res / Fastify reply.raw / Next.js res / Node.js ServerResponse
 * @param body - parsed body (req.body वा await req.json())
 * @param params - route params ({ id: '123' }) 
 * @param query  - query string params
 */
export function createCtx(
    req:    any,
    res:    any,
    body?:  any,
    params: Record<string, string> = {},
    query:  Record<string, string> = {}
): DolphinCtx {

    // Auto-detect body from common frameworks
    const resolvedBody  = body  ?? req.body  ?? {};
    const resolvedQuery = query && Object.keys(query).length
        ? query
        : req.query ?? {};
    const resolvedParams = params && Object.keys(params).length
        ? params
        : req.params ?? {};

    let pendingStatus = 200;

    const send = (data: any, contentType: string, status = 200) => {
        if (res.headersSent || res.writableEnded) return ctx;
        const finalStatus = status !== undefined ? status : pendingStatus;

        // Express / Node.js style
        if (typeof res.status === 'function' && typeof res.json === 'function') {
            res.status(finalStatus).setHeader('Content-Type', contentType);
            contentType === 'application/json'
                ? res.json(data)
                : res.end(String(data));
        } else {
            // Raw Node.js ServerResponse
            res.statusCode = finalStatus;
            res.setHeader('Content-Type', contentType);
            res.end(contentType === 'application/json' ? JSON.stringify(data) : String(data));
        }
        pendingStatus = 200;
        return ctx;
    };

    const ctx: DolphinCtx = {
        req,
        res,
        params:  resolvedParams,
        query:   resolvedQuery,
        body:    resolvedBody,
        state:   {},
        json:    (data, status = 200)  => send(data, 'application/json', status),
        text:    (data, status = 200)  => send(data, 'text/plain', status),
        html:    (data, status = 200)  => send(data, 'text/html', status),
        status:  (code) => { pendingStatus = code; return ctx; },
        setHeader: (name, value) => { res.setHeader(name, value); return ctx; },
        getHeader: (name) => req.headers?.[name.toLowerCase()],
    };
    return ctx;
}

export default createCtx;
