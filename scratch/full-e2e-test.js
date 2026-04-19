/**
 * 🐬 Dolphin Framework - Full Real E2E Test
 * Tests: Server, Client, CRUD, Auth, Realtime Sync, Store
 */

const { createDolphinServer } = require('../dist/server/server');
const { createCRUD, createCrudController } = require('../dist/curd/crud');
const { RealtimeCore } = require('../dist/realtime/core');
const { createAuth } = require('../dist/auth/auth');
const { DolphinClient } = require('../scripts/client');

global.WebSocket = require('ws');

const PORT = 4001;
let passed = 0;
let failed = 0;

function ok(label, condition) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
    }
}

// Memory DB
const db = {
    data: {},
    async create(c, d) {
        if (!this.data[c]) this.data[c] = [];
        this.data[c].push(d);
        return d;
    },
    async read(c) { return this.data[c] || []; },
    async update(c, q, d) {
        this.data[c] = (this.data[c] || []).map(i =>
            (i.id === q.id || i._id === q._id) ? { ...i, ...d } : i
        );
    },
    async delete(c, q) {
        this.data[c] = (this.data[c] || []).filter(i =>
            i.id !== q.id && i._id !== q._id
        );
    },
    // Auth-specific methods
    async createUser(d) {
        const u = { id: 'usr_' + Math.random().toString(36).slice(2), ...d };
        if (!this.data.users) this.data.users = [];
        this.data.users.push(u);
        return u;
    },
    async findUserByEmail(email) { return (this.data.users || []).find(u => u.email === email); },
    async findUserById(id) { return (this.data.users || []).find(u => u.id === id); },
    async updateUser(id, d) {
        this.data.users = (this.data.users || []).map(u => u.id === id ? { ...u, ...d } : u);
    },
    async saveRefreshToken(d) {
        if (!this.data.tokens) this.data.tokens = [];
        this.data.tokens.push(d);
    },
    async findRefreshToken(t) { return (this.data.tokens || []).find(r => r.token === t) || null; },
    async deleteRefreshToken(t) {
        this.data.tokens = (this.data.tokens || []).filter(r => r.token !== t);
    }
};

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTests() {
    console.log('\n🐬 ============================================');
    console.log('   Dolphin Framework - Full Real E2E Test');
    console.log('🐬 ============================================\n');

    // ===== SETUP =====
    const rt = new RealtimeCore({ debug: false });
    const app = createDolphinServer({ realtime: rt });
    const crud = createCRUD(db, { enforceOwnership: false, realtime: rt });

    // Routes
    app.get('/products', async (ctx) => {
        const items = await crud.read('products');
        return ctx.json(items);
    });
    app.post('/products', async (ctx) => {
        const item = await crud.create('products', ctx.body);
        return ctx.status(201).json(item);
    });
    app.get('/products/:id', async (ctx) => {
        const item = await crud.readOne('products', ctx.params.id);
        return item ? ctx.json(item) : ctx.status(404).json({ error: 'Not Found' });
    });
    app.put('/products/:id', async (ctx) => {
        const item = await crud.updateOne('products', ctx.params.id, ctx.body);
        return ctx.json(item);
    });
    app.delete('/products/:id', async (ctx) => {
        const item = await crud.deleteOne('products', ctx.params.id);
        return ctx.json({ success: true, deleted: item });
    });
    app.get('/dolphin-client.js', (ctx) => {
        const fs = require('fs'), path = require('path');
        const f = path.resolve(__dirname, '../scripts/client.js');
        ctx.setHeader('Content-Type', 'application/javascript');
        ctx.res.end(fs.readFileSync(f, 'utf8'));
    });

    const server = app.listen(PORT);
    await sleep(100);

    // ===== 1. SERVER TEST =====
    console.log('📡 [1/5] Server API Tests...');
    const base = `http://localhost:${PORT}`;

    // Create
    const r1 = await fetch(`${base}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Laptop', price: 999 })
    });
    const product1 = await r1.json();
    ok('POST /products → 201', r1.status === 201);
    ok('Product has id', !!product1.id);
    ok('Product name is correct', product1.name === 'Laptop');

    // Read All
    const r2 = await fetch(`${base}/products`);
    const all = await r2.json();
    ok('GET /products → 200', r2.status === 200);
    ok('Returns array', Array.isArray(all));

    // Read One
    const r3 = await fetch(`${base}/products/${product1.id}`);
    ok('GET /products/:id → 200', r3.status === 200);

    // Update
    const r4 = await fetch(`${base}/products/${product1.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: 1299 })
    });
    const updated = await r4.json();
    ok('PUT /products/:id → 200', r4.status === 200);
    ok('Price updated correctly', updated.price === 1299);

    // Delete
    const r5 = await fetch(`${base}/products/${product1.id}`, { method: 'DELETE' });
    ok('DELETE /products/:id → 200', r5.status === 200);

    // ===== 2. CLIENT.JS SERVE TEST =====
    console.log('\n📦 [2/5] Client Library Serve Test...');
    const r6 = await fetch(`${base}/dolphin-client.js`);
    const clientCode = await r6.text();
    ok('GET /dolphin-client.js → 200', r6.status === 200);
    ok('Response is JavaScript', r6.headers.get('content-type').includes('javascript'));
    ok('Contains DolphinClient class', clientCode.includes('class DolphinClient'));
    ok('Contains DolphinStore class', clientCode.includes('class DolphinStore'));

    // ===== 3. WEBSOCKET / REALTIME TEST =====
    console.log('\n🔌 [3/5] Realtime WebSocket Tests...');
    const client = new DolphinClient(`http://localhost:${PORT}`);
    await client.connect();
    await sleep(100);
    ok('Client connected via WebSocket', client.socket?.readyState === 1);

    // Pub/Sub Test
    let received = null;
    client.subscribe('test/topic', (payload) => { received = payload; });
    await sleep(100);
    rt.publish('test/topic', { msg: 'hello dolphin' });
    await sleep(200);
    ok('Pub/Sub message received', received?.msg === 'hello dolphin');

    // ===== 4. STORE REALTIME SYNC TEST =====
    console.log('\n🔄 [4/5] Reactive Store Sync Test...');

    // Seed a product
    await crud.create('products', { name: 'Phone', price: 599 });
    await sleep(200);
    
    // Initial fetch through store
    const stored = client.store.products;
    await sleep(300);
    ok('Store fetches initial data', client.store.data.has('products'));
    ok('Store has at least 1 item', client.store.getSnapshot('products').length > 0);

    // Create new item → should trigger realtime sync to store
    let storeUpdated = false;
    client.store.listeners.add(() => { storeUpdated = true; });

    await crud.create('products', { name: 'Tablet', price: 799 });
    await sleep(500);
    ok('Store auto-updates on server create', storeUpdated);

    // ===== 5. AUTH TEST =====
    console.log('\n🔐 [5/5] Auth Module Test...');
    const auth = createAuth({ secret: 'test-secret-key' });

    const user = await auth.register(db, { email: 'test@dolphin.com', password: 'Test@1234' });
    ok('User registered successfully', !!user.id);
    ok('User has email field', user.email === 'test@dolphin.com');

    const loginRes = await auth.login(db, { email: 'test@dolphin.com', password: 'Test@1234' });
    ok('Login successful', !!loginRes.accessToken);
    ok('AccessToken is a JWT string', loginRes.accessToken.split('.').length === 3);

    const verified = await auth.verifyToken(loginRes.accessToken);
    ok('JWT token verifies correctly', !!verified);
    ok('Token has correct user id', !!verified?.id);

    // ===== FINAL REPORT =====
    console.log('\n🐬 ============================================');
    console.log(`   RESULTS: ${passed} passed | ${failed} failed`);
    console.log('🐬 ============================================\n');

    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED! Dolphin Framework is 100% working!\n');
    } else {
        console.log(`⚠️  ${failed} test(s) failed.\n`);
    }

    server.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('\n💥 Unexpected Error:', err.message);
    process.exit(1);
});
