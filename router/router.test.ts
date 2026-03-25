import { createDolphinRouter } from './router';

describe('Dolphin Router', () => {
  it('should match simple routes', () => {
    const router = createDolphinRouter();
    const handler = jest.fn();
    router.get('/test', handler);

    const match = router.match('GET', '/test');
    expect(match).not.toBeNull();
    expect(match?.handler).toBe(handler);
  });

  it('should extract path parameters', () => {
    const router = createDolphinRouter();
    const handler = jest.fn();
    router.get('/users/:id/posts/:postId', handler);

    const match = router.match('GET', '/users/123/posts/456');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: '123', postId: '456' });
  });

  it('should return null for unmatched routes', () => {
    const router = createDolphinRouter();
    router.get('/test', jest.fn());
    const match = router.match('GET', '/wrong');
    expect(match).toBeNull();
  });
});
