const { createDolphinServer } = require('../dist/server/server');
const { createCRUD } = require('../dist/curd/crud');
const { RealtimeCore } = require('../dist/realtime/core');
const { DolphinClient } = require('../scripts/client');

// Simple Memory Adapter for testing
const db = {
    data: {},
    async create(c, d) { this.data[c] = this.data[c] || []; this.data[c].push(d); return d; },
    async read(c, q) { return this.data[c] || []; }
};

async function realIntegrationTest() {
    console.log('🚀 Starting Real Integration Test...');
    const PORT = 3009;

    // 1. Setup Server
    const rt = new RealtimeCore({ debug: false });
    const app = createDolphinServer({ realtime: rt });
    const service = createCRUD(db, { realtime: rt, enforceOwnership: false });

    // API Route
    app.get('/products', async (ctx) => ctx.json(await service.read('products')));
    app.post('/products', async (ctx) => ctx.json(await service.create('products', ctx.body)));

    const server = app.listen(PORT);

    // 2. Setup Real Client
    const client = new DolphinClient(`http://localhost:${PORT}`);
    
    // In Node.js, we need to polyfill WebSocket for the client
    global.WebSocket = require('ws'); 
    
    await client.connect();
    console.log('🔌 Client Connected to Real Server');

    // 3. Use Store
    console.log('📦 Accessing dolphin.store.products...');
    const products = client.store.products; // This should trigger initial fetch

    // Wait for initial sync
    await new Promise(r => setTimeout(r, 200));
    console.log('📊 Initial Store Size:', client.store.getSnapshot('products').length);

    // 4. Perform Server-Side Action (Create Product)
    console.log('➕ Adding a new product via API...');
    await service.create('products', { name: 'World Class Laptop' });

    // 5. Verify Client-Side Auto-Update
    console.log('⏳ Waiting for Realtime Sync...');
    await new Promise(r => setTimeout(r, 500));

    const finalData = client.store.getSnapshot('products');
    console.log('📊 Final Store Size:', finalData.length);
    
    if (finalData.length > 0 && finalData[0].name === 'World Class Laptop') {
        console.log('✅ SUCCESS: Client Store updated automatically in real-time!');
    } else {
        console.log('❌ FAILURE: Sync failed');
        process.exit(1);
    }

    server.close();
    process.exit(0);
}

realIntegrationTest();
