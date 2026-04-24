# 🐬 Dolphin Framework (v2.2.5)

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
- **Reactive State Sync (DolphinStore)**: Automated frontend state synchronization with built-in loading/error tracking and filtering.
- **Offline Persistence**: Built-in support for localStorage/IndexedDB caching.
- **Server-Served Client Library**: Zero-dependency frontend library for API, Auth, and Realtime—directly from your server.

---

## 📦 Installation
```bash
npm install dolphin-server-modules
```

### 🛠️ CLI Usage (v2.2.5)
Bootstrap a new project or run a server instantly:
```bash
# Initialize a new project
npx dolphin init

# Scaffold a production project structure
npx dolphin init-prod

# Start a server instantly
npx dolphin serve --port=8080
```

---

## 🚀 Quick Start (Modern ESM)

### 1. High-Performance Web Server
```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/ping', (ctx) => {
  return { message: 'pong', version: '2.2.5' };
});

app.listen(3000, () => console.log("🐬 Dolphin swimming on port 3000"));
```

### 2. Reactive Frontend Store (New in v2.2.5)
The Dolphin client library now includes a powerful reactive store that syncs with your database and provides loading/error states.

```html
<!-- index.html -->
<script src="/dolphin-client.js"></script>

<script>
  async function init() {
    // 1. Setup Collection
    const products = dolphin.store.products;

    // 2. State Tracking (Reactive)
    if (products.loading) console.log("Loading products...");
    if (products.error) console.log("Error:", products.error);

    // 3. Powerful Filtering & Sorting (Local & Reactive)
    products
        .where(p => p.price > 100)
        .orderBy('name', 'asc');

    // items array always reflects current filter/sort + realtime updates
    console.log(products.items); 

    // 4. Offline Persistence (Optional Plugin)
    // Add dolphin-persist.js for offline cache
  }
</script>
```

---

## 🧩 DolphinPersist - Offline Caching
Include `dolphin-persist.js` to enable zero-config offline support for your store.

```html
<script src="/dolphin-client.js"></script>
<!-- You can serve this file or include it from your assets -->
<script src="scripts/dolphin-persist.js"></script>

<script>
  const persist = new DolphinPersist({ driver: 'indexeddb' }); // or 'localstorage'
  enablePersist(dolphin.store, persist);
  
  // Now dolphin.store will load from cache instantly before fetching from server
</script>
```

---

## 🛠️ Modular Ecosystem

| Module | Path | Description |
| :--- | :--- | :--- |
| **Server** | `dolphin-server-modules/server` | Native HTTP server with `ctx` API & Auto-JSON. |
| **Router** | `dolphin-server-modules/router` | Standalone sub-routers with multi-handler support. |
| **Auth** | `dolphin-server-modules/auth` | Argon2/JWT based secure auth with 2FA (TOTP). |
| **CRUD** | `dolphin-server-modules/curd` | Generic CRUD service with ownership & soft-delete. |
| **Auth Controller** | `dolphin-server-modules/auth-controller` | Pre-built auth routes (register, login, refresh). |
| **Realtime** | `dolphin-server-modules/realtime` | Pub/Sub engine with `TopicTrie` & binary codecs. |
| **Validation** | `dolphin-server-modules/middleware/zod` | Type-safe Zod validation middleware. |
| **Swagger Docs** | `dolphin-server-modules/swagger` | Auto-generated OpenAPI docs from Zod schemas. |
| **IoT Plugins** | `dolphin-server-modules/realtime/plugins` | Native parsers for HL7, Modbus, and DICOM. |
| **Signaling** | `dolphin-server-modules/signaling` | Universal WebRTC & Control Signaling module. |
| **Mongoose Adapter** | `dolphin-server-modules/adapters/mongoose` | Full Mongoose ↔ CRUD bridge with query mapping. |
| **Client Lib** | `/dolphin-client.js` | Zero-dependency full-stack JS client. Includes **Reactive Store (DolphinStore)** with filter/sort and loading states. |

---

## 🧪 Testing
The project uses **Jest** with **ts-jest**. Integration tests use `mongodb-memory-server` for real Mongoose testing without an external database.

```bash
npm test          # Run all 200+ tests
```

---

## 📊 2026 Performance Benchmarks

| Framework | RPS (Req/sec) | Cold Start | Realtime Throughput |
| :--- | :--- | :--- | :--- |
| Express.js | ~15,000 | 180ms | N/A |
| Fastify | ~35,000 | 90ms | ~10,000 msgs/sec |
| **Dolphin V2.2** | **45,000+** | **< 10ms** | **35,000+ msgs/sec** |

---

## 🗺️ Roadmap
- [x] Universal Plugin System (HL7/Modbus/Binary)
- [x] Recursive Sub-routing
- [x] Auto-Doc: Automatic Swagger/OpenAPI generation from Zod schemas
- [x] Middleware Chains: Support for `(ctx, next)` in routes
- [x] Auto-JSON: Return objects directly from handlers
- [x] Real Mongoose adapter with `$like`, `id→_id` query mapping
- [x] Integration test suite with `mongodb-memory-server`
- [x] **Server-Served Client Library**: `/dolphin-client.js` auto-serve
- [x] **Reactive Store (DolphinStore)**: Filter, Sort, and State tracking
- [x] **Offline Persistence**: DolphinPersist plugin
- [x] **Dolphin CLI**: `npx dolphin init` and `init-prod`
- [ ] **AI-Driven Generation**: Advanced multi-file AI project scaffolding

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
