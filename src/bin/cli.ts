#!/usr/bin/env node
import { createDolphinServer } from '../server/server';
import { RealtimeCore } from '../realtime/core';

async function start() {
    const port = parseInt(process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000');
    
    console.log('🐬 Starting Dolphin Server...');
    
    const rt = new RealtimeCore({ debug: true });
    const app = createDolphinServer({ realtime: rt });

    app.get('/', (ctx) => {
        ctx.html('<h1>Dolphin Server is running!</h1><p>Ready to use as an independent installation.</p>');
    });

    app.get('/api/status', (ctx) => {
        ctx.json({ status: 'online', version: '2.2.1' });
    });

    app.listen(port, () => {
        console.log(`✅ Dolphin Server running at http://localhost:${port}`);
    });
}

start().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
