// Serverless Adapter Tests
import { toLambda, toVercel, toCloudflare, toNodeHandler } from './index';

// ─── Mock Dolphin App ─────────────────────────────────────────────────────────

function makeMockApp(routes: Record<string, any> = {}) {
  return {
    match(method: string, path: string) {
      const key = `${method.toUpperCase()}:${path}`;
      const handler = routes[key];
      if (!handler) return null;
      return { handlers: [handler], params: {} };
    },
  };
}

// ─── Lambda Tests ─────────────────────────────────────────────────────────────

describe('toLambda()', () => {
  it('should wrap app as Lambda handler', async () => {
    const app = makeMockApp({
      'GET:/hello': (ctx: any) => ctx.json({ hello: 'world' }),
    });

    const handler = toLambda(app);
    const result = await handler(
      {
        httpMethod: 'GET',
        path: '/hello',
        headers: {},
        queryStringParameters: null,
        body: null,
        isBase64Encoded: false,
      },
      {}
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ hello: 'world' });
  });

  it('should return 404 for unknown route', async () => {
    const app = makeMockApp({});
    const handler = toLambda(app);

    const result = await handler(
      { httpMethod: 'GET', path: '/unknown', headers: {}, queryStringParameters: null, body: null, isBase64Encoded: false },
      {}
    );
    expect(result.statusCode).toBe(404);
  });

  it('should parse query string parameters', async () => {
    let receivedQuery: any = {};
    const app = makeMockApp({
      'GET:/search': (ctx: any) => {
        receivedQuery = ctx.query;
        return ctx.json({ ok: true });
      },
    });

    const handler = toLambda(app);
    await handler(
      {
        httpMethod: 'GET',
        path: '/search',
        headers: {},
        queryStringParameters: { q: 'dolphin', limit: '10' },
        body: null,
        isBase64Encoded: false,
      },
      {}
    );

    expect(receivedQuery.q).toBe('dolphin');
    expect(receivedQuery.limit).toBe('10');
  });

  it('should parse JSON body', async () => {
    let receivedBody: any = {};
    const app = makeMockApp({
      'POST:/users': (ctx: any) => {
        receivedBody = ctx.body;
        return ctx.status(201).json({ created: true });
      },
    });

    const handler = toLambda(app);
    const result = await handler(
      {
        httpMethod: 'POST',
        path: '/users',
        headers: { 'content-type': 'application/json' },
        queryStringParameters: null,
        body: JSON.stringify({ name: 'Shankar', email: 'shankar@dolphin.com' }),
        isBase64Encoded: false,
      },
      {}
    );

    expect(result.statusCode).toBe(201);
    expect(receivedBody.name).toBe('Shankar');
    expect(receivedBody.email).toBe('shankar@dolphin.com');
  });

  it('should decode base64 body', async () => {
    let receivedBody: any = {};
    const app = makeMockApp({
      'POST:/data': (ctx: any) => {
        receivedBody = ctx.body;
        return ctx.json({ ok: true });
      },
    });

    const handler = toLambda(app);
    await handler(
      {
        httpMethod: 'POST',
        path: '/data',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ key: 'value' })).toString('base64'),
        isBase64Encoded: true,
        queryStringParameters: null,
      },
      {}
    );

    expect(receivedBody.key).toBe('value');
  });

  it('should support API Gateway v2 format (rawPath)', async () => {
    const app = makeMockApp({
      'GET:/v2/hello': (ctx: any) => ctx.json({ v: 2 }),
    });
    const handler = toLambda(app);

    const result = await handler(
      {
        rawPath: '/v2/hello',
        requestContext: { http: { method: 'GET' } },
        headers: {},
        queryStringParameters: null,
        body: null,
        isBase64Encoded: false,
      },
      {}
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ v: 2 });
  });
});

// ─── Vercel Tests ─────────────────────────────────────────────────────────────

describe('toVercel()', () => {
  function makeMockRes() {
    const res: any = {
      _status: 200,
      _headers: {} as Record<string, string>,
      _body: '',
      status(code: number) { this._status = code; return this; },
      setHeader(k: string, v: string) { this._headers[k] = v; },
      end(body: string) { this._body = body; },
    };
    return res;
  }

  it('should handle GET request', async () => {
    const app = makeMockApp({
      'GET:/api/ping': (ctx: any) => ctx.json({ pong: true }),
    });
    const handler = toVercel(app);

    const req = { method: 'GET', url: 'http://localhost/api/ping', headers: { host: 'localhost' }, body: {} };
    const res = makeMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ pong: true });
  });

  it('should pass pre-parsed body from Next.js', async () => {
    let received: any = null;
    const app = makeMockApp({
      'POST:/api/create': (ctx: any) => {
        received = ctx.body;
        return ctx.json({ ok: true });
      },
    });
    const handler = toVercel(app);

    const req = {
      method: 'POST',
      url: 'http://localhost/api/create',
      headers: { host: 'localhost', 'content-type': 'application/json' },
      body: { name: 'test' }, // pre-parsed by Next.js
    };
    const res = makeMockRes();
    await handler(req, res);

    expect(received).toEqual({ name: 'test' });
  });
});

// ─── Cloudflare Tests ─────────────────────────────────────────────────────────

describe('toCloudflare()', () => {
  it('should handle fetch request', async () => {
    const app = makeMockApp({
      'GET:/cf/hello': (ctx: any) => ctx.json({ platform: 'cloudflare' }),
    });

    const worker = toCloudflare(app);
    const request = new Request('https://worker.example.com/cf/hello');
    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ platform: 'cloudflare' });
  });

  it('should return 404 for unknown route', async () => {
    const app = makeMockApp({});
    const worker = toCloudflare(app);
    const request = new Request('https://worker.example.com/missing');
    const response = await worker.fetch(request);
    expect(response.status).toBe(404);
  });

  it('should parse JSON body for POST', async () => {
    let received: any = null;
    const app = makeMockApp({
      'POST:/cf/data': (ctx: any) => {
        received = ctx.body;
        return ctx.json({ ok: true });
      },
    });
    const worker = toCloudflare(app);
    const request = new Request('https://worker.example.com/cf/data', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ msg: 'hello' }),
    });
    await worker.fetch(request);
    expect(received).toEqual({ msg: 'hello' });
  });

  it('should expose onRequest for Cloudflare Pages', () => {
    const app = makeMockApp({});
    const worker = toCloudflare(app) as any;
    expect(typeof worker.onRequest).toBe('function');
  });
});

// ─── toNodeHandler Tests ──────────────────────────────────────────────────────

describe('toNodeHandler()', () => {
  it('should be defined and return a function', () => {
    const app = makeMockApp({});
    const handler = toNodeHandler(app);
    expect(typeof handler).toBe('function');
  });
});
