const { DolphinClient } = require('../scripts/client.js');

async function testClient() {
    console.log('🧪 Testing Dolphin Client...');
    
    // Mock global fetch for testing if no server is running
    global.fetch = async (url, options) => {
        console.log(`📡 Mock Fetch: ${options.method || 'GET'} ${url}`);
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true, message: 'Mock response from ' + url })
        };
    };

    const client = new DolphinClient('localhost:5000');
    
    try {
        console.log('1. Testing API GET...');
        const res = await client.api.products.get();
        console.log('✅ API GET Result:', res);

        console.log('2. Testing API POST...');
        const postRes = await client.api.products.post({ name: 'Test Product', price: 100 });
        console.log('✅ API POST Result:', postRes);

        console.log('3. Testing Auth login...');
        // This will try to call /auth/login
        const loginRes = await client.auth.login('test@example.com', 'password123');
        console.log('✅ Auth Login Result:', loginRes);

        console.log('🎉 Client test passed!');
    } catch (e) {
        console.error('❌ Client test failed:', e);
        process.exit(1);
    }
}

testClient();
