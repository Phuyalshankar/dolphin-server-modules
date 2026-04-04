import { createDolphinServer } from './server/server';
import { createCRUD, DatabaseAdapter } from './curd/crud';

// ===== In-Memory Database Adapter =====
function createMemoryAdapter(): DatabaseAdapter {
  const store: Record<string, any[]> = {};

  const getCol = (col: string) => {
    if (!store[col]) store[col] = [];
    return store[col];
  };

  return {
    async create(collection, data) {
      const col = getCol(collection);
      col.push(data);
      return data;
    },
    async read(collection, query) {
      const col = getCol(collection);
      if (!query || Object.keys(query).length === 0) return col;
      return col.filter(item => {
        for (const [k, v] of Object.entries(query as Record<string, any>)) {
          if (item[k] !== v) return false;
        }
        return true;
      });
    },
    async update(collection, query, data) {
      const col = getCol(collection);
      const key = query.id || query._id;
      const idx = col.findIndex(item => item.id === key || item._id === key);
      if (idx !== -1) {
        col[idx] = { ...col[idx], ...data };
        return col[idx];
      }
      return null;
    },
    async delete(collection, query) {
      const col = getCol(collection);
      const key = query.id || query._id;
      const idx = col.findIndex(item => item.id === key || item._id === key);
      if (idx !== -1) {
        const [deleted] = col.splice(idx, 1);
        return deleted;
      }
      return null;
    },
    async createUser(data) { return this.create('users', data); },
    async findUserByEmail(email) {
      return (await this.read('users', {})).find((u: any) => u.email === email) || null;
    },
    async findUserById(id) {
      return (await this.read('users', {})).find((u: any) => u.id === id) || null;
    },
    async updateUser(id, data) { return this.update('users', { id }, data); },
    async saveRefreshToken(data) { await this.create('refresh_tokens', data); },
    async findRefreshToken(token) {
      return (await this.read('refresh_tokens', {})).find((t: any) => t.token === token) || null;
    },
    async deleteRefreshToken(token) {
      const col = getCol('refresh_tokens');
      const idx = col.findIndex((t: any) => t.token === token);
      if (idx !== -1) col.splice(idx, 1);
    },
  };
}

const app = createDolphinServer();
const db = createMemoryAdapter();

// enforceOwnership: false — auth नचाहिने CRUD
const service = createCRUD(db, { enforceOwnership: false });
const COLLECTION = 'products';

// ===== CORRECT ROUTE MAPPINGS =====
// GET all products
app.get('/products', async (ctx: any) => {
  const { limit, offset, ...filters } = ctx.query;
  const results = await service.read(
    COLLECTION,
    filters,
    { limit: limit ? parseInt(limit) : undefined, offset: offset ? parseInt(offset) : undefined }
  );
  ctx.json(results);
});

// GET single product by ID
app.get('/products/:id', async (ctx: any) => {
  const result = await service.readOne(COLLECTION, ctx.params.id);
  if (!result) return ctx.status(404).json({ error: 'Product not found' });
  ctx.json(result);
});

// POST create product
app.post('/products', async (ctx: any) => {
  const result = await service.create(COLLECTION, ctx.body);
  ctx.status(201).json(result);
});

// PUT update product by ID
app.put('/products/:id', async (ctx: any) => {
  const result = await service.updateOne(COLLECTION, ctx.params.id, ctx.body);
  if (!result) return ctx.status(404).json({ error: 'Product not found' });
  ctx.json(result);
});

// DELETE product by ID
app.delete('/products/:id', async (ctx: any) => {
  const result = await service.deleteOne(COLLECTION, ctx.params.id);
  if (!result) return ctx.status(404).json({ error: 'Product not found' });
  ctx.json({ success: true, deleted: result });
});

// ===== Utility Routes =====
app.get('/api/health', (ctx: any) => {
  ctx.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.post('/api/echo', (ctx: any) => {
  ctx.json({ echo: ctx.body, received_at: new Date().toISOString() });
});

app.get('/api/info', (ctx: any) => {
  ctx.json({
    name: 'Dolphin Framework',
    version: '1.5.5',
    description: 'Modular, lightweight, high-performance backend ecosystem',
    performance: '45,000+ RPS',
    author: 'Shankar Phuyal',
  });
});

app.get('/', (ctx: any) => {
  ctx.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dolphin Framework</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
      min-height: 100vh;
      color: #fff;
      padding: 2rem;
    }
    .container { max-width: 860px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 2.5rem; }
    .logo { font-size: 4rem; }
    h1 { font-size: 2.5rem; font-weight: 700; margin: 0.5rem 0; }
    .tagline { color: #a0c4d8; font-size: 1.05rem; }
    .section { margin-bottom: 2rem; }
    .section h2 { font-size: 1rem; color: #7ecfff; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; }
    .ep {
      display: flex; align-items: center; gap: 0.8rem;
      padding: 0.6rem 1rem; background: rgba(255,255,255,0.05);
      border-radius: 8px; margin-bottom: 0.4rem; font-size: 0.87rem;
    }
    .method {
      font-weight: bold; font-size: 0.72rem; padding: 0.2rem 0.45rem;
      border-radius: 4px; min-width: 55px; text-align: center; flex-shrink: 0;
    }
    .get    { background: #1a6b3f; color: #4ade80; }
    .post   { background: #1a3b6b; color: #60a5fa; }
    .put    { background: #5c3a00; color: #fbbf24; }
    .del    { background: #6b1a1a; color: #f87171; }
    code { background: rgba(255,255,255,0.1); padding: 0.1rem 0.4rem; border-radius: 3px; font-family: monospace; }
    .note { font-size: 0.8rem; color: #7a9fb0; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🐬</div>
      <h1>Dolphin Framework</h1>
      <p class="tagline">Modular · Zero-Dependency Core · 45,000+ RPS · 2026-Ready</p>
    </div>

    <div class="section">
      <h2>Products CRUD API</h2>
      <div class="ep"><span class="method get">GET</span><code>/products</code><span>सबै products ल्याउनु</span></div>
      <div class="ep"><span class="method get">GET</span><code>/products/:id</code><span>ID बाट एउटा product ल्याउनु</span></div>
      <div class="ep"><span class="method post">POST</span><code>/products</code><span>नयाँ product बनाउनु</span></div>
      <div class="ep"><span class="method put">PUT</span><code>/products/:id</code><span>ID बाट product update गर्नु</span></div>
      <div class="ep"><span class="method del">DELETE</span><code>/products/:id</code><span>ID बाट product मेटाउनु</span></div>
      <p class="note">* In-memory storage — server restart भएमा data reset हुन्छ</p>
    </div>

    <div class="section">
      <h2>Utility Endpoints</h2>
      <div class="ep"><span class="method get">GET</span><code>/api/health</code><span>Health check</span></div>
      <div class="ep"><span class="method get">GET</span><code>/api/info</code><span>Framework info</span></div>
      <div class="ep"><span class="method post">POST</span><code>/api/echo</code><span>Request body echo</span></div>
    </div>
  </div>
</body>
</html>`);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🐬 Dolphin Framework running at http://0.0.0.0:${PORT}`);
  console.log(`   CRUD routes: /products`);
});
