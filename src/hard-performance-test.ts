// hard-performance-test.ts - Intensive performance test
import { createServer } from "http";
import { cpus } from "os";
import cluster from "cluster";

const PORT = 3006;
const CONCURRENCY = 100; // Increased concurrency
const DURATION_MS = 10000; // Longer duration

if (cluster.isMaster) {
  const numWorkers = cpus().length;
  console.log(`🍴 Master running, forking ${numWorkers} workers for hard test...`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  let results: { workerId: number; total: number; success: number; rps: number; latency: number }[] = [];

  for (const id in cluster.workers) {
    cluster.workers[id]?.on("message", (msg) => {
      if (msg.type === "result") {
        results.push(msg.data);
        if (results.length === numWorkers) {
          console.log("\n📊 HARD CLUSTER PERFORMANCE RESULTS:");
          results.forEach((r) => {
            console.log(`Worker ${r.workerId}: ${r.rps} RPS | Avg Latency: ${r.latency}ms | Total: ${r.total}, Success: ${r.success}`);
          });
          const totalRPS = results.reduce((sum, r) => sum + r.rps, 0);
          console.log(`\nTotal RPS across all workers: ${totalRPS.toFixed(2)}`);
          process.exit(0);
        }
      }
    });
  }
} else {
  // Worker process
  const app = createServer((req, res) => {
    if (req.url === "/hard-perf") {
      // Simulate some processing delay
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", time: Date.now() }));
      }, Math.random() * 10); // Random delay 0-10ms
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on port ${PORT}`);

    // Benchmark inside worker
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalLatency = 0;
    const startTime = Date.now();

    const http = require("http");

    const makeRequest = (): Promise<void> => {
      const requestStart = Date.now();
      return new Promise((resolve) => {
        if (Date.now() - startTime > DURATION_MS) return resolve();

        const req = http.get(`http://localhost:${PORT}/hard-perf`, (res: any) => {
          totalRequests++;
          if (res.statusCode === 200) successfulRequests++;
          totalLatency += Date.now() - requestStart;
          res.resume();
          res.on("end", () => {
            if (Date.now() - startTime < DURATION_MS) makeRequest().then(resolve);
            else resolve();
          });
        });

        req.on("error", () => {
          totalRequests++;
          resolve();
        });
      });
    };

    const promises = Array.from({ length: CONCURRENCY }, () => makeRequest());

    Promise.all(promises).then(() => {
      const actualDuration = (Date.now() - startTime) / 1000;
      const rps = (successfulRequests / actualDuration).toFixed(2);
      const avgLatency = successfulRequests > 0 ? (totalLatency / successfulRequests).toFixed(2) : '0';
      process.send?.({
        type: "result",
        data: {
          workerId: process.pid,
          total: totalRequests,
          success: successfulRequests,
          rps: Number(rps),
          latency: Number(avgLatency),
        },
      });
    });
  });
}