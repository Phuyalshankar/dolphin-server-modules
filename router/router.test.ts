import { createDolphinRouter } from './router';

describe('Standalone Router', () => {
  it('should match simple routes', () => {
    const router = createDolphinRouter();
    const handler = jest.fn();
    router.get('/hello', handler);

    const match = router.match('GET', '/hello');
    expect(match).not.toBeNull();
    expect(match!.handlers[0]).toBe(handler);
  });

  it('should support sub-routers with prefixes', () => {
    const mainRouter = createDolphinRouter();
    const subRouter = createDolphinRouter();
    const handler = jest.fn();

    subRouter.get('/login', handler);
    mainRouter.use('/auth', subRouter);

    const match = mainRouter.match('GET', '/auth/login');
    expect(match).not.toBeNull();
    expect(match!.handlers[0]).toBe(handler);
  });

  it('should handle nested prefixes correctly', () => {
    const v1 = createDolphinRouter();
    const api = createDolphinRouter();
    const handler = jest.fn();

    v1.get('/test', handler);
    api.use('/v1', v1);
    
    const root = createDolphinRouter();
    root.use('/api', api);

    expect(root.match('GET', '/api/v1/test')).not.toBeNull();
  });

  it('should support "all" method', () => {
    const router = createDolphinRouter();
    const handler = jest.fn();
    router.all('/any', handler);

    expect(router.match('GET', '/any')).not.toBeNull();
    expect(router.match('POST', '/any')).not.toBeNull();
  });

  it('should normalize slashes', () => {
    const router = createDolphinRouter();
    const handler = jest.fn();
    router.get('/slash/', handler);

    expect(router.match('GET', '/slash')).not.toBeNull();
  });
});
