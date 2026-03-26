# Dolphin Framework 🐬

**Dolphin** is a world-class, ultra-lightweight, and 100% modular backend framework built on native Node.js. It is designed for extreme performance, minimal boilerplate, and a developer-first experience.

> "Close to native Node.js speed, with the developer experience of a premium framework."

---

### 📘 Official Master Guide (Nepal)
Dolphin Framework को विस्तृत र आधिकारिक गाइड अब उपलब्ध छ। यसमा **Auth, CRUD, Models, र Controllers** को १००% ट्युटोरियल समावेश छ।

👉 **[Dolphin Master Guide (PDF)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.pdf)**

---

## 🚀 Core Philosophy
- **Zero-Dependency Core**: Built on the native Node.js `http` module. No Express, no Fastify overhead.
- **Extreme Modularity**: Use only what you need. Auth, CRUD, and Routing are all independent.
- **Performance First**: Optimized matching engines and minimal object allocation.
- **Type-Safe by Design**: First-class TypeScript support across all modules.

---

## 📦 Installation
```bash
npm install dolphin-server-modules
```

---

## 🚀 Quick Start (Complete Tutorial)

Building a high-performance API with Dolphin is simple. Here is a full example:

### 1. Define your Database (Mongoose)
```typescript
import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true }
}));

const db = createMongooseAdapter({ User });
```

### 2. Initialize and Secure your Server
```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createAuth } from 'dolphin-server-modules/auth';

const app = createDolphinServer();
const auth = createAuth({ secret: 'SUPER_SECRET' });

// Global Middleware (Dolphin Style)
app.use((ctx, next) => {
  console.log(`🐬 ${ctx.req.method} ${ctx.req.url}`);
  next();
});

// Global Middleware (Express Style - Unified Compatibility!)
import cors from 'cors';
app.use(cors()); // Just works!

// Hello World
app.get('/', (ctx) => ctx.json({ message: "Welcome to Dolphin!" }));

// Secure Route
app.get('/profile', auth.middleware(), (ctx) => {
  ctx.json({ user: ctx.req.user });
});

// Dynamic Params
app.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));

app.listen(3000, () => console.log("Dolphin swimming on port 3000!"));
```

---

## 🛠️ Key Features

### ⚡ 1. Native High-Performance Server (`/server`)
A thin wrapper around native `http` with a modern `Context` (ctx) based API.
```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/ping', (ctx) => ctx.json({ message: 'pong' }));

app.listen(3000);
```

### 🛣️ 2. Intelligent Routing (`/router`)
Uses a hybrid Radix Tree + Static Map approach for $O(1)$ and $O(L)$ matching. Supports dynamic path parameters out of the box.
```typescript
app.get('/users/:id', (ctx) => {
  return ctx.json({ userId: ctx.params.id });
});
```

### 🔒 3. Advanced Auth Module (`/auth`)
Production-ready security with zero external bloat:
- Argon2 Hashing & JWT (Timing-safe)
- Refresh Token Rotation & Reuse Detection
- 2FA (TOTP) + Recovery Code Management

### 💾 4. Adapter-Based CRUD & Database (`/crud`)
Seamlessly switch between databases with the Adapter pattern.
- **Mongoose Adapter**: Included by default.
- **Automated CRUD**: Just define a schema and get a full API.

### ✅ 5. Zod-Powered Validation (`/middleware/zod`)
Validate payloads and params with 100% type inference.

### 🌐 6. Realtime & IoT Core (`/realtime`)
High-performance pub/sub with MQTT-style matching.

### 🛣️ 7. Independent Routing (`/router`) [NEW]
Express-style standalone routers for clean organization.
- `app.use('/prefix', subRouter)`: Mount sub-modules with ease.
- **Nested Routing**: Unlimited nesting with prefix inheritance.
- **Unified Matcher**: Optimized matching for both static and dynamic routes.

---

## 🗺️ Roadmap & Future Vision
1. **`defineModel` Engine**: Define a schema once, auto-generate CRUD, validation, and types.
2. **Plugin System**: A robust "hook" based system. [DONE]
3. **Independent Routing**: Standalone sub-routers for large apps. [DONE]
4. **CLI Presets**: `npx dolphin init` for instant project scaffolding.

---

## 📊 Performance Comparison
| Metric | Express | Fastify | **Dolphin** |
| :--- | :--- | :--- | :--- |
| **Overhead** | High | Low | **Ultra-Low (Native)** |
| **Modularity** | Low | Medium | **Extreme** |
| **DX** | Good | Excellent | **Premium** |

---

## 🌐 Documentation
Detailed documentation is automatically hosted via GitHub Pages from this README.

## 📄 License
ISC © 2026 Dolphin Team
