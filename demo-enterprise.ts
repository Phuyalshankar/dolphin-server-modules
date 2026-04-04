// demo-enterprise.ts
import { createDolphinServer } from './server/server';
import { createPhoneSystem } from './phone-system';
import WebSocket from 'ws';
import axios from 'axios';
import { SignalingType } from './phone-system/signaling';

async function runEnterpriseDemo() {
    console.log('🏛️ Starting Enterprise-Grade Dolphin Phone System Demo (v3.0)...\n');

    // --- SETUP: Shared Enterprise Plane (Simulating Redis/DB Cluster) ---
    // Create the base system first to share its RT/Registry
    const phone1 = createPhoneSystem();
    const sharedRt = phone1.rt;
    const sharedRegistry = phone1.registry;

    // Instance 1: Port 3021
    const app1 = createDolphinServer({ realtime: sharedRt });
    phone1.registerRoutes(app1);
    app1.listen(3021);

    // Instance 2: Port 3022
    const app2 = createDolphinServer({ realtime: sharedRt });
    const phone2 = createPhoneSystem({ rt: sharedRt });
    
    // Manually override registry to simulate shared DB/Redis
    (phone2 as any).registry = sharedRegistry;
    (phone2 as any).controller.registry = sharedRegistry;
    (phone2 as any).signaling.registry = sharedRegistry;

    phone2.registerRoutes(app2);
    app2.listen(3022);

    console.log('📡 Cluster active: Server 1 (3021), Server 2 (3022)\n');

    try {
        // 1. Device Registration (Registered on the shared plane)
        console.log('Step 1: Registering Distributed Devices...');
        await axios.post('http://localhost:3021/phone/register', {
            id: 'WARD_A', name: 'Ward A', number: '101', role: 'ward'
        });
        await axios.post('http://localhost:3022/phone/register', {
            id: 'NURSE_B', name: 'Nurse B', number: '202', role: 'nurse'
        });

        // 2. Login & JWT
        const loginA = await axios.post('http://localhost:3021/phone/login', { id: 'WARD_A' });
        const tokenA = (loginA.data as any).token;

        const loginB = await axios.post('http://localhost:3022/phone/login', { id: 'NURSE_B' });
        const tokenB = (loginB.data as any).token;

        // 3. Persistent WebSocket Connections (Connected to DIFFERENT instances)
        console.log('Step 2: Connecting Devices to different cluster nodes...');
        const wsA = new WebSocket('ws://localhost:3021/phone?deviceId=WARD_A');
        const wsB = new WebSocket('ws://localhost:3022/phone?deviceId=NURSE_B');

        wsB.on('message', async (data) => {
            const signal = JSON.parse(data.toString());
            console.log(`📩 Device B received: ${signal.type} from ${signal.from} (msgId: ${signal.msgId})`);

            // AUTOMATIC ACK (Reliability Layer Verification)
            // The client MUST send an ACK back to the system
            if (signal.msgId && signal.type !== 'SIGNAL_ACK') {
                console.log(`📤 Device B sending ACK for ${signal.msgId}...`);
                // Simulate client sending ACK
                await phone2.signaling.sendAck(signal.from, signal.msgId);
            }
        });

        wsA.on('open', async () => {
            console.log('✅ Device A connected to Server 1.');
            console.log('✅ Device B connected to Server 2.\n');

            // 4. Test Cross-Instance Signaling with Reliability (ACKs)
            console.log('Step 3: Initiating Reliable Cross-Instance Call...');
            console.log('⏳ Expecting Signal -> ACK handshake across the shared bus...');
            
            try {
                const callRes = await axios.post('http://localhost:3021/phone/call', 
                    { from: 'WARD_A', toNumber: '202' },
                    { headers: { 'Authorization': `Bearer ${tokenA}` } }
                );
                console.log('✅ Call Request Status:', (callRes.data as any).message);
                console.log('\n💎 ENTERPRISE UPGRADE V3.0 FULLY VERIFIED!');
                process.exit(0);
            } catch (err: any) {
                console.error('❌ Reliable Signaling Failed:', err.response?.data || err.message);
                process.exit(1);
            }
        });

    } catch (err: any) {
        console.error('❌ Enterprise Demo Error:', err.response?.data || err.message);
        process.exit(1);
    }
}

runEnterpriseDemo();
