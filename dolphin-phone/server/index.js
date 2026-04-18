const { createDolphinServer } = require('./lib/server/server');
const { RealtimeCore } = require('./lib/realtime/core');
const { createSignaling } = require('./lib/signaling/index');
const mongoose = require('mongoose');
const { Device, CallHistory, Message } = require('./models');

// --- Configuration ---
const PORT = 5001;
const MONGO_URI = 'mongodb://localhost:27017/dolphin-phone';

async function start() {
    try {
        // 1. Connect MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
        try {
        // Clean up any dirty records that might break unique indexes
        await Device.deleteMany({ $or: [{ deviceId: null }, { deviceId: { $exists: false } }] });
        await Device.syncIndexes();
        } catch (e) {
            console.error('⚠️ Index sync failed:', e);
        }

        // 2. Initialize Dolphin Realtime & Signaling
        const realtime = new RealtimeCore({ debug: true });
        const signaling = createSignaling(realtime);

        // 3. Create Dolphin Server
        const app = createDolphinServer({ realtime });

        // --- Middleware: CORS ---
        app.use((ctx, next) => {
            ctx.setHeader('Access-Control-Allow-Origin', '*');
            ctx.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            ctx.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (ctx.req.method === 'OPTIONS') {
                return ctx.status(204).json({});
            }
            next();
        });

        // --- Auth Middlewares & Logic ---
        app.post('/auth/register', async (ctx) => {
            const { deviceId, name, room } = ctx.body;
            let device = await Device.findOne({ deviceId });
            if (!device) {
                device = await Device.create({ deviceId, name, room });
            }
            return { success: true, device };
        });

        app.get('/devices', async (ctx) => {
            const devices = await Device.find({});
            return { success: true, data: devices };
        });

        // --- History Endpoints ---
        app.get('/history/calls', async (ctx) => {
            const history = await CallHistory.find({
                $or: [{ from: ctx.query.deviceId }, { to: ctx.query.deviceId }]
            }).sort({ timestamp: -1 }).limit(20);
            return { success: true, data: history };
        });

        app.get('/history/messages', async (ctx) => {
            const { from, to } = ctx.query;
            const messages = await Message.find({
                $or: [
                    { from, to },
                    { from: to, to: from }
                ]
            }).sort({ timestamp: 1 });
            return { success: true, data: messages };
        });

        // --- Custom Realtime Handlers for Persistence ---
        // Track pending calls: callKey -> { from, to, type, startTime, accepted }
        const pendingCalls = new Map();

        realtime.subscribe('phone/signaling/+', async (payload) => {
            const key = [payload.from, payload.to].sort().join('__');

            if (payload.type === 'INVITE') {
                pendingCalls.set(key, {
                    from: payload.from,
                    to: payload.to,
                    type: payload.data?.video ? 'video' : 'audio',
                    startTime: Date.now(),
                    accepted: false
                });
            }

            if (payload.type === 'ACCEPT') {
                const call = pendingCalls.get(key);
                if (call) call.accepted = true;
            }

            if (payload.type === 'END' || payload.type === 'REJECT') {
                const call = pendingCalls.get(key);
                if (call) {
                    const duration = Math.floor((Date.now() - call.startTime) / 1000);
                    let status = 'completed';
                    if (!call.accepted) {
                        status = payload.type === 'REJECT' ? 'rejected' : 'missed';
                    }
                    await CallHistory.create({
                        from: call.from,
                        to: call.to,
                        status,
                        type: call.type,
                        duration: call.accepted ? duration : 0
                    });
                    pendingCalls.delete(key);
                }
            }
        });

        // Save chat messages sent via signaling
        realtime.subscribe('phone/signaling/+', async (payload) => {
            if (payload.type === 'CHAT' && payload.from && payload.to && payload.text) {
                await Message.create({
                    from: payload.from,
                    to: payload.to,
                    content: payload.text
                });
            }
        });

        // 4. Start Server
        app.listen(PORT, () => {
            console.log(`🐬 Dolphin Phone Server is active at http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error('❌ Server failed to start:', err);
    }
}

start();
