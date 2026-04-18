import { createDolphinServer } from './server/server';
import http from 'http';

const PORT = 3007;
const CONCURRENCY = 50;
const DURATION_MS = 5000;

async function benchmark() {
    const app = createDolphinServer();
    app.get('/perf', (ctx) => {
        ctx.json({ status: 'ok', rps_test: true });
    });

    const server = app.listen(PORT, async () => {
        console.log(`🐬 Dolphin Benchmark Server running on port ${PORT}`);
        
        const getMemory = () => {
            const mem = process.memoryUsage();
            return {
                rss: (mem.rss / 1024 / 1024).toFixed(2) + ' MB',
                heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2) + ' MB'
            };
        };

        const memBefore = getMemory();
        console.log(`🧠 Memory BEFORE load: RSS: ${memBefore.rss}, Heap: ${memBefore.heapUsed}/${memBefore.heapTotal}`);
        
        let successfulRequests = 0;
        let totalLatency = 0;
        const startTime = Date.now();

        const makeRequest = (): Promise<void> => {
            const requestStart = Date.now();
            return new Promise((resolve) => {
                if (Date.now() - startTime > DURATION_MS) return resolve();

                const req = http.get(`http://localhost:${PORT}/perf`, (res) => {
                    if (res.statusCode === 200) successfulRequests++;
                    totalLatency += Date.now() - requestStart;
                    res.resume();
                    res.on('end', () => {
                        if (Date.now() - startTime < DURATION_MS) makeRequest().then(resolve);
                        else resolve();
                    });
                });

                req.on('error', () => resolve());
            });
        };

        console.log(`🚀 Starting single-process benchmark (Concurrency: ${CONCURRENCY})...`);
        const promises = Array.from({ length: CONCURRENCY }, () => makeRequest());

        await Promise.all(promises);

        const actualDuration = (Date.now() - startTime) / 1000;
        const rps = (successfulRequests / actualDuration).toFixed(2);
        const avgLatency = (totalLatency / successfulRequests).toFixed(2);
        const memAfter = getMemory();

        console.log('\n📊 DOLPHIN PERFORMANCE RESULTS (Single Process):');
        console.log(`Requests Per Second: ${rps}`);
        console.log(`Average Latency: ${avgLatency}ms`);
        console.log(`Total Successful Requests: ${successfulRequests}`);
        console.log(`🧠 Memory AFTER load: RSS: ${memAfter.rss}, Heap: ${memAfter.heapUsed}/${memAfter.heapTotal}`);
        
        server.close();
        process.exit(0);
    });
}

benchmark().catch(console.error);
