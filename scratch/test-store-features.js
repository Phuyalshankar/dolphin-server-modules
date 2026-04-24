const { DolphinClient } = require('../scripts/client');
const assert = require('assert');

// Mock fetch for the store's initial sync
global.fetch = async (url) => {
    if (url.includes('/products')) {
        return {
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => [
                { id: '1', name: 'Apple', price: 100 },
                { id: '2', name: 'Banana', price: 50 },
                { id: '3', name: 'Cherry', price: 200 }
            ]
        };
    }
};

async function testStoreFeatures() {
    console.log('--- Testing DolphinStore New Features ---');
    const dolphin = new DolphinClient('localhost:3000');
    
    // Trigger initial fetch
    const products = dolphin.store.products;
    
    // Wait for "loading" to finish (mock is immediate but _fetchAndSync is async)
    await new Promise(r => setTimeout(r, 100));
    
    console.log('[Initial Data]:', products.items.map(p => p.name).join(', '));
    assert.strictEqual(products.items.length, 3);

    // Test 1: Sorting (orderBy)
    console.log('[Test 1] Ordering by price asc...');
    products.orderBy('price', 'asc');
    assert.strictEqual(products.items[0].name, 'Banana');
    assert.strictEqual(products.items[2].name, 'Cherry');
    console.log('✅ Ordering ASC passed');

    console.log('[Test 2] Ordering by price desc...');
    products.orderBy('price', 'desc');
    assert.strictEqual(products.items[0].name, 'Cherry');
    assert.strictEqual(products.items[2].name, 'Banana');
    console.log('✅ Ordering DESC passed');

    // Test 3: Filtering (where)
    console.log('[Test 3] Filtering price > 75...');
    products.where(p => p.price > 75);
    assert.strictEqual(products.items.length, 2);
    assert.ok(products.items.every(p => p.price > 75));
    console.log('✅ Filtering passed');

    // Test 4: Combined Filter and Sort
    console.log('[Test 4] Combined Filter (price > 75) and Sort (name asc)...');
    products.where(p => p.price > 75).orderBy('name', 'asc');
    assert.strictEqual(products.items.length, 2);
    assert.strictEqual(products.items[0].name, 'Apple');
    assert.strictEqual(products.items[1].name, 'Cherry');
    console.log('✅ Combined Query passed');

    // Test 5: Realtime Update compatibility
    console.log('[Test 5] Simulating realtime create (Date)...');
    // Manually trigger remote update like a WebSocket message would
    // @ts-ignore
    dolphin.store._handleRemoteUpdate('products', { 
        type: 'create', 
        data: { id: '4', name: 'Date', price: 150 } 
    });
    
    // Should be filtered (price > 75) and sorted (name asc)
    // Result should be: Apple (100), Cherry (200), Date (150) -> Alphabetical: Apple, Cherry, Date
    assert.strictEqual(products.items.length, 3);
    assert.strictEqual(products.items[1].name, 'Cherry');
    assert.strictEqual(products.items[2].name, 'Date');
    console.log('✅ Realtime re-sorting passed');

    console.log('\n--- All New Store Features Passed! 🐬 ---');
}

testStoreFeatures().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
