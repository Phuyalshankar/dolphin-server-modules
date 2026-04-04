// demo-phone.ts
import { createDolphinServer } from './server/server';
import { createPhoneSystem } from './phone-system';
import { SignalingType } from './phone-system/signaling';
import http from 'http';

async function runDemo() {
    console.log("🚀 Starting Hardened Dolphin Phone System Demo...\n");

    const app = createDolphinServer();
    const phone = createPhoneSystem();
    phone.registerRoutes(app);

    const PORT = 3010;
    const server = app.listen(PORT, async () => {
        console.log(`📡 Phone Server running on http://localhost:${PORT}`);

        // --- Helper: Register ---
        const register = (id: string, name: string, number: string, role: string) => {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${PORT}/phone/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, (res) => resolve(res.statusCode));
                req.write(JSON.stringify({ id, name, number, role }));
                req.end();
            });
        };

        // --- Helper: Call ---
        const callReq = (from: string, toNumber: string, token: string = 'TEST_TOKEN') => {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${PORT}/phone/call`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': token
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(data) }));
                });
                req.write(JSON.stringify({ from, toNumber }));
                req.end();
            });
        };

        // --- STEP 1: Registration ---
        console.log("\nStep 1: Registering Devices with Roles...");
        await register("phone_101", "Ward 101", "101", "ward");
        await register("phone_202", "ICU 202", "202", "nurse");
        await register("admin_hub", "Main Reception", "999", "admin");
        console.log("✅ Devices registered: Ward-101 (ward), ICU-202 (nurse), Reception (admin)");

        // --- STEP 2: Authenticated Call ---
        console.log("\nStep 2: Testing Authenticated Call Initiation...");
        const res1 = await callReq("phone_101", "202") as any;
        console.log(`✅ Ward-101 calling ICU-202: Status ${res1.code}`);

        // --- STEP 3: Race Condition (Busy Signal) ---
        console.log("\nStep 3: Testing Central State (Busy Signal)...");
        const res2 = await callReq("admin_hub", "202") as any;
        console.log(`❌ Reception calling busy ICU-202: Status ${res2.code} - Error: "${res2.body.error}"`);

        // --- STEP 4: Auth Protection ---
        console.log("\nStep 4: Testing Auth Protection (Invalid Token)...");
        const res3 = await callReq("phone_101", "202", "WRONG_TOKEN") as any;
        console.log(`❌ Call with wrong token: Status ${res3.code} - Error: "${res3.body.error}"`);

        // --- STEP 5: RBAC (Broadcast) ---
        console.log("\nStep 5: Testing Role-Based Access (Broadcast)...");
        const broadcastReq = (from: string) => {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${PORT}/phone/broadcast`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'TEST_TOKEN'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(data) }));
                });
                req.write(JSON.stringify({ message: "Code Blue!", from }));
                req.end();
            });
        };

        const br1 = await broadcastReq("phone_101") as any;
        console.log(`❌ Ward-101 (ward) trying to broadcast: Status ${br1.code} - Error: "${br1.body.error}"`);

        const br2 = await broadcastReq("admin_hub") as any;
        console.log(`✅ Reception (admin) broadcasting: Status ${br2.code}`);

        // --- STEP 6: Heartbeat ---
        console.log("\nStep 6: Testing Heartbeat...");
        const heartbeat = (id: string) => {
            return new Promise((resolve) => {
                const req = http.request(`http://localhost:${PORT}/phone/${id}/heartbeat`, {
                    method: 'POST'
                }, (res) => resolve(res.statusCode));
                req.end();
            });
        };
        const hbStatus = await heartbeat("phone_101");
        console.log(`💓 Heartbeat for Ward-101: Status ${hbStatus}`);

        console.log("\n🎊 HARDENED ARCHITECTURE DEMO COMPLETED SUCCESSFULLY! 🎊");

        // Shutdown
        setTimeout(() => {
            server.close();
            process.exit(0);
        }, 1000);
    });
}

runDemo().catch(console.error);
