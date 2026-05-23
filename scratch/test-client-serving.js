import { createDolphinServer } from '../dist/server/server.js';
import http from 'http';

const app = createDolphinServer();
const server = app.listen(3009, () => {
    console.log('Test server started on 3009');
    
    http.get('http://localhost:3009/dolphin-client.js', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200 && data.includes('DolphinClient')) {
                console.log('✅ client.js served successfully!');
                console.log('Content length:', data.length);
            } else {
                console.error('❌ Failed to serve client.js. Status:', res.statusCode);
                console.error('Data start:', data.substring(0, 100));
            }
            server.close();
            process.exit(res.statusCode === 200 ? 0 : 1);
        });
    }).on('error', (err) => {
        console.error('Error fetching client:', err.message);
        server.close();
        process.exit(1);
    });
});
