import { createDolphinServer } from './server/server';

const app = createDolphinServer();

app.get('/', (ctx: any) => {
  ctx.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dolphin Framework</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      max-width: 860px;
      width: 90%;
      text-align: center;
    }
    .logo { font-size: 5rem; margin-bottom: 1rem; }
    h1 { font-size: 2.8rem; font-weight: 700; margin-bottom: 0.5rem; }
    .tagline { font-size: 1.15rem; color: #a0c4d8; margin-bottom: 2.5rem; }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 0.3rem 0.9rem;
      border-radius: 999px;
      font-size: 0.85rem;
      margin: 0.25rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1.2rem;
      margin: 2.5rem 0;
      text-align: left;
    }
    .card {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 1.5rem;
    }
    .card h3 { font-size: 1rem; margin-bottom: 0.5rem; color: #7ecfff; }
    .card p { font-size: 0.88rem; color: #c0d8e8; line-height: 1.5; }
    .endpoints { margin-top: 2rem; text-align: left; }
    .endpoints h2 { font-size: 1.2rem; margin-bottom: 1rem; color: #7ecfff; }
    .ep {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.7rem 1rem;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .method {
      font-weight: bold;
      font-size: 0.8rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      min-width: 50px;
      text-align: center;
    }
    .get { background: #1a6b3f; color: #4ade80; }
    .post { background: #1a3b6b; color: #60a5fa; }
    a { color: #7ecfff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🐬</div>
    <h1>Dolphin Framework</h1>
    <p class="tagline">Modular · Zero-Dependency Core · 45,000+ RPS · 2026-Ready</p>
    <div>
      <span class="badge">TypeScript</span>
      <span class="badge">Node.js Native</span>
      <span class="badge">JWT Auth</span>
      <span class="badge">WebSocket</span>
      <span class="badge">IoT Ready</span>
      <span class="badge">Zod Validation</span>
      <span class="badge">OpenAPI/Swagger</span>
    </div>
    <div class="grid">
      <div class="card">
        <h3>Zero Dependencies Core</h3>
        <p>Built on native Node.js <code>http</code> and <code>events</code>. No Express, no Fastify — pure performance.</p>
      </div>
      <div class="card">
        <h3>Unified Context (ctx)</h3>
        <p>Express-compatible ctx API with auto JSON serialization, params, query, and body parsing built-in.</p>
      </div>
      <div class="card">
        <h3>Auth + 2FA</h3>
        <p>JWT-based authentication with Argon2 password hashing and Time-based One-Time Password (TOTP) 2FA support.</p>
      </div>
      <div class="card">
        <h3>Realtime PubSub</h3>
        <p>Topic trie engine with binary codecs for high-throughput WebSocket pub/sub and IIoT workloads.</p>
      </div>
      <div class="card">
        <h3>CRUD + Controller</h3>
        <p>Modular CRUD utilities and controller wrappers with Mongoose adapter and Zod schema validation.</p>
      </div>
      <div class="card">
        <h3>Auto Swagger Docs</h3>
        <p>Automatic OpenAPI 3.0 documentation generation from your route definitions. No annotation overhead.</p>
      </div>
    </div>
    <div class="endpoints">
      <h2>Live API Endpoints</h2>
      <div class="ep"><span class="method get">GET</span> <span>/ — This page</span></div>
      <div class="ep"><span class="method get">GET</span> <span><a href="/api/info">/api/info</a> — Framework info (JSON)</span></div>
      <div class="ep"><span class="method get">GET</span> <span><a href="/api/health">/api/health</a> — Health check</span></div>
      <div class="ep"><span class="method post">POST</span> <span>/api/echo — Echo request body back</span></div>
    </div>
  </div>
</body>
</html>`);
});

app.get('/api/info', (ctx: any) => {
  ctx.json({
    name: 'Dolphin Framework',
    version: '1.5.5',
    description: 'Modular, lightweight, high-performance backend ecosystem',
    features: [
      'Zero-dependency core (native Node.js http + events)',
      'Unified Context (ctx) API',
      'JWT Authentication + Argon2 hashing + 2FA (TOTP)',
      'WebSocket Realtime PubSub with topic trie',
      'CRUD utilities + Mongoose adapter',
      'Zod schema validation middleware',
      'Auto OpenAPI/Swagger documentation',
      'IIoT support (Modbus, HL7, DICOM)',
    ],
    performance: '45,000+ RPS',
    author: 'Shankar Phuyal',
    repository: 'https://github.com/Phuyalshankar/dolphin-server-modules',
  });
});

app.get('/api/health', (ctx: any) => {
  ctx.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/echo', (ctx: any) => {
  ctx.json({ echo: ctx.body, received_at: new Date().toISOString() });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🐬 Dolphin Framework demo running at http://0.0.0.0:${PORT}`);
  console.log(`   GET  /         → HTML landing page`);
  console.log(`   GET  /api/info → Framework info`);
  console.log(`   GET  /api/health → Health check`);
  console.log(`   POST /api/echo  → Echo body`);
});
