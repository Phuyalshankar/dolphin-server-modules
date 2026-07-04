# Dolphin Framework Tutorial 🐬 (v2.14.1)

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using native, high-performance modules and **Agentic AI**.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Basic Server (ESM)](#2-basic-server-esm-only)
3. [CLI Commands](#3-cli-commands)
4. [Auth System](#4-auth-system)
5. [CRUD Operations](#5-crud-operations)
6. [Mongoose Adapter](#6-mongoose-adapter)
7. [Realtime WebSocket](#7-realtime-websocket)
8. [DolphinClient (Frontend)](#8-dolphinclient-frontend)
9. [Middleware & Validation](#9-middleware--validation)
10. [2FA & Password Reset](#10-2fa--password-reset)
11. [AI Features](#11-ai-features)
12. [Production Deployment](#12-production-deployment)
13. [Common Bugs & Fixes](#13-common-bugs--fixes)

---

## 1. Project Setup

```bash
# Node.js 18+ required
node --version   # v18.0.0 or above

# Create a new project
mkdir my-dolphin-app && cd my-dolphin-app
npm init -y

# Install Dolphin
npm install dolphin-server-modules mongoose
```

**Add `"type": "module"` to `package.json`** (required for ESM):

```json
{
  "name": "my-dolphin-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node app.js",
    "dev": "node --watch app.js"
  }
}
```

**Create `.env`:**

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/my_db
JWT_SECRET=change_this_to_minimum_32_characters_secret
```

### Quickstart with CLI (Recommended)

```bash
# Scaffold full project automatically
npx dolphin init
node app.js
# 🐬 Server swimming on http://localhost:3000
```

---

## 2. Basic Server (ESM Only)

Dolphin strictly uses **ES Modules**. Do not use `require()`.

```javascript
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// Simple GET — return an object for auto-JSON response
app.get('/', (ctx) => {
  return {
    message: 'Welcome to Dolphin! 🐬',
    version: '2.14.1',
  };
});

// POST — ctx.body is auto-parsed JSON
app.post('/echo', (ctx) => {
  return { success: true, received: ctx.body };
});

// Route params — /users/123
app.get('/users/:id', (ctx) => {
  return { userId: ctx.params.id };
});

// Query string — /search?q=hello&page=2
app.get('/search', (ctx) => {
  return { query: ctx.query.q, page: ctx.query.page || '1' };
});

// Manual status code
app.get('/not-found-example', (ctx) => {
  return ctx.status(404).json({ error: 'Item not found' });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`🐬 Server running at http://localhost:${PORT}`);
});
```

```bash
# Test
curl http://localhost:3000/
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"name":"Ram","city":"Kathmandu"}'
```

---

## 3. CLI Commands

```bash
# ─── Scaffolding ───────────────────────────────────────────
npx dolphin init                        # Full project scaffold
npx dolphin add auth                    # Auth controller + User model
npx dolphin add crud <ModelName>        # Model + route + db register
npx dolphin add model <ModelName>       # Model file only
npx dolphin add adapter mongoose        # MongoDB adapter
npx dolphin add adapter sequelize       # MySQL/PostgreSQL adapter
npx dolphin add route <Name>            # routes/name.js
npx dolphin add middleware <Name>       # middleware/name.js
npx dolphin add service <Name>          # services/Name.service.js

# ─── Database ──────────────────────────────────────────────
npx dolphin connect mongoose [uri]      # MongoDB connection test
npx dolphin connect redis [uri]         # Redis connection test

# ─── AI (API key required) ─────────────────────────────────
npx dolphin generate "prompt"           # → ai-generated.js
npx dolphin generate-full "prompt"      # → multiple files (AI decides)
npx dolphin chat                        # Interactive AI agent (Cursor Mode)

# ─── Project ───────────────────────────────────────────────
npx dolphin status                      # Project health check
npx dolphin deploy                      # PM2 deployment guide
npx dolphin serve [--port=N]            # TCP port test server

# ─── SDK Generation ─────────────────────────────────────────
npx dolphin generate-client --url=http://localhost:4000 --out=./src/dolphin-client.js --key=YOUR_KEY
# Generates: dolphin-client.js   (browser-ready SDK)
#            dolphin-client.d.ts (TypeScript type definitions)

# ─── Info ──────────────────────────────────────────────────
npx dolphin --version                   # 🐬 Dolphin CLI v2.14.1
npx dolphin help                        # All commands list
```

---

## 4. Auth System

### Setup

```js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

const app = createDolphinServer();
connectDB(process.env.MONGO_URI);

const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production', // HTTPS only
});

// Auth Routes
app.post('/api/auth/register',        auth.register);
app.post('/api/auth/login',           auth.login);
app.post('/api/auth/refresh',         auth.refresh);
app.post('/api/auth/logout',          auth.requireAuth, auth.logout);
app.get('/api/auth/me',               auth.requireAuth, auth.me);
app.post('/api/auth/change-password', auth.requireAuth, auth.changePassword);
app.post('/api/auth/forgot-password', auth.forgotPassword);
app.post('/api/auth/reset-password',  auth.resetPassword);

// 2FA Routes
app.post('/api/auth/2fa/enable',  auth.requireAuth, auth.enable2FA);
app.post('/api/auth/2fa/verify',  auth.requireAuth, auth.verify2FA);
app.post('/api/auth/2fa/disable', auth.requireAuth, auth.disable2FA);

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`🐬 Server running on port ${PORT}`));
```

### Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}'
```

Password rules: min 8 chars, uppercase, lowercase, number.

```json
{ "success": true, "data": { "id": "...", "email": "user@example.com", "role": "user" } }
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}'
```

```json
{ "success": true, "accessToken": "eyJ...", "user": { "id": "...", "email": "...", "role": "user" } }
```

> Refresh token is set as an `HttpOnly` cookie automatically.

### Protected Routes

```js
// Login required
app.get('/api/dashboard', auth.requireAuth, (ctx) => {
  return { message: `Welcome, ${ctx.req.user.email}!`, role: ctx.req.user.role };
});

// Admin only
app.get('/api/admin', auth.requireAdmin, (ctx) => {
  return { message: 'Admin panel' };
});

// 2FA verified only
app.get('/api/sensitive', auth.require2FA, (ctx) => {
  return { message: 'Sensitive data — 2FA verified' };
});
```

**Call with token:**

```bash
curl http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Refresh

```bash
# Browser sends rt cookie automatically
curl -X POST http://localhost:3000/api/auth/refresh \
  --cookie "rt=your_refresh_token"
```

---

## 5. CRUD Operations

```bash
npx dolphin add crud Product
# Creates: models/Product.js, adds route to app.js, registers in db.js
```

**Manual route setup:**

```js
import { createCrudRouter } from 'dolphin-server-modules/crud';

app.use('/api/products', createCrudRouter(db, 'Product', {
  softDelete: true,       // DELETE sets deletedAt instead of removing
  enforceOwnership: true, // Users can only access their own records
}));
```

> **Reactive Routes (default behavior):** When `autoReactive: true` (the default), `POST`, `PUT`, and `DELETE` routes automatically broadcast a realtime event to all connected clients. The broadcast topic is derived from the route URL — for example, `/api/todos` becomes the `todos` topic. To opt out on a per-request basis, set `ctx.state.noReactive = true` inside your handler.

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/products` | List all (with pagination) |
| GET | `/api/products?limit=10&offset=0` | Paginated |
| GET | `/api/products/:id` | Get one |
| POST | `/api/products` | Create |
| PUT | `/api/products/:id` | Update |
| DELETE | `/api/products/:id` | Delete (soft) |

```bash
# Create
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Laptop","price":150000}'

# List
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer TOKEN"
```

---

## 6. Mongoose Adapter

```js
// adapters/db.js
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';
import { Product } from '../models/Product.js';

export const db = createMongooseAdapter({
  User,          // Required for auth — always at top level
  RefreshToken,  // Required for auth — always at top level
  models: {
    Product,     // Add your CRUD models here ONLY
    // ⚠️ NEVER add User or RefreshToken here again!
  },
  leanByDefault: true,  // Faster reads
  softDelete: false,
});
```

> ⚠️ **Critical**: Never add `User` inside `models: {}` — it causes the Double User Bug, allowing duplicate emails to bypass the auth check.

---

## 7. Realtime WebSocket

```js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createRealtimeCore } from 'dolphin-server-modules/realtime';

const rt = createRealtimeCore();
const app = createDolphinServer({ realtime: rt });

// Publish (server-side)
rt.publish('chat/room1', { message: 'Hello!', from: 'server' });

// Subscribe (server-side)
rt.subscribe('chat/#', (data, topic) => {
  console.log(`[${topic}]`, data);
});

// High-frequency IoT data
rt.pubPush('sensors/temp', { value: 25.4, ts: Date.now() });

// Historical data (last N messages)
rt.subPull('sensors/temp', 30);
```

**Browser client (no library):**

```js
// Include a JWT token for authenticated realtime connections:
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=browser-001&token=JWT_TOKEN');
// The server verifies the token and associates the connection with the authenticated user.

ws.onopen = () => {
  // Subscribe to a topic
  ws.send(JSON.stringify({ type: 'sub', topic: 'chat/room1' }));

  // Publish
  ws.send(JSON.stringify({
    type: 'pub',
    topic: 'chat/room1',
    payload: { message: 'Hello from browser!', from: 'Ram' }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'message') {
    console.log(`[${msg.topic}]`, msg.payload);
  }
};
```

> **SSE Fallback:** If WebSocket is unavailable (e.g., blocked by a corporate firewall), the client automatically falls back to Server-Sent Events:
> ```
> GET /realtime/sse?deviceId=browser-001&token=JWT_TOKEN
> ```
> The `DolphinClient` SDK handles this fallback transparently — no code changes required.

For a full Realtime guide, see **[RT_TUTORIAL_NEPALI.md](./RT_TUTORIAL_NEPALI.md)**.

---

## 8. DolphinClient (Frontend)

```bash
npm install dolphin-client
```

```js
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient('http://localhost:3000', 'my-device-001', {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 2000,
});

// Auth
await dolphin.auth.login('user@example.com', 'SecurePass123');
const user = await dolphin.auth.me();

// HTTP API
const products = await dolphin.api.products.get();
const created = await dolphin.api.products.post({ title: 'Laptop', price: 150000 });

// Realtime pub/sub
dolphin.subscribe('chat/room1', (payload) => {
  console.log('New message:', payload);
});
dolphin.publish('chat/room1', { message: 'Hello!', from: user.email });
```

### connectRealtime with Topic Subscriptions

To subscribe to specific topics as soon as the realtime connection opens, pass a topic array as the second argument:

```js
dolphin.connectRealtime(
  (event) => {
    console.log('Realtime event:', event.topic, event.payload);
  },
  ['todos', 'chat/room1', 'notifications'] // topic filter list
);
```

Only events matching the listed topics are delivered to the callback. Omit the array to receive all events.

> **SSE Fallback:** If the WebSocket connection cannot be established, `DolphinClient` automatically retries via Server-Sent Events (`/realtime/sse?deviceId=...&token=...`). Your `connectRealtime` callback works identically over both transports.

### Using the Auto-Generated SDK

If you generated a client SDK with `npx dolphin generate-client` (see [Section 3](#3-cli-commands)), you can include it directly in any HTML page — no npm required:

```html
<!-- Include the auto-generated SDK -->
<script src="./dolphin-client.js"></script>
<script>
  const dolphin = new DolphinClient('http://localhost:4000', 'browser-001');
  dolphin.connectRealtime(
    (event) => console.log('Live update:', event),
    ['todos']
  );
</script>
```

The accompanying `dolphin-client.d.ts` provides full TypeScript IntelliSense when imported in a TypeScript project.

**Hookless DOM (no JavaScript needed):**

```html
<!-- Login form — no JS needed! -->
<form data-api-submit="POST /api/auth/login"
      data-api-redirect="/dashboard">
  <input type="email" name="email" placeholder="Email" />
  <input type="password" name="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>

<!-- Realtime list binding -->
<ul data-api-get="/api/products"
    data-rt-bind="/api/products"
    data-rt-template="<li>{{title}} — Rs.{{price}}</li>">
</ul>
```

For a full client guide, see **[CLIENT_TUTORIAL_NEPALI.md](./CLIENT_TUTORIAL_NEPALI.md)**.

---

## 9. Middleware & Validation

### Error Handler (always use this)

```js
app.use(async (ctx, next) => {
  try {
    if (next) await next();
  } catch (error) {
    console.error('🔥 Error:', error.message);
    ctx.status(error.status || 500).json({
      success: false,
      message: error.message || 'Internal Server Error',
    });
  }
});
```

### CORS

```js
app.use(async (ctx, next) => {
  ctx.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  ctx.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  ctx.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  ctx.setHeader('Access-Control-Allow-Credentials', 'true');
  if (ctx.req.method === 'OPTIONS') return ctx.status(204).json({});
  if (next) await next();
});
```

### Zod Validation

```bash
npm install zod  # already included in dolphin-server-modules
```

```js
import { zodMiddleware } from 'dolphin-server-modules/middleware/zod';
import { z } from 'zod';

const createProductSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  price: z.number().min(0, 'Price cannot be negative'),
  description: z.string().optional(),
});

app.post('/api/products',
  auth.requireAuth,
  zodMiddleware(createProductSchema), // auto 400 on bad data
  (ctx) => {
    return { success: true, data: ctx.body };
  }
);
```

---

## 10. 2FA & Password Reset

### Enable 2FA

```bash
POST /api/auth/2fa/enable
Authorization: Bearer TOKEN
→ { "secret": "...", "uri": "otpauth://..." }
```

```js
// Show QR code to user
import QRCode from 'qrcode';
const qrUrl = await QRCode.toDataURL(response.uri);
// <img src={qrUrl} />  ← scan with Google Authenticator
```

### Verify & Activate

```bash
POST /api/auth/2fa/verify
Authorization: Bearer TOKEN
{ "totp": "123456" }
→ { "success": true, "recoveryCodes": ["AB12-CD34", ...] }
```

### Login with 2FA

```bash
POST /api/auth/login
{ "email": "user@example.com", "password": "SecurePass123", "totp": "654321" }

# Or with recovery code:
{ "email": "user@example.com", "password": "SecurePass123", "recovery": "AB12-CD34" }
```

### Password Reset

```bash
# Request reset
POST /api/auth/forgot-password
{ "email": "user@example.com" }
→ { "success": true, "message": "If email exists, reset link sent" }

# Reset with token
POST /api/auth/reset-password
{ "token": "abc123...", "newPassword": "NewPass456" }
```

---

## 11. AI Features

Dolphin v2.14.1 includes a **Cursor-level AI Agent** that reads your entire project and writes code for you.

### Setup

```env
# Pick one (or more — Dolphin auto-falls-back):
GEMINI_API_KEY=your_gemini_key        # Google Gemini (free tier available)
GROQ_API_KEY=your_groq_key            # Groq — Llama 3 (ultra fast, free)
OPENAI_API_KEY=your_openai_key        # OpenAI GPT-4o
DOLPHIN_AI_KEY=any_key_here           # Universal alias

# Local AI (no API key needed)
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest
```

### Commands

```bash
# Generate a file from a description
npx dolphin generate "create a POST /api/payments route with Zod validation"

# Generate multiple files at once
npx dolphin generate-full "e-commerce backend with orders, products, and mongoose"

# Interactive AI chat (like Cursor in terminal)
npx dolphin chat
# > You: Add pagination to my products route
# > AI: reads your code, edits the file, explains what changed
```

### AI Chat Features

The `dolphin chat` agent can:
- **Read** any file in your project
- **Write / Edit** files (asks permission first)
- **Run shell commands** (asks permission, blocks dangerous ones)
- **Search** for symbols, functions, and classes across your codebase
- **Remember** conversation history in `.dolphin/history.json`

For a full AI guide, see **[AI_TUTORIAL_NEPALI.md](./AI_TUTORIAL_NEPALI.md)**.

---

## 12. Production Deployment

### PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start app.js --name "dolphin-app" --env production
pm2 startup && pm2 save
pm2 logs dolphin-app
```

**Cluster mode (`ecosystem.config.js`):**

```js
export default {
  apps: [{
    name: 'dolphin-app',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
```

```bash
pm2 start ecosystem.config.js --env production
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Production `.env` Checklist

```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=<minimum 32 random characters — use openssl rand -hex 32>
ENCRYPTION_KEY=<32 char key for 2FA>
REDIS_URL=redis://localhost:6379
FRONTEND_URL=https://your-frontend.com
DOLPHIN_GENERATE_KEY=your_sdk_generation_secret_key
```

> **`DOLPHIN_GENERATE_KEY`**: Secures the `/dolphin/generate-client` download endpoint. If this variable is not set or an incorrect key is provided, the endpoint returns `403 Forbidden`. Set it to a long random secret and pass it as the `--key` flag when running `npx dolphin generate-client`.

### Production Checklist

- ✅ `NODE_ENV=production`
- ✅ `JWT_SECRET` minimum 32 random characters
- ✅ `ENCRYPTION_KEY` set (for 2FA)
- ✅ `DOLPHIN_GENERATE_KEY` set (SDK generator endpoint secured)
- ✅ `.env` in `.gitignore`
- ✅ `secureCookies: true` (HTTPS deployed)
- ✅ MongoDB Atlas or secure MongoDB
- ✅ Redis (for rate-limit scaling)
- ✅ Nginx reverse proxy + SSL

---

## 13. Common Bugs & Fixes

### ❌ Bug 1: Double User (duplicate emails)

```js
// ❌ WRONG — User registered twice
export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: { User }, // ← BUG: User is already above!
});

// ✅ CORRECT
export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: { Product, Order }, // CRUD models only — never User or RefreshToken
});
```

### ❌ Bug 2: `require is not defined` (ESM Error)

```js
// ❌ WRONG
const { createDolphinServer } = require('dolphin-server-modules/server');

// ✅ CORRECT — add "type": "module" to package.json
import { createDolphinServer } from 'dolphin-server-modules/server';
```

### ❌ Bug 3: Cookie not working (Development)

```js
// ❌ WRONG — secureCookies: true on HTTP
const auth = createDolphinAuthController(db, { jwtSecret, secureCookies: true });

// ✅ CORRECT
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production', // only true on HTTPS
});
```

### ❌ Bug 4: MongoDB won't connect

```bash
# Check MongoDB status
sudo systemctl status mongod      # Linux
brew services list | grep mongo   # macOS

# Start if not running
sudo systemctl start mongod

# Test connection
npx dolphin connect mongoose mongodb://localhost:27017

# Atlas format:
# mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### ❌ Bug 5: Rate Limit (429 Error)

```js
// Increase limit or use Redis
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  rateLimit: {
    max: 10,          // default: 5
    window: 900_000,  // 15 minutes
  },
});
```

### ❌ Bug 6: Middleware Auth crash (v2.14.1 — fixed)

```bash
# If you're on an older version:
npm update dolphin-server-modules
# v2.14.1 fixes auth middleware compatibility with Dolphin ctx
```

---

## Complete Example — Blog API

```bash
mkdir my-blog && cd my-blog
npm init -y
# Add "type": "module" to package.json
npm install dolphin-server-modules mongoose
npx dolphin init
npx dolphin add crud Post
node app.js
```

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"blogger@example.com","password":"Blog1234"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"blogger@example.com","password":"Blog1234"}'

# Create post (use token from login)
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","description":"Dolphin is amazing!"}'

# List posts
curl http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Resources

| Resource | Description |
|----------|-------------|
| [TUTORIAL_NEPALI.md](./TUTORIAL_NEPALI.md) | Full tutorial in Nepali |
| [RT_TUTORIAL_NEPALI.md](./RT_TUTORIAL_NEPALI.md) | Realtime WebSocket deep dive (Nepali) |
| [AI_TUTORIAL_NEPALI.md](./AI_TUTORIAL_NEPALI.md) | AI Agent & CLI guide (Nepali) |
| [CLIENT_TUTORIAL_NEPALI.md](./CLIENT_TUTORIAL_NEPALI.md) | Frontend client tutorial (Nepali) |
| [README.md](./README.md) | Module reference |
| [NPM Package](https://www.npmjs.com/package/dolphin-server-modules) | npmjs.com |

---

**Happy Coding! 🐬**  
*Dolphin Server Modules v2.14.1 — Built for speed, AI, and real-time.*
