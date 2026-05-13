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
    req: any;
    res: any;
    params: Record<string, string>;
    query: Record<string, string>;
    body: any;
    state: Record<string, any>;
    json: (data: any, status?: number) => DolphinCtx;
    text: (data: any, status?: number) => DolphinCtx;
    html: (data: any, status?: number) => DolphinCtx;
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
export declare function createCtx(req: any, res: any, body?: any, params?: Record<string, string>, query?: Record<string, string>): DolphinCtx;
export default createCtx;
