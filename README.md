# 🐬 Dolphin Server Modules (v2.14.1)

![NPM Version](https://img.shields.io/npm/v/dolphin-server-modules?color=blue&style=flat-square)
![License](https://img.shields.io/npm/l/dolphin-server-modules?style=flat-square)
![Downloads](https://img.shields.io/npm/dm/dolphin-server-modules?style=flat-square&color=green)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)

> **नेपाली डेभलपरहरूका लागि बनाइएको Node.js Backend Framework**  
> A modular, production-ready Node.js backend toolkit with Auth, CRUD, Realtime, CLI, and AI support.

---

## 📘 Official Guides (Nepali)

- **[Full Tutorial - Nepali (TUTORIAL_NEPALI.md)](./TUTORIAL_NEPALI.md)** — सम्पूर्ण Tutorial नेपालीमा
- **[English Tutorial (TUTORIAL.md)](./TUTORIAL.md)** — Complete tutorial in English (v2.14.1)
- **[Realtime Tutorial - Nepali (RT_TUTORIAL_NEPALI.md)](./RT_TUTORIAL_NEPALI.md)** — RealtimeCore v2 WebSocket deep dive
- **[AI Tutorial - Nepali (AI_TUTORIAL_NEPALI.md)](./AI_TUTORIAL_NEPALI.md)** — AI Agent & dolphin chat guide
- **[Client Tutorial - Nepali](./CLIENT_TUTORIAL_NEPALI.md)** — Frontend client tutorial
- **[Dolphin Master Guide (PDF)](./DOLPHIN_MASTER_GUIDE_NEPALI.pdf)** — Offline PDF guide

---

## 📦 Module Overview

| Module | Description |
|--------|-------------|
| **`/server`** | Lightweight HTTP server (Express-compatible) |
| **`/auth`** | Argon2 hashing, JWT, TOTP 2FA, refresh tokens, rate limiting |
| **`/auth-controller`** | Drop-in auth controller for Dolphin Server routes |
| **`/crud`** | Generic CRUD with soft-delete, ownership, pagination |
| **`/adapters/mongoose`** | Full Mongoose adapter (auth + CRUD) |
| **`/router`** | Fast URL router with params and wildcards |
| **`/realtime`** | WebSocket pub/sub with Redis scaling, binary streaming |
| **`/swagger`** | Auto-generate Swagger UI from routes |
| **`/djson`** | Streaming JSON and binary data utilities |
| **`/middleware/zod`** | Zod validation middleware |
| **`/signaling`** | WebRTC signaling server |
| **`/cli`** | `dolphin` CLI — scaffold, connect, deploy |

---

## 🚀 Quick Start

```bash
npm install dolphin-server-modules mongoose
```

### 1. Init a full project

```bash
npx dolphin init
```

This creates:
```
my-project/
├── app.js              ← Entry point
├── adapters/
│   ├── connection.js   ← MongoDB connect
│   └── db.js           ← Mongoose adapter
├── models/
│   └── User.js         ← User + RefreshToken schemas
└── .env
```

### 2. Start your server

```bash
node app.js
# 🐬 Dolphin Server swimming on port 3000
```

---

## 🔐 Auth API

### Setup

```js
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { db } from './adapters/db.js';

const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
});

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login',    auth.login);
app.post('/api/auth/refresh',  auth.refresh);
app.post('/api/auth/logout',   auth.requireAuth, auth.logout);
app.get('/api/auth/me',        auth.requireAuth, auth.me);
```

### Register
```
POST /api/auth/register
{ "email": "user@example.com", "password": "SecurePass123" }
```

Password requirements: min 8 chars, uppercase, lowercase, number.

### Login
```
POST /api/auth/login
{ "email": "user@example.com", "password": "SecurePass123" }

Response: { "success": true, "accessToken": "...", "user": { ... } }
```
Refresh token is set as `HttpOnly` cookie automatically.

### Refresh Token
```
POST /api/auth/refresh
(Reads `rt` cookie automatically — no body needed)
```

### 2FA (TOTP)
```js
app.post('/api/auth/2fa/enable',   auth.requireAuth, auth.enable2FA);
app.post('/api/auth/2fa/verify',   auth.requireAuth, auth.verify2FA);
app.post('/api/auth/2fa/disable',  auth.requireAuth, auth.disable2FA);
```

---

## 📂 CRUD API

```js
import { createCrudRouter } from 'dolphin-server-modules/crud';
import { Product } from './models/Product.js';

app.use('/api/products', createCrudRouter(db, 'Product', { softDelete: true }));
```

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/products` | List all |
| GET | `/api/products/:id` | Get one |
| POST | `/api/products` | Create |
| PUT | `/api/products/:id` | Update |
| DELETE | `/api/products/:id` | Delete (soft) |

---

## ⚡ Realtime (WebSocket)

```js
import { createRealtimeCore } from 'dolphin-server-modules/realtime';

const rt = createRealtimeCore();
const app = createDolphinServer({ realtime: rt });

// Server-side: publish
rt.publish('chat/room1', { message: 'Hello!' });

// Server-side: subscribe
rt.subscribe('chat/#', (data, topic) => {
  console.log(`[${topic}]`, data);
});
```

**Client-side:**
```js
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=device1');
ws.send(JSON.stringify({ type: 'sub', topic: 'chat/room1' }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## 🗄️ Mongoose Adapter

```js
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from './models/User.js';
import { Product } from './models/Product.js';

export const db = createMongooseAdapter({
  User,           // Required for auth
  RefreshToken,   // Required for auth
  models: {
    Product,      // Add your CRUD models here
    // NOTE: Do NOT add User here again — it is already registered above
  },
  leanByDefault: true,
  softDelete: false,
});
```

> ⚠️ **Important**: Never add `User` inside `models: {}` — it is already registered at the top level. Adding it twice causes the CRUD system to bypass the auth layer's email normalization and duplicate checks, which can create duplicate users.

---

## 🖥️ CLI Commands

```bash
npx dolphin help
```

| Command | Description |
|---------|-------------|
| `dolphin init` | Scaffold full project |
| `dolphin add auth` | Add auth controller + User model |
| `dolphin add crud <Name>` | Add CRUD for a model |
| `dolphin add adapter mongoose` | Add Mongoose adapter |
| `dolphin add model <Name>` | Add a Mongoose model |
| `dolphin add route <Name>` | Add a route file |
| `dolphin add middleware <Name>` | Add middleware |
| `dolphin add service <Name>` | Add a service class |
| `dolphin connect mongoose [uri]` | Test MongoDB connection |
| `dolphin connect redis [uri]` | Test Redis connection |
| `dolphin status` | Show project health |
| `dolphin deploy` | PM2 deployment guide |
| `dolphin generate-client --url --out --key` | Generate typed JS SDK + `.d.ts` from server |
| `dolphin generate "prompt"` | AI code generation |
| `dolphin chat` | AI agent (Cursor mode) |

---

## ⚡ Reactive Routes (HTTP-to-RT Auto-broadcasting)

Dolphin automatically broadcasts realtime events to all connected clients whenever a `POST`, `PUT`, `PATCH`, or `DELETE` request succeeds — **zero extra code needed**.

```js
// ब्याकइन्डमा केवल साधारण HTTP रुट लेख्नुहोस् — बाँकी Dolphin ले मिलाउँछ!
const rt = new RealtimeCore();
const app = createDolphinServer({ realtime: rt });

app.use('/api/todos', createCrudRouter(db, 'Todo'));
// 👆 POST/PUT/DELETE मा स्वतः 'todos' टपिकमा रियलटाइम ब्रोडकास्ट हुन्छ!
```

**क्लाइन्टमा (Frontend):**
```js
client.connectRealtime((msg) => {
  console.log(msg.action, msg.data); // 'create', { title: '...' }
}, ['todos']); // केवल 'todos' टपिक सुन्ने
```

**नियन्त्रण (Control):**
```js
// ग्लोबल्ली बन्द गर्न:
createDolphinServer({ realtime: rt, autoReactive: false });

// व्यक्तिगत रुटमा बन्द गर्न:
app.post('/api/change-password', (ctx) => {
  ctx.state.noReactive = true; // यो रुटमा ब्रोडकास्ट हुँदैन
  return { success: true };
});
```

---

## 🧩 Auto-Generated Client SDK (.js + .d.ts)

Dolphin automatically generates a typed JavaScript SDK and TypeScript declarations from your backend routes.

```bash
npx dolphin generate-client \
  --url=http://localhost:4000 \
  --out=./src/dolphin-client.js \
  --key=your_secret_generation_key
```

This creates **two files**:
- `dolphin-client.js` — SDK with full API client
- `dolphin-client.d.ts` — TypeScript autocomplete typings

**React मा प्रयोग:**
```ts
import { client } from './dolphin-client.js';

// Full TypeScript autocomplete!
const todos = await client.api.todos.get();
await client.api.todos.post({ title: 'New Task' });
```

**Secure your generator endpoint:**
```env
DOLPHIN_GENERATE_KEY=your_secret_generation_key
JWT_SECRET=your_jwt_secret
```

---

## 🌍 Environment Variables

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/dolphin_db
JWT_SECRET=your_ultra_secret_key_minimum_32_chars
DOLPHIN_GENERATE_KEY=your_sdk_generation_secret_key
# Optional:
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=your_encryption_key_for_2fa
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

---

## 🧪 Running Tests

```bash
npm test
```

Tests cover: Auth (register, login, 2FA, refresh, rate limiting), CRUD, Mongoose adapter, middleware, realtime, router, and more.

---

## 📄 License

ISC © 2026 Shankar Phuyal & Dolphin Team.
