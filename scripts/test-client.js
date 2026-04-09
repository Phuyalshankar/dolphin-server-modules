/**
 * Dolphin Client Logic Test
 * This script verifies the core logic of client.js without needing a real server.
 */

const { DolphinClient } = require('./client');

// --- Mocks ---
global.fetch = async (url, options) => {
    console.log(`[Mock Fetch] ${options.method || 'GET'} ${url}`);
    return {
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true, message: 'Mock response', data: { url, method: options.method } })
    };
};

class MockWebSocket {
    constructor(url) {
        console.log(`[Mock WS] Connecting to ${url}`);
        this.readyState = 1; // OPEN
        setTimeout(() => this.onopen && this.onopen(), 10);
    }
    send(data) { console.log(`[Mock WS] Sending: ${data}`); }
    close() { console.log(`[Mock WS] Closing`); }
}
global.WebSocket = MockWebSocket;

// Storage Mock
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

async function runTests() {
    console.log('--- Starting DolphinClient Tests ---');

    // 1. Constructor & Protocol Test
    console.log('\n[Test 1] Protocol Detection');
    const c1 = new DolphinClient('https://api.example.com');
    if (c1.httpUrl !== 'https://api.example.com') throw new Error(`Https protocol failed: ${c1.httpUrl}`);
    
    const c2 = new DolphinClient('localhost:3000');
    // Default should be http if not specified and not in browser
    if (!c2.httpUrl.startsWith('http://')) throw new Error(`Default protocol failed: ${c2.httpUrl}`);
    console.log('✅ Protocol detection passed');

    // 2. API Proxy & Method Test
    console.log('\n[Test 2] API Handler (Proxy & Methods)');
    const dolphin = new DolphinClient('localhost:3000');
    
    // Test direct get
    await dolphin.api.get('/products');
    
    // Test proxy path
    // Under the hood, this calls this._createProxy(['users']).get()
    await dolphin.api.users.get();
    
    // Test post with body
    await dolphin.api.post('/auth/login', { email: 'test@test.com' });
    
    console.log('✅ API Proxy passed');

    // 4. Clashing Property Test
    console.log('\n[Test 4] Clashing Property Names (Function built-ins)');
    try {
        const callProp = dolphin.api.call;
        const callType = typeof callProp;
        console.log(`- Type of dolphin.api.call: ${callType}`);
        
        // Since our proxy target is a function, typeof will be 'function'.
        // To verify it's OUR proxy and not the built-in call, check for our methods.
        const isOurProxy = typeof callProp.post === 'function';
        console.log(`- Has .post() method: ${isOurProxy}`);
        
        if (!isOurProxy) {
            throw new Error(`Clashing property 'call' was not shadowed by our proxy.`);
        }
        console.log('✅ Clashing properties shadowed successfully');
    } catch (e) {
        console.log(`❌ Clashing property failed: ${e.message}`);
        throw e;
    }

    // 3. Subscription & Memory Cleanup Test
    console.log('\n[Test 3] Subscriptions & Event Cleanup');
    let callCount = 0;
    const cb = () => callCount++;
    
    dolphin.subscribe('test', cb);
    if (!dolphin.handlers.has('test')) throw new Error('Subscribe failed');
    
    dolphin.unsubscribe('test', cb);
    if (dolphin.handlers.has('test')) throw new Error('Unsubscribe failed');
    
    console.log('✅ Event management passed');

    console.log('\n--- All Logic Tests Passed! 🐬 ---');
}

runTests().catch(err => {
    console.error('❌ Test Failed:', err);
    process.exit(1);
});
