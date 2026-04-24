import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { createDolphinRouter } from 'dolphin-server-modules/router';

export function setupAuth(dbAdapter, config) {
    const router = createDolphinRouter();
    const auth = createDolphinAuthController(dbAdapter, config);
    
    router.post('/register', auth.register);
    router.post('/login', auth.login);
    router.post('/refresh', auth.refresh);
    router.get('/me', auth.requireAuth, (ctx) => ctx.json(ctx.req.user));
    
    return router;
}