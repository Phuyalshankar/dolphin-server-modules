// performance-cluster.ts
import { createServer } from "http";
import { cpus } from "os";
import cluster from "cluster";

const PORT = 3005;
const CONCURRENCY = 50;
const DURATION_MS = 5000;

if (cluster.isMaster) {
  const numWorkers = cpus().length;
  console.log(`🍴 Master running, forking ${numWorkers} workers...`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  let results: { workerId: number; total: number; success: number; rps: number; latency: number }[] = [];

  for (const id in cluster.workers) {
    cluster.workers[id]?.on("message", (msg) => {
      if (msg.type === "result") {
        results.push(msg.data);
        if (results.length === numWorkers) {
          console.log("\n📊 CLUSTER PERFORMANCE RESULTS:");
          results.forEach((r) => {
            console.log(`Worker ${r.workerId}: ${r.rps} RPS | Avg Latency: ${r.latency}ms | Total: ${r.total}, Success: ${r.success}`);
          });
          process.exit(0);
        }
      }
    });
  }
} else {
  // Worker process
  const app = createServer((req, res) => {
    if (req.url === "/perf") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", time: Date.now() }));
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

        const req = http.get(`http://localhost:${PORT}/perf`, (res: any) => {
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
      const avgLatency = (totalLatency / successfulRequests).toFixed(2);
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