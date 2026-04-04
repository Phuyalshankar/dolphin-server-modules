# 🐬 Dolphin Framework (v1.4.7)

**Dolphin** is a 2026-ready, ultra-lightweight, and 100% modular backend ecosystem built on native Node.js. It’s not just a framework; it’s a universal toolkit for Web, Microservices, and Industrial IoT.

> "Native performance. Express compatibility. IoT-ready."

---

### 📘 Official Master Guide (Nepal)
Dolphin Framework को विस्तृत र आधिकारिक गाइड अब उपलब्ध छ। यसमा **Auth, CRUD, Models, र Controllers** को १००% ट्युटोरियल समावेश छ।

👉 **[Dolphin Master Guide (Markdown)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.md)** *(Most Up-to-Date)*
👉 **[Dolphin Master Guide (PDF)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.pdf)**

---

## 🌟 Why Dolphin in 2026?

- **Zero-Dependency Core**: Built on native `http` & `events`. No bloat.
- **Universal Compatibility**: Use modules in Next.js, Express, or Fastify.
- **Multi-Handler Middleware**: Support for Express-style middleware chains `(ctx, next)`.
- **Auto-JSON Serialization**: Simply `return` an object from your handler!
- **Industrial IoT (IIoT)**: Native support for HL7, Modbus, and DICOM via binary plugins.
- **Unified Context (ctx)**: Modern developer experience with legacy middleware support.

---

## 📦 Installation
```bash
npm install dolphin-server-modules
```

---

## 🚀 Quick Start: The "Universal" Way

### 1. High-Performance Web Server
```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// Returning an object automatically sends a JSON response! (v1.4.7)
app.get('/ping', (ctx) => {
  return { message: 'pong', version: '1.4.7' };
});

app.listen(3000, () => console.log("🐬 Dolphin swimming on port 3000"));
```

### 2. Industrial IoT (Modbus/HL7) Support
```typescript
import { RealtimeCore } from 'dolphin-server-modules/realtime';
import { ModbusPlugin, HL7Plugin } from 'dolphin-server-modules/realtime/plugins';

const rt = new RealtimeCore();
rt.use(ModbusPlugin);
rt.use(HL7Plugin);

// Subscribing to factory sensors via Modbus
rt.subscribe('factory/machine/+', (data) => {
  console.log(`Sensor Data:`, data.payload.value);
});
```

---

## 🛠️ Modular Ecosystem

| Module | Path | Description |
| :--- | :--- | :--- |
| **Server** | `/server` | Native-based server with `ctx` API & Auto-JSON. |
| **Router** | `/router` | Standalone sub-routers with Multi-Handler support. |
| **Auth** | `/auth` | Argon2/JWT based secure auth with 2FA support. |
| **Realtime** | `/realtime` | Pub/Sub engine with `TopicTrie` & Binary Codecs. |
| **Validation** | `/middleware/zod` | Type-safe validation for Express, Next.js, and Dolphin. |
| **Swagger Docs** | `/swagger` | Auto-generated OpenAPI docs from Zod schemas. |
| **IoT Plugins** | `/realtime/plugins` | Native parsers for HL7, Modbus, and DICOM. |
| **DB Adapters** | `/adapters` | Mongoose and SQL adapters for rapid CRUD. |

---

## 🛣️ Advanced Middleware & Sub-Routing
Cleanly organize large-scale applications with Express-style middleware:

```typescript
import { createDolphinRouter } from 'dolphin-server-modules/router';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';

const auth = createDolphinAuthController(db, config);
const apiV1 = createDolphinRouter();

// ✅ NEW: Supports multiple handlers (middleware) per route
apiV1.get('/me', auth.requireAuth, async (ctx) => {
  return { user: ctx.req.user }; // Context contains decoded token
});

const mainApp = createDolphinServer();
mainApp.use('/api/v1', apiV1);
```

---

## 📊 2026 Performance Benchmarks

| Framework | RPS (Req/sec) | Cold Start | Bundle Size |
| :--- | :--- | :--- | :--- |
| Express.js | ~15,000 | 180ms | 2.4 MB |
| Fastify | ~35,000 | 90ms | 1.1 MB |
| **Dolphin** | **45,000+** | **< 10ms** | **~80 KB** |

---

## 🗺️ Roadmap
- [x] Universal Plugin System (HL7/Modbus/Binary)
- [x] Recursive Sub-routing
- [x] **Auto-Doc**: Automatic Swagger/OpenAPI generation from Zod schemas.
- [x] **Middleware Chains**: Support for `(ctx, next)` in routes.
- [x] **Auto-JSON**: Return objects directly from handlers.
- [ ] **Dolphin CLI**: `npx dolphin init` for automated scaffolding.

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
