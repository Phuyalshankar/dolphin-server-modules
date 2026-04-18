"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const server_1 = require("./server/server");
const crud_1 = require("./curd/crud");
const mongoose_2 = require("./adapters/mongoose");
const core_1 = require("./realtime/core");
const path_1 = __importDefault(require("path"));
// ===== Mongoose Models =====
const ProductSchema = new mongoose_1.Schema({
    id: { type: String },
    name: { type: String, required: true },
    price: { type: Number },
    category: { type: String },
    userId: { type: String },
    createdAt: { type: String },
    updatedAt: { type: String },
}, { timestamps: false });
const UserSchema = new mongoose_1.Schema({ email: String, password: String });
const RefreshTokenSchema = new mongoose_1.Schema({ token: String, userId: String });
const Product = mongoose_1.default.model('Product', ProductSchema);
const User = mongoose_1.default.model('User', UserSchema);
const RefreshToken = mongoose_1.default.model('RefreshToken', RefreshTokenSchema);
async function bootstrap() {
    // 1. Start in-process MongoDB (real Mongoose engine, no external server needed)
    console.log('⏳ MongoDB इन्जिन start गर्दै...');
    const mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose_1.default.connect(uri);
    console.log('✅ MongoDB connected:', uri);
    // 2. Build real Mongoose adapter
    const mongoAdapter = (0, mongoose_2.createMongooseAdapter)({
        User,
        RefreshToken,
        models: { Product },
        leanByDefault: true,
        softDelete: false,
    });
    // 3. CRUD service — enforceOwnership: false (auth नचाहिने)
    const service = (0, crud_1.createCRUD)(mongoAdapter, { enforceOwnership: false });
    const COLLECTION = 'Product';
    // 4. Realtime Setup
    const rt = new core_1.RealtimeCore({ debug: true });
    rt.pubFile('test-file-id', path_1.default.join(process.cwd(), 'test-file.txt'));
    // 5. Dolphin server
    const app = (0, server_1.createDolphinServer)({ realtime: rt });
    // ===== CORRECT ROUTE MAPPINGS =====
    // GET all products
    app.get('/products', async (ctx) => {
        const { limit, offset, ...filters } = ctx.query;
        const results = await service.read(COLLECTION, filters, {
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        });
        ctx.json(results);
    });
    // GET single product by ID
    app.get('/products/:id', async (ctx) => {
        const result = await service.readOne(COLLECTION, ctx.params.id);
        if (!result)
            return ctx.status(404).json({ error: 'Product not found' });
        ctx.json(result);
    });
    // POST create product
    app.post('/products', async (ctx) => {
        const result = await service.create(COLLECTION, ctx.body);
        ctx.status(201).json(result);
    });
    // PUT update product by ID
    app.put('/products/:id', async (ctx) => {
        const result = await service.updateOne(COLLECTION, ctx.params.id, ctx.body);
        if (!result)
            return ctx.status(404).json({ error: 'Product not found' });
        ctx.json(result);
    });
    // DELETE product by ID
    app.delete('/products/:id', async (ctx) => {
        const result = await service.deleteOne(COLLECTION, ctx.params.id);
        if (!result)
            return ctx.status(404).json({ error: 'Product not found' });
        ctx.json({ success: true, deleted: result });
    });
    // ===== Utility Routes =====
    app.get('/api/health', (ctx) => {
        ctx.json({
            status: 'ok',
            db: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });
    app.post('/api/echo', (ctx) => {
        ctx.json({ echo: ctx.body, received_at: new Date().toISOString() });
    });
    app.get('/api/info', (ctx) => {
        ctx.json({
            name: 'Dolphin Framework',
            version: '1.5.5',
            adapter: 'Real Mongoose (mongodb-memory-server)',
            mongoUri: uri,
        });
    });
    app.get('/', (ctx) => {
        ctx.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dolphin Framework — Mongoose</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
      min-height: 100vh; color: #fff; padding: 2rem;
    }
    .container { max-width: 860px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 2.5rem; }
    .logo { font-size: 4rem; }
    h1 { font-size: 2.3rem; font-weight: 700; margin: 0.5rem 0; }
    .tagline { color: #a0c4d8; font-size: 1rem; }
    .badge {
      display: inline-block; background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2); padding: 0.25rem 0.75rem;
      border-radius: 999px; font-size: 0.82rem; margin: 0.2rem;
    }
    .green { border-color: #4ade80; color: #4ade80; }
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
      <p class="tagline">Real Mongoose Adapter · MongoDB Engine · CRUD Verified</p>
      <div style="margin-top:1rem;">
        <span class="badge green">✅ MongoDB Connected</span>
        <span class="badge">Mongoose ORM</span>
        <span class="badge">enforceOwnership: false</span>
      </div>
    </div>

    <div class="section">
      <h2>Products CRUD API (Real Mongoose)</h2>
      <div class="ep"><span class="method get">GET</span><code>/products</code><span>सबै products ल्याउनु</span></div>
      <div class="ep"><span class="method get">GET</span><code>/products/:id</code><span>ID बाट एउटा product ल्याउनु</span></div>
      <div class="ep"><span class="method post">POST</span><code>/products</code><span>नयाँ product बनाउनु (body: JSON)</span></div>
      <div class="ep"><span class="method put">PUT</span><code>/products/:id</code><span>ID बाट product update गर्नु</span></div>
      <div class="ep"><span class="method del">DELETE</span><code>/products/:id</code><span>ID बाट product मेटाउनु</span></div>
      <p class="note">* mongodb-memory-server — Real Mongoose engine, server restart भएमा data reset हुन्छ</p>
    </div>

    <div class="section">
      <h2>Utility Endpoints</h2>
      <div class="ep"><span class="method get">GET</span><code>/api/health</code><span>Health + DB status</span></div>
      <div class="ep"><span class="method get">GET</span><code>/api/info</code><span>Framework + adapter info</span></div>
      <div class="ep"><span class="method post">POST</span><code>/api/echo</code><span>Request body echo</span></div>
    </div>
  </div>
</body>
</html>`);
    });
    // 5. Start server
    const PORT = 5000;
    app.listen(PORT, () => {
        console.log(`🐬 Dolphin + Real Mongoose running at http://0.0.0.0:${PORT}`);
        console.log(`   MongoDB URI: ${uri}`);
        console.log(`   CRUD: GET/POST /products  |  GET/PUT/DELETE /products/:id`);
    });
}
bootstrap().catch(err => {
    console.error('❌ Bootstrap failed:', err);
    process.exit(1);
});
//# sourceMappingURL=demo-server.js.map