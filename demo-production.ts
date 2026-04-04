// demo-production.ts
import { createDolphinServer } from './server/server';
import { createPhoneSystem } from './phone-system';
import WebSocket from 'ws';
import axios from 'axios';

async function runProductionDemo() {
    console.log('🚀 Starting Production-Grade Dolphin Phone System Demo (v2.0)...\n');

    // 1. Initialize Server with WebSocket & Phone System
    const app = createDolphinServer();
    const phone = createPhoneSystem({ 
        // options.redis would go here for distributed state
    });

    phone.registerRoutes(app);
    app.listen(3015, () => console.log('📡 Production Server active on http://localhost:3015'));

    const API_URL = 'http://localhost:3015/phone';
    const WS_URL = 'ws://localhost:3015/phone?deviceId=WARD_777';

    try {
        // 2. Initial Registration (Admin setup)
        console.log('Step 1: Registering Production Devices...');
        await axios.post(`${API_URL}/register`, {
            id: 'WARD_777',
            name: 'Emergency Ward 777',
            number: '777',
            role: 'ward'
        });
        await axios.post(`${API_URL}/register`, {
            id: 'EMERGENCY_911',
            name: 'Dispatch 911',
            number: '911',
            role: 'nurse'
        });
        console.log('✅ Devices registered.\n');

        // 3. Login to get Production JWT
        console.log('Step 2: Authenticating & Issuing JWT...');
        const loginRes = await axios.post(`${API_URL}/login`, { id: 'WARD_777' });
        const token = loginRes.data.token;
        console.log(`✅ JWT Issued: ${token.substring(0, 20)}...\n`);

        // 4. Connect via WebSocket (Production Transport)
        console.log('Step 3: Establishing Persistent WebSocket Connection...');
        const ws = new WebSocket(WS_URL);

        ws.on('open', () => {
            console.log('✅ WebSocket Connected. Signaling handshakes ready.\n');
            
            // 5. Test Secure Signaling via REST (with JWT)
            console.log('Step 4: Testing Secure Signaling (REST with Bearer Auth)...');
            axios.post(`${API_URL}/call`, 
                { from: 'WARD_777', toNumber: '911' },
                { headers: { 'Authorization': `Bearer ${token}` } }
            ).then(res => {
                console.log(`✅ Secure Call Initiate Status: ${res.status}`);
                console.log('🎉 PRODUCTION UPGRADE V2.0 VERIFIED!\n');
                process.exit(0);
            }).catch(err => {
                console.log(`❌ Secure Signaling Failed: ${err.response?.status}`);
                process.exit(1);
            });
        });

        ws.on('error', (err) => {
            console.error('❌ WebSocket Connection Error:', err.message);
            process.exit(1);
        });

    } catch (err: any) {
        console.error('❌ Demo Error:', err.response?.data || err.message);
        process.exit(1);
    }
}

runProductionDemo();
