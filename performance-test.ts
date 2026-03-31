// performance-test.ts
import { createDolphinServer } from "./server/server";
import http from "http";

async function runBenchmark() {
  const app = createDolphinServer();
  app.get("/perf", (ctx) => {
    return { status: "ok", time: Date.now() };
  });

  const PORT = 3005;
  const server = app.listen(PORT, async () => {
    console.log(`🚀 Benchmark server running on port ${PORT}\n`);

    const DURATION_MS = 5000; // 5 seconds test
    const CONCURRENCY = 50;   // 50 concurrent requests
    
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalLatency = 0;
    const startTime = Date.now();

    console.log(`📊 Starting Test: ${CONCURRENCY} concurrent requests for ${DURATION_MS / 1000} seconds...`);

    const makeRequest = (): Promise<void> => {
      const requestStart = Date.now();
      return new Promise((resolve) => {
        if (Date.now() - startTime > DURATION_MS) return resolve();

        const req = http.get(`http://localhost:${PORT}/perf`, (res) => {
            totalRequests++;
            if (res.statusCode === 200) successfulRequests++;
            totalLatency += Date.now() - requestStart;
            
            // Drain the response
            res.resume();
            res.on('end', () => {
                // Continue if within time limit
                if (Date.now() - startTime < DURATION_MS) {
                    makeRequest().then(resolve);
                } else {
                    resolve();
                }
            });
        });

        req.on('error', (e) => {
            totalRequests++;
            console.error(`Request error: ${e.message}`);
            resolve();
        });
      });
    };

    // Fill the pipeline with concurrent requests
    const promises = Array.from({ length: CONCURRENCY }, () => makeRequest());

    await Promise.all(promises);

    const actualDuration = (Date.now() - startTime) / 1000;
    const rps = (successfulRequests / actualDuration).toFixed(2);
    const avgLatency = (totalLatency / successfulRequests).toFixed(2);

    console.log("\n📈 PERFORMANCE RESULTS:");
    console.log("------------------------");
    console.log(`✅ Total Requests:    ${totalRequests}`);
    console.log(`✅ Successful:         ${successfulRequests}`);
    console.log(`✅ Time Elapsed:       ${actualDuration} seconds`);
    console.log(`🔥 Requests per Sec:   ${rps} RPS`);
    console.log(`⚡ Average Latency:    ${avgLatency} ms`);
    console.log("------------------------\n");

    server.close();
  });
}

runBenchmark().catch(console.error);
