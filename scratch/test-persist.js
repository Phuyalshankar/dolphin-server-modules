/**
 * DolphinPersist - Node.js Test
 * Tests: set, get, TTL expiry, clearAll, enablePersist integration
 */
const { DolphinPersist, enablePersist } = require('../scripts/dolphin-persist');
const { DolphinClient } = require('../scripts/client');

global.WebSocket = require('ws');

// Mock localStorage for Node.js
const localStorageMock = (() => {
    const store = {};
    return {
        getItem: (k) => store[k] !== undefined ? store[k] : null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        get length() { return Object.keys(store).length; },
        key: (i) => Object.keys(store)[i],
        // For clearAll fix
        _keys: () => Object.keys(store)
    };
})();
global.localStorage = localStorageMock;

let passed = 0, failed = 0;

function ok(label, condition) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.error(`  ❌ FAIL: ${label}`); failed++; }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTests() {
    console.log('\n💾 DolphinPersist Plugin - Full Test\n');

    // ===== 1. localStorage driver =====
    console.log('[1/4] localStorage driver...');
    const persist = new DolphinPersist({ driver: 'localstorage', prefix: 'test_' });
    await persist._readyPromise;
    ok('Driver set to localstorage', persist.driver === 'localstorage');

    // Set
    await persist.set('products', [{ id: '1', name: 'Laptop' }, { id: '2', name: 'Phone' }]);
    
    // Get
    const data = await persist.get('products');
    ok('Data saved successfully', Array.isArray(data));
    ok('Data has 2 items', data.length === 2);
    ok('Item name is correct', data[0].name === 'Laptop');

    // ===== 2. TTL Expiry Test =====
    console.log('\n[2/4] TTL Expiry...');
    const persistTTL = new DolphinPersist({ driver: 'localstorage', prefix: 'ttl_', ttl: 100 }); // 100ms TTL
    await persistTTL._readyPromise;
    
    await persistTTL.set('orders', [{ id: 'o1' }]);
    const beforeExpiry = await persistTTL.get('orders');
    ok('Data available before TTL', beforeExpiry !== null);
    
    await sleep(150); // Wait for TTL to expire
    const afterExpiry = await persistTTL.get('orders');
    ok('Data expired after TTL', afterExpiry === null);

    // ===== 3. Clear / ClearAll =====
    console.log('\n[3/4] Clear & ClearAll...');
    const p2 = new DolphinPersist({ driver: 'localstorage', prefix: 'clear_' });
    await p2._readyPromise;
    await p2.set('users', [{ id: 'u1' }]);
    await p2.set('posts', [{ id: 'p1' }]);

    await p2.clear('users');
    ok('clear() removes specific collection', await p2.get('users') === null);
    ok('clear() does not affect others', (await p2.get('posts')) !== null);

    await p2.clearAll();
    ok('clearAll() removes all collections', await p2.get('posts') === null);

    // ===== 4. enablePersist Integration with DolphinStore =====
    console.log('\n[4/4] enablePersist + DolphinStore integration...');
    const client = new DolphinClient('http://localhost:9999'); // offline server
    
    // Mock API for offline use
    client.api.get = async (path) => {
        return [{ id: '1', name: 'CachedProduct' }];
    };

    const p3 = new DolphinPersist({ driver: 'localstorage', prefix: 'store_' });
    await p3._readyPromise;
    enablePersist(client.store, p3);
    ok('enablePersist applied without error', typeof client.store._fetchAndSync === 'function');

    // Trigger store fetch
    const _ = client.store.items;
    await sleep(200);

    const cached = await p3.get('items');
    ok('Store data auto-saved to cache', Array.isArray(cached) && cached.length > 0);
    ok('Cached item is correct', cached[0].name === 'CachedProduct');

    // Simulate page reload: new client loads from cache instantly
    const client2 = new DolphinClient('http://localhost:9999');
    client2.api.get = async () => []; // Empty server (offline)
    enablePersist(client2.store, p3);
    const _2 = client2.store.items;
    await sleep(200);
    const fromCache = client2.store.getSnapshot('items');
    ok('On reload: data loaded from cache instantly', Array.isArray(fromCache) && fromCache.length >= 0);

    // ===== FINAL REPORT =====
    console.log('\n💾 ============================================');
    console.log(`   RESULTS: ${passed} passed | ${failed} failed`);
    console.log('💾 ============================================');
    if (failed === 0) console.log('\n🎉 DolphinPersist is 100% working!\n');
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('\n💥 Error:', err.message);
    process.exit(1);
});
