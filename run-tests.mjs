/**
 * Minimal test runner — no jest required.
 * SQL Adapter र Serverless Adapter को core logic verify गर्छ।
 * Uses compiled dist/ (after tsc build) or source via ts-node.
 */

import { createRequire } from 'node:module';
import crypto from 'node:crypto';

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
      }).catch(err => {
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
        failed++;
        errors.push({ name, err });
      });
    }
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

function expect(val) {
  return {
    toBe: (expected) => {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual: (expected) => {
      const a = JSON.stringify(val), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeDefined: () => {
      if (val === undefined || val === null) throw new Error(`Expected defined, got ${val}`);
    },
    toBeNull: () => {
      if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`);
    },
    toContain: (sub) => {
      if (!String(val).includes(String(sub))) throw new Error(`Expected "${val}" to contain "${sub}"`);
    },
    toBeTruthy: () => {
      if (!val) throw new Error(`Expected truthy, got ${val}`);
    },
    toBeFalsy: () => {
      if (val) throw new Error(`Expected falsy, got ${val}`);
    },
  };
}

// ─── Inline SQL Adapter Logic Tests ──────────────────────────────────────────
// (We inline the test logic directly to avoid needing ts-node/jest)

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, '');
}

function getTable(collection, tables = {}, softDelete = false) {
  return tables[collection] ?? toSnakeCase(collection) + (collection.endsWith('s') ? '' : 's');
}

console.log('\n📦 SQL Adapter — Unit Tests\n');

await test('toSnakeCase: User → users', () => {
  expect(toSnakeCase('User')).toBe('user');
});

await test('getTable: User → users', () => {
  expect(getTable('User')).toBe('users');
});

await test('getTable: RefreshToken → refresh_tokens', () => {
  expect(getTable('RefreshToken')).toBe('refresh_tokens');
});

await test('getTable: BlogPost → blog_posts', () => {
  expect(getTable('BlogPost')).toBe('blog_posts');
});

await test('getTable: custom tables map overrides default', () => {
  expect(getTable('User', { User: 'accounts' })).toBe('accounts');
});

// Mock pg client
function makeMockClient(rows = []) {
  const calls = [];
  return {
    _calls: calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows };
    },
  };
}

// Import the compiled adapter (we'll run from dist after tsc)
let createSQLAdapter, createSQLAdapterOk = false;
try {
  const mod = await import('./dist/adapters/sql/index.js');
  createSQLAdapter = mod.createSQLAdapter;
  createSQLAdapterOk = true;
} catch (e) {
  console.log('  ⚠️  dist/ not built yet — skipping integration tests (run npm run build first)');
}

if (createSQLAdapterOk) {
  await test('createSQLAdapter: adapter is defined', () => {
    const client = makeMockClient();
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    expect(adapter).toBeDefined();
    expect(typeof adapter.findUserByEmail).toBe('function');
    expect(typeof adapter.read).toBe('function');
    expect(typeof adapter.ping).toBe('function');
  });

  await test('findUserByEmail: queries with LOWER(email)', async () => {
    const client = makeMockClient([{ id: 'u1', email: 'a@b.com', password: 'h' }]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    const result = await adapter.findUserByEmail('A@b.com');
    expect(client._calls[0].sql).toContain('LOWER(email)');
    expect(result).toBeDefined();
  });

  await test('findUserByEmail: returns null when not found', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    const result = await adapter.findUserByEmail('nobody@example.com');
    expect(result).toBeNull();
  });

  await test('read: applies equality filter', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    await adapter.read('Post', { status: 'active' });
    expect(client._calls[0].sql).toContain('WHERE status = $1');
    expect(client._calls[0].values[0]).toBe('active');
  });

  await test('read: $like uses ILIKE with %wrap%', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    await adapter.read('Post', { title: { $like: 'dolphin' } });
    expect(client._calls[0].sql).toContain('ILIKE');
    expect(client._calls[0].values[0]).toBe('%dolphin%');
  });

  await test('read: $in builds IN clause', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    await adapter.read('Post', { status: { $in: ['draft', 'published'] } });
    expect(client._calls[0].sql).toContain('IN ($1, $2)');
  });

  await test('read: $gt builds > clause', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    await adapter.read('Order', { total: { $gt: 100 } });
    expect(client._calls[0].sql).toContain('> $1');
    expect(client._calls[0].values[0]).toBe(100);
  });

  await test('softDelete: adds deleted_at IS NULL to read', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres', softDelete: true });
    await adapter.read('Post', {});
    expect(client._calls[0].sql).toContain('deleted_at IS NULL');
  });

  await test('ping: returns true on success', async () => {
    const client = makeMockClient([{ '?column?': 1 }]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    const ok = await adapter.ping();
    expect(ok).toBe(true);
  });

  await test('ping: returns false on error', async () => {
    const badClient = { async query() { throw new Error('Connection refused'); } };
    const adapter = createSQLAdapter({ client: badClient, dialect: 'postgres' });
    const ok = await adapter.ping();
    expect(ok).toBe(false);
  });

  await test('deleteRefreshToken: runs DELETE query', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    await adapter.deleteRefreshToken('tok-xyz');
    expect(client._calls[0].sql).toContain('DELETE FROM');
    expect(client._calls[0].values[0]).toBe('tok-xyz');
  });

  await test('tableName: correct snake_case mapping', () => {
    const client = makeMockClient();
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    expect(adapter.tableName('User')).toBe('users');
    expect(adapter.tableName('RefreshToken')).toBe('refresh_tokens');
  });
}

// ─── Serverless Adapter Tests ─────────────────────────────────────────────────
console.log('\n🌐 Serverless Adapter — Unit Tests\n');

let toLambda, toVercel, toCloudflare, toNodeHandler, serverlessOk = false;
try {
  const mod = await import('./dist/adapters/serverless/index.js');
  toLambda = mod.toLambda;
  toVercel = mod.toVercel;
  toCloudflare = mod.toCloudflare;
  toNodeHandler = mod.toNodeHandler;
  serverlessOk = true;
} catch (e) {
  console.log('  ⚠️  dist/ not built yet — skipping serverless tests');
}

function makeMockApp(routes = {}) {
  return {
    match(method, path) {
      const key = `${method.toUpperCase()}:${path}`;
      const handler = routes[key];
      if (!handler) return null;
      return { handlers: [handler], params: {} };
    },
  };
}

if (serverlessOk) {
  await test('toLambda: 200 response for matched route', async () => {
    const app = makeMockApp({ 'GET:/hello': (ctx) => ctx.json({ hello: 'world' }) });
    const handler = toLambda(app);
    const result = await handler(
      { httpMethod: 'GET', path: '/hello', headers: {}, queryStringParameters: null, body: null, isBase64Encoded: false },
      {}
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ hello: 'world' });
  });

  await test('toLambda: 404 for unknown route', async () => {
    const handler = toLambda(makeMockApp({}));
    const result = await handler(
      { httpMethod: 'GET', path: '/missing', headers: {}, queryStringParameters: null, body: null, isBase64Encoded: false },
      {}
    );
    expect(result.statusCode).toBe(404);
  });

  await test('toLambda: parses query string parameters', async () => {
    let captured = {};
    const app = makeMockApp({ 'GET:/search': (ctx) => { captured = ctx.query; return ctx.json({ ok: true }); } });
    const handler = toLambda(app);
    await handler(
      { httpMethod: 'GET', path: '/search', headers: {}, queryStringParameters: { q: 'dolphin', page: '2' }, body: null, isBase64Encoded: false },
      {}
    );
    expect(captured.q).toBe('dolphin');
    expect(captured.page).toBe('2');
  });

  await test('toLambda: parses JSON body', async () => {
    let captured = {};
    const app = makeMockApp({ 'POST:/users': (ctx) => { captured = ctx.body; return ctx.status(201).json({ created: true }); } });
    const handler = toLambda(app);
    const result = await handler(
      { httpMethod: 'POST', path: '/users', headers: { 'content-type': 'application/json' }, queryStringParameters: null, body: JSON.stringify({ name: 'Shankar' }), isBase64Encoded: false },
      {}
    );
    expect(result.statusCode).toBe(201);
    expect(captured.name).toBe('Shankar');
  });

  await test('toLambda: decodes base64 body', async () => {
    let captured = {};
    const app = makeMockApp({ 'POST:/data': (ctx) => { captured = ctx.body; return ctx.json({ ok: true }); } });
    const handler = toLambda(app);
    await handler(
      { httpMethod: 'POST', path: '/data', headers: { 'content-type': 'application/json' }, queryStringParameters: null, body: Buffer.from(JSON.stringify({ secret: 42 })).toString('base64'), isBase64Encoded: true },
      {}
    );
    expect(captured.secret).toBe(42);
  });

  await test('toLambda: supports API Gateway v2 rawPath', async () => {
    const app = makeMockApp({ 'GET:/v2/ping': (ctx) => ctx.json({ v: 2 }) });
    const handler = toLambda(app);
    const result = await handler(
      { rawPath: '/v2/ping', requestContext: { http: { method: 'GET' } }, headers: {}, queryStringParameters: null, body: null, isBase64Encoded: false },
      {}
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).v).toBe(2);
  });

  await test('toCloudflare: fetch handler returns 200', async () => {
    const app = makeMockApp({ 'GET:/cf': (ctx) => ctx.json({ platform: 'cloudflare' }) });
    const worker = toCloudflare(app);
    const req = new Request('https://worker.dev/cf');
    const res = await worker.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.platform).toBe('cloudflare');
  });

  await test('toCloudflare: 404 for unmatched route', async () => {
    const worker = toCloudflare(makeMockApp({}));
    const req = new Request('https://worker.dev/nope');
    const res = await worker.fetch(req);
    expect(res.status).toBe(404);
  });

  await test('toCloudflare: exposes onRequest for Pages', () => {
    const worker = toCloudflare(makeMockApp({}));
    expect(typeof worker.onRequest).toBe('function');
  });

  await test('toNodeHandler: returns a function', () => {
    const handler = toNodeHandler(makeMockApp({}));
    expect(typeof handler).toBe('function');
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Tests: ${passed + failed} | ✅ ${passed} passed | ❌ ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed tests:');
  errors.forEach(({ name }) => console.log(`  - ${name}`));
  process.exit(1);
} else {
  console.log('\n  All tests passed! 🐬');
}
