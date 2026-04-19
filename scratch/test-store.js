const { DolphinClient } = require('../scripts/client.js');

async function testStore() {
    console.log('🧪 Testing DolphinStore Reactive Logic...');
    
    // 1. Setup Mock Client
    const client = new DolphinClient('localhost:3000');
    
    // Mock API request
    client.api.get = async (path) => {
        console.log(`🛰️ Mocking API GET: ${path}`);
        return [{ id: '1', name: 'Test Product' }];
    };

    // 2. Access store via Proxy
    console.log('🔍 Accessing dolphin.store.products...');
    const products = client.store.products; 
    
    // In our implementation, accessing it should trigger _fetchAndSync
    // Let's wait a bit for the "async fetch" to complete
    await new Promise(r => setTimeout(r, 100));

    if (client.store.data.has('products')) {
        console.log('✅ Store successfully fetched products via Proxy!');
        console.log('📦 Data:', client.store.data.get('products'));
    } else {
        throw new Error('❌ Store failed to fetch data');
    }

    // 3. Test Remote Update (Broadcast)
    console.log('📡 Mocking Remote Broadcast (Update)...');
    client.store._handleRemoteUpdate('products', {
        type: 'update',
        data: { id: '1', name: 'Updated Product Name' }
    });

    const updatedData = client.store.data.get('products');
    if (updatedData[0].name === 'Updated Product Name') {
        console.log('✅ Store successfully updated via Realtime message!');
    } else {
        throw new Error('❌ Store update failed');
    }

    // 4. Test Remote Delete
    console.log('🗑️ Mocking Remote Broadcast (Delete)...');
    client.store._handleRemoteUpdate('products', {
        type: 'delete',
        data: { id: '1' }
    });

    if (client.store.data.get('products').length === 0) {
        console.log('✅ Store successfully deleted item via Realtime message!');
    } else {
        throw new Error('❌ Store delete failed');
    }

    console.log('\n🌟 ALL CLIENT STORE TESTS PASSED!');
}

testStore().catch(err => {
    console.error(err);
    process.exit(1);
});
