# 🐬 Dolphin Framework (v2.2.2)

![NPM Version](https://img.shields.io/npm/v/dolphin-server-modules?color=blue&style=flat-square)
![Build Status](https://img.shields.io/github/actions/workflow/status/Phuyalshankar/dolphin-server-modules/main.yml?style=flat-square)
![License](https://img.shields.io/npm/l/dolphin-server-modules?style=flat-square)
![Downloads](https://img.shields.io/npm/dm/dolphin-server-modules?style=flat-square&color=green)

**Dolphin** is a 2026-ready, ultra-lightweight, and 100% modular backend ecosystem built on native Node.js. It's not just a framework; it's a universal toolkit for Web, Microservices, and Industrial IoT.

> "Native performance. Express compatibility. IoT-ready."

---

### 📘 Official Master Guide (Nepal)
Dolphin Framework को विस्तृत र आधिकारिक गाइड उपलब्ध छ। यसमा **Auth, CRUD, Models, र Controllers** को १००% ट्युटोरियल समावेश छ।

👉 **[Dolphin Master Guide (Markdown)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.md)** *(Most Up-to-Date)*
👉 **[Dolphin Master Guide (PDF)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.pdf)**

---

## 🌟 Why Dolphin in 2026?

- **Zero-Dependency Core**: Built on native `http` & `events`. No bloat.
- **Universal Compatibility**: Works with Mongoose, Zod, WebSocket, and Express-compatible middleware.
- **Multi-Handler Middleware**: Support for Express-style middleware chains `(ctx, next)`.
- **Auto-JSON Serialization**: Simply `return` an object from your handler!
- **Industrial IoT (IIoT)**: Native support for HL7, Modbus, and DICOM via binary plugins.
- **Unified Context (ctx)**: Modern developer experience with legacy middleware support.
- **Server-Served Client Library**: Zero-dependency frontend library for API, Auth, and Realtime—directly from your server.

---

## 📦 Installation
```bash
npm install dolphin-server-modules
```

### 🛠️ CLI Usage (New in v2.2.1)
Run a Dolphin server instantly from any project:
```bash
npx dolphin-server --port=8080
```

---

## 🚀 Quick Start

### 1. High-Performance Web Server
```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/ping', (ctx) => {
  return { message: 'pong', version: '1.5.6' };
});

app.listen(3000, () => console.log("🐬 Dolphin swimming on port 3000"));
```

### 2. Full-stack Client Library (No NPM needed!)
Dolphin now serves its own client-side library. Just include a script tag and you get Auth, API, and Realtime out of the box.

```html
<!-- In your index.html -->
<script src="/dolphin-client.js"></script>

<script>
  async function init() {
    // 1. Auth & Token Management
    await dolphin.auth.login("admin@test.com", "password123");

    // 2. API with Dynamic Proxy (New in v2.2)
    const products = await dolphin.api.products(); 
    const profile  = await dolphin.api.users.profile(); 
    await dolphin.api.products.post({ name: "Dolphin" });
    await dolphin.api.call.get(); // Smart proxy handles reserved keywords like 'call' or 'apply'

    // 3. Advanced Realtime (v2.2)
    await dolphin.connect();
    
    // Subscribe with cleanup support
    const onTemp = (val) => console.log(val);
    dolphin.subscribe('sensors/temp', onTemp);
    // ... later
    dolphin.unsubscribe('sensors/temp', onTemp);

    // High-frequency data (30,000+ msgs/sec)
    dolphin.pubPush('sensors/temp', { val: 24.5 });

    // Demand-based pulling (Data saving)
    dolphin.subscribe('pull:response/logs', (history) => console.log(history));
    dolphin.subPull('logs', 50);

    // Chunked File Transfer with Resume support
    dolphin.subscribe('file:chunk/map-data', (chunk) => {
        console.log(`Downloaded ${chunk.chunkIndex}/${chunk.totalChunks}`);
    });
    dolphin.subFile('map-data');
  }
</script>
```

### 3. Full CRUD API with Mongoose (v1.7.0)

> **Important:** Use `enforceOwnership: false` for public APIs (no auth required).
> Default is `true` — requires `userId` from auth middleware.

```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/crud';
import mongoose from 'mongoose';

// 1. Connect MongoDB
await mongoose.connect(process.env.MONGO_URI!);

// 2. Define Model
const Product = mongoose.model('Product', new mongoose.Schema({
  name: String, price: Number, category: String
}));

// 3. Create adapter + CRUD service
const db = createMongooseAdapter({ User, RefreshToken, models: { Product } });
const crud = createCRUD(db, { enforceOwnership: false }); // public API

// 4. Wire routes
const app = createDolphinServer();

app.get('/products',      async (ctx) => ctx.json(await crud.read('Product')));
app.get('/products/:id',  async (ctx) => {
  const item = await crud.readOne('Product', ctx.params.id);
  if (!item) return ctx.status(404).json({ error: 'Not Found' });
  ctx.json(item);
});
app.post('/products',     async (ctx) => ctx.status(201).json(await crud.create('Product', ctx.body)));
app.put('/products/:id',  async (ctx) => ctx.json(await crud.updateOne('Product', ctx.params.id, ctx.body)));
app.delete('/products/:id', async (ctx) => ctx.json(await crud.deleteOne('Product', ctx.params.id)));

app.listen(3000);
```

### 3. Industrial IoT (Modbus/HL7) Support
```typescript
import { RealtimeCore } from 'dolphin-server-modules/realtime';
import { ModbusPlugin, HL7Plugin } from 'dolphin-server-modules/realtime/plugins';

const rt = new RealtimeCore();
rt.use(ModbusPlugin);
rt.use(HL7Plugin);

rt.subscribe('factory/machine/+', (data) => {
  console.log(`Sensor Data:`, data.payload.value);
});
```

---

## 🛠️ Modular Ecosystem

| Module | Path | Description |
| :--- | :--- | :--- |
| **Server** | `dolphin-server-modules/server` | Native HTTP server with `ctx` API & Auto-JSON. |
| **Router** | `dolphin-server-modules/router` | Standalone sub-routers with multi-handler support. |
| **Auth** | `dolphin-server-modules/auth` | Argon2/JWT based secure auth with 2FA (TOTP). |
| **CRUD** | `dolphin-server-modules/crud` | Generic CRUD service with ownership & soft-delete. |
| **Auth Controller** | `dolphin-server-modules/auth-controller` | Pre-built auth routes (register, login, refresh). |
| **Realtime** | `dolphin-server-modules/realtime` | Pub/Sub engine with `TopicTrie` & binary codecs. |
| **Validation** | `dolphin-server-modules/middleware/zod` | Type-safe Zod validation middleware. |
| **Swagger Docs** | `dolphin-server-modules/swagger` | Auto-generated OpenAPI docs from Zod schemas. |
| **IoT Plugins** | `dolphin-server-modules/realtime/plugins` | Native parsers for HL7, Modbus, and DICOM. |
| **Signaling** | `dolphin-server-modules/signaling` | Universal WebRTC & Control Signaling module. |
| **Mongoose Adapter** | `dolphin-server-modules/adapters/mongoose` | Full Mongoose ↔ CRUD bridge with query mapping. |
| **Client Lib** | `/dolphin-client.js` | Zero-dependency full-stack JS client. |

### 🧩 How to use individual modules:
```javascript
// Example: Using only the Auth module in Express/Fastify
const { createDolphinAuth } = require('dolphin-server-modules/auth');
```

---

## ⚠️ Important: `enforceOwnership` Option

The `createCRUD` function has `enforceOwnership: true` by default. This means **every operation requires a `userId`** (from auth middleware). For public APIs, set it to `false`:

```typescript
// Public API — no auth needed
const crud = createCRUD(db, { enforceOwnership: false });

// Protected API — requires auth middleware to set ctx.req.user
const crud = createCRUD(db, { enforceOwnership: true });
```

---

## 🛣️ Advanced Middleware & Sub-Routing

```typescript
import { createDolphinRouter } from 'dolphin-server-modules/router';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';

const auth = createDolphinAuthController(db, config);
const apiV1 = createDolphinRouter();

// Multi-handler: middleware + route handler
apiV1.get('/me', auth.requireAuth, async (ctx) => {
  return { user: ctx.req.user };
});

const mainApp = createDolphinServer();
mainApp.use('/api/v1', apiV1);
```

---

## 🧪 Testing

The project uses **Jest** with **ts-jest**. Integration tests use `mongodb-memory-server` for real Mongoose testing without an external database.

```bash
npm test          # Run all 167 tests (12 suites)
```

| Suite | Tests |
| :--- | :--- |
| `adapters/mongoose/integration.test.ts` | 23 (real Mongoose) |
| `adapters/mongoose/index.test.ts` | 7 |
| `auth/auth.test.ts` | — |
| `curd/crud.test.ts` | — |
| + 8 more suites | — |

---

## 📊 2026 Performance Benchmarks

| Framework | RPS (Req/sec) | Cold Start | Realtime Throughput |
| :--- | :--- | :--- | :--- |
| Express.js | ~15,000 | 180ms | N/A |
| Fastify | ~35,000 | 90ms | ~10,000 msgs/sec |
| **Dolphin V2** | **45,000+** | **< 10ms** | **35,000+ msgs/sec** |

---

## 🗺️ Roadmap
- [x] Universal Plugin System (HL7/Modbus/Binary)
- [x] Recursive Sub-routing
- [x] Auto-Doc: Automatic Swagger/OpenAPI generation from Zod schemas
- [x] Middleware Chains: Support for `(ctx, next)` in routes
- [x] Auto-JSON: Return objects directly from handlers
- [x] Real Mongoose adapter with `$like`, `id→_id` query mapping
- [x] Integration test suite with `mongodb-memory-server`
- [ ] **Dolphin CLI**: `npx dolphin init` for automated scaffolding

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
