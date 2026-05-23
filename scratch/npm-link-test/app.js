import { createDolphinServer } from 'dolphin-server-modules/server';
import http from 'http';

const app = createDolphinServer();

const server = app.listen(3010, async () => {
    console.log('Linked Test Server started on 3010');
    
    // Test fetching the client script
    http.get('http://localhost:3010/dolphin-client.js', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200 && data.includes('DolphinClient')) {
                console.log('✅ NPM LINK TEST: client.js served successfully!');
                console.log('Content size:', data.length, 'bytes');
            } else {
                console.error('❌ NPM LINK TEST: Failed to serve client.js. Status:', res.statusCode);
            }
            server.close();
            process.exit(res.statusCode === 200 ? 0 : 1);
        });
    }).on('error', (err) => {
        console.error('Fetch error:', err.message);
        server.close();
        process.exit(1);
    });
});
