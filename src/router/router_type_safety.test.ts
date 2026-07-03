import { describe, test, expect } from '@jest/globals';
import { createDolphinRouter } from './router';
import { createDolphinServer } from '../server/server';
import { z } from 'zod';

describe('Trie Router & Type Safety Integration Tests', () => {

  test('Trie Router: priority routing (static > param > wildcard)', () => {
    const router = createDolphinRouter();
    
    // Register overlapping routes
    router.get('/users/active', () => 'active');
    router.get('/users/:id', () => 'param');
    router.get('/users/*', () => 'wildcard');

    // 1. Static match
    const match1 = router.match('GET', '/users/active');
    expect(match1).not.toBeNull();
    expect(match1!.handlers[0]({} as any)).toBe('active');

    // 2. Param match
    const match2 = router.match('GET', '/users/123');
    expect(match2).not.toBeNull();
    expect(match2!.handlers[0]({} as any)).toBe('param');
    expect(match2!.params.id).toBe('123');

    // 3. Wildcard match
    const match3 = router.match('GET', '/users/foo/bar/baz');
    expect(match3).not.toBeNull();
    expect(match3!.handlers[0]({} as any)).toBe('wildcard');
    expect(match3!.params['*']).toBe('foo/bar/baz');
  });

  test('Trie Router: backtracking when param matching fails later segments', () => {
    const router = createDolphinRouter();
    
    // Routes
    router.get('/api/:version/docs', () => 'docs');
    router.get('/api/static/info', () => 'info');

    // Match static path
    const match1 = router.match('GET', '/api/static/info');
    expect(match1).not.toBeNull();
    expect(match1!.handlers[0]({} as any)).toBe('info');

    // Match param path
    const match2 = router.match('GET', '/api/v2/docs');
    expect(match2).not.toBeNull();
    expect(match2!.handlers[0]({} as any)).toBe('docs');
    expect(match2!.params.version).toBe('v2');
  });

  test('Type-Safe Schema Validation: automatically validates body and returns 400 on failure', async () => {
    const app = createDolphinServer();
    
    const UserSchema = z.object({
      name: z.string().min(3),
      age: z.number().int().positive()
    });

    // Register a type-safe POST route with schema validation
    app.post('/api/users', {
      schema: {
        body: UserSchema
      }
    }, (ctx) => {
      // TypeScript compile-time type-safety check:
      // ctx.body is typed via z.infer<typeof UserSchema> at runtime
      const { name, age } = ctx.body;
      return ctx.status(201).json({ success: true, name, age });
    });

    const server = app.http;
    
    // We mock request/response locally to avoid network ports
    const makeRequest = (bodyObj: any): Promise<{ status: number; body: any }> => {
      return new Promise((resolve) => {
        let responseStatus = 200;
        let responseHeaders: any = {};
        let responseBody = '';

        const req: any = {
          method: 'POST',
          url: '/api/users',
          headers: { 'content-type': 'application/json' },
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from(JSON.stringify(bodyObj));
          }
        };

        const res: any = {
          setHeader: (name: string, val: string) => { responseHeaders[name] = val; },
          end: (data: string) => {
            responseBody = data;
            resolve({
              status: responseStatus,
              body: JSON.parse(responseBody)
            });
          }
        };

        Object.defineProperty(res, 'statusCode', {
          set: (code) => { responseStatus = code; },
          get: () => responseStatus
        });

        // Trigger request listener manually
        server.emit('request', req, res);
      });
    };

    // 1. Test invalid body (name too short, age negative)
    const errRes = await makeRequest({ name: 'Al', age: -5 });
    expect(errRes.status).toBe(400);
    expect(errRes.body.message).toBe('Validation Error');
    expect(errRes.body.errors).toContainEqual({ field: 'name', message: 'Too small: expected string to have >=3 characters' });
    expect(errRes.body.errors).toContainEqual({ field: 'age', message: 'Too small: expected number to be >0' });

    // 2. Test valid body
    const okRes = await makeRequest({ name: 'Albert', age: 25 });
    expect(okRes.status).toBe(201);
    expect(okRes.body.success).toBe(true);
    expect(okRes.body.name).toBe('Albert');
    expect(okRes.body.age).toBe(25);
  });
});
