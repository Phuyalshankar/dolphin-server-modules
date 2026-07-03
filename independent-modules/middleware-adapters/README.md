# @dolphin/middleware-adapters

Framework-agnostic Express-style middleware for Node.js.

**Works with:** Express · Fastify · Next.js · Hono · Koa · NestJS · Vanilla Node.js

No external dependencies. Zero config defaults. TypeScript-first.

---

## Install

```bash
npm install @dolphin/middleware-adapters
```

---

## Middleware

| Middleware | Description |
|---|---|
| `rateLimiter()` | Sliding-window rate limiter (in-memory + optional Redis) |
| `cors()` | CORS — origin allow-list, credentials, preflight |
| `authGuard()` | JWT auth guard (HS256, timing-safe, no extra deps) |
| `requestLogger()` | Structured request logger (JSON or pretty) |

---

## Usage by Framework

### Express

```ts
import express from 'express';
import { rateLimiter, cors, authGuard, requestLogger } from '@dolphin/middleware-adapters';

const app = express();
app.use(requestLogger({ format: 'pretty' }));
app.use(cors({ origin: 'https://myapp.com', credentials: true }));
app.use(rateLimiter({ max: 100, windowMs: 60_000 }));
app.use('/api/protected', authGuard({ secret: process.env.JWT_SECRET! }));
```

### Fastify

```ts
import Fastify from 'fastify';
import middie from '@fastify/middie';
import { rateLimiter, cors } from '@dolphin/middleware-adapters';

const fastify = Fastify();
await fastify.register(middie);
fastify.use(cors({ origin: '*' }));
fastify.use(rateLimiter({ max: 50 }));
```

### Next.js — API Route (Pages Router)

```ts
// pages/api/data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiter, authGuard } from '@dolphin/middleware-adapters';

const limiter = rateLimiter({ max: 20, windowMs: 60_000 });
const guard   = authGuard({ secret: process.env.JWT_SECRET! });

const runMiddleware = (req: any, res: any, fn: Function) =>
  new Promise((resolve, reject) => fn(req, res, (err: any) => err ? reject(err) : resolve(null)));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, limiter);
  await runMiddleware(req, res, guard);
  res.json({ data: 'protected' });
}
```

### Next.js — Middleware (App Router)

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import { rateLimiter } from '@dolphin/middleware-adapters';

const limiter = rateLimiter({ max: 60 });

export async function middleware(request: Request) {
  const req = { ip: request.headers.get('x-forwarded-for') ?? 'unknown', headers: Object.fromEntries(request.headers), method: request.method, path: new URL(request.url).pathname } as any;
  const res: any = { statusCode: 200, headers: {}, setHeader: (k: string, v: string) => { res.headers[k] = v; }, end: () => {}, writableEnded: false };
  let blocked = false;
  await limiter(req, { ...res, status: (c: number) => { res.statusCode = c; blocked = true; return { json: () => {} }; } }, () => {});
  if (blocked) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  return NextResponse.next();
}
```

### Hono

```ts
import { Hono } from 'hono';
import { rateLimiter, cors } from '@dolphin/middleware-adapters';

const app = new Hono();
const limiter = rateLimiter({ max: 30 });

app.use('*', async (c, next) => {
  const req = { ip: c.req.header('x-forwarded-for') ?? 'unknown', headers: Object.fromEntries(c.req.raw.headers), method: c.req.method, path: c.req.path } as any;
  const res: any = { statusCode: 200, setHeader: () => {}, writableEnded: false };
  let done = false;
  await limiter(req, { ...res, status: (s: number) => { res.statusCode = s; done = true; return { json: (b: any) => c.json(b, s) }; } }, () => { done = false; });
  if (!done) await next();
});
```

### Koa (via koa-connect)

```ts
import Koa from 'koa';
import koaConnect from 'koa-connect';
import { rateLimiter, cors, authGuard } from '@dolphin/middleware-adapters';

const app = new Koa();
app.use(koaConnect(cors({ origin: '*' })));
app.use(koaConnect(rateLimiter({ max: 60 })));
app.use(koaConnect(authGuard({ secret: process.env.JWT_SECRET! })));
```

### Vanilla Node.js

```ts
import http from 'http';
import { rateLimiter, cors, requestLogger } from '@dolphin/middleware-adapters';

const limiter = rateLimiter({ max: 100 });
const corsMiddleware = cors();
const logger = requestLogger();

const run = (req: any, res: any, fns: Function[]) =>
  fns.reduce((p, fn) => p.then(() => new Promise(r => fn(req, res, r))), Promise.resolve());

http.createServer(async (req, res) => {
  await run(req, res, [logger, corsMiddleware, limiter]);
  res.end(JSON.stringify({ ok: true }));
}).listen(3000);
```

---

## API Reference

### `rateLimiter(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max` | `number` | `60` | Max requests per window |
| `windowMs` | `number` | `60000` | Window size in ms |
| `keyBy` | `(req) => string` | IP address | Custom key extractor |
| `message` | `string\|object` | JSON error | Response when limited |
| `redisClient` | `ioredis` | — | Redis for distributed limiting |
| `skip` | `(req) => boolean` | — | Skip function |
| `headers` | `boolean` | `true` | Add X-RateLimit-* headers |

### `cors(options?)`

| Option | Type | Default |
|--------|------|---------|
| `origin` | `string\|string[]\|(o)=>bool` | `'*'` |
| `methods` | `string[]` | Common methods |
| `credentials` | `boolean` | `false` |
| `maxAge` | `number` | `86400` |

### `authGuard(options)`

| Option | Type | Default |
|--------|------|---------|
| `secret` | `string` | **required** |
| `tokenFrom` | `'header'\|'cookie'\|'query'` | `'header'` |
| `exclude` | `string[]` | `[]` (supports `*` wildcard) |
| `require2FA` | `boolean` | `false` |

### `requestLogger(options?)`

| Option | Type | Default |
|--------|------|---------|
| `format` | `'json'\|'pretty'` | `'json'` |
| `skip` | `(req) => boolean` | — |
| `output` | `(log) => void` | stdout |

---

## Distributed Rate Limiting (Redis)

```ts
import { Redis } from 'ioredis';
import { rateLimiter } from '@dolphin/middleware-adapters';

const redis = new Redis(process.env.REDIS_URL);
app.use(rateLimiter({ max: 100, windowMs: 60_000, redisClient: redis }));
```

---

## License

ISC — Shankar Phuyal
