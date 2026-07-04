# 🐬 Dolphin Server Modules — सम्पूर्ण Tutorial (नेपालीमा)
**Version: 2.14.1 | Production-Ready Guide | 100% Nepali**

---

## 📚 सामग्री तालिका

1. [Dolphin के हो?](#१-dolphin-के-हो)
2. [Installation (स्थापना)](#२-installation)
3. [पहिलो Server](#३-पहिलो-server)
4. [CLI Commands](#४-cli-commands)
5. [Auth System (प्रमाणीकरण)](#५-auth-system)
6. [CRUD Operations](#६-crud-operations)
7. [Mongoose Adapter (सही setup)](#७-mongoose-adapter)
8. [Realtime WebSocket — Server (RealtimeCore v2)](#८-realtime-websocket-server-side--realtimecore-v2)
   - [८.२ publish](#८२-publish--message-पठाउने)
   - [८.३ subscribe / unsubscribe](#८३-subscribe--unsubscribe--message-सुन्ने)
   - [८.४ broadcast](#८४-broadcast--सबैलाई-पठाउने)
   - [८.५ sendTo — Direct device](#८५-sendto--एउटै-device-लाई-direct-पठाउने)
   - [८.६ Device Management](#८६-device-management)
   - [८.७ pubPush / subPull — IoT / High-Frequency](#८७-pubpush--subpull--high-frequency-iot-data)
   - [८.८ File Transfer](#८८-pubfile--subfile--file-transfer-chunked)
   - [८.९ P2P Pass](#८९-p2p-pass--peer-to-peer-data)
   - [८.१० ACL](#८१०-acl--access-control)
   - [८.११ Redis Scaling](#८११-redis-scaling--multiple-servers)
   - [८.१२ Plugins](#८१२-plugins--custom-protocols-modbus-hl7)
   - [८.१३ Raw WebSocket Protocol](#८१३-raw-websocket-protocol-browser--no-library)
9. [DolphinClient — Frontend Library](#८-ख-dolphinclient-frontend-library)
   - [Pub/Sub](#८-ख२-realtime--pubsub)
   - [Auth (login, 2FA, reset)](#८-ख३-auth--login--register--2fa)
   - [API HTTP Calls](#८-ख४-api--http-requests)
   - [React Store (useSyncExternalStore)](#८-ख५-store--react-usesyncexternalstore)
   - [File Transfer](#८-ख६-file-transfer-client-side)
   - [Hookless DOM](#८-ख७-hookless-dom--javascript-नलेखीकनै-ui)
10. [Middleware](#९-middleware)
11. [2FA (Two-Factor Authentication)](#१०-2fa)
12. [Password Reset](#११-password-reset)
13. [AI Features (CLI)](#१२-ai-features)
14. [Production Deployment](#१३-production-deployment)
15. [Common Bugs र Solutions](#१४-common-bugs-र-solutions)
16. [सम्पूर्ण Example Project](#१५-सम्पूर्ण-example-project)

---

## १. Dolphin के हो?

**Dolphin Server Modules** एउटा Node.js को Backend Library हो। यसले Auth, CRUD, Realtime WebSocket, CLI scaffolding, र AI code generation — सबै एकैठाउँमा दिन्छ।

**किन Dolphin प्रयोग गर्ने?**
- ✅ Zero-configuration — एउटा command ले project ready
- ✅ Express जस्तै काम गर्छ, तर हल्का र छिटो
- ✅ MongoDB + Mongoose already integrated
- ✅ `dolphin` CLI ले files आफैं बनाउँछ
- ✅ Production-ready Auth (Argon2 + JWT + TOTP 2FA + Rate Limiting)
- ✅ Nepali developers को लागि बनाइएको

---

## २. Installation

```bash
# Node.js 18+ चाहिन्छ
node --version   # v18.0.0 वा माथि हुनुपर्छ

# नयाँ प्रोजेक्ट बनाउनुहोस्
mkdir mero-project && cd mero-project
npm init -y

# Dolphin install गर्नुहोस्
npm install dolphin-server-modules mongoose
```

**`package.json`** मा `"type": "module"` थप्नुहोस् (ESM को लागि अनिवार्य):
```json
{
  "name": "mero-project",
  "version": "1.0.0",
  "type": "module",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "node --watch app.js"
  }
}
```

**`.env`** file बनाउनुहोस्:
```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/mero_db
JWT_SECRET=change_this_minimum_32_characters_secret
```

---

## ३. पहिलो Server

**`app.js`** बनाउनुहोस्:

```js
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// Simple GET route — object return गरे automatic JSON response
app.get('/', (ctx) => {
  return { 
    message: 'Dolphin Server चलिरहेको छ! 🐬',
    version: '2.14.1'
  };
});

// POST route — ctx.body मा request body हुन्छ (automatic parse)
app.post('/echo', (ctx) => {
  return { 
    success: true, 
    received: ctx.body 
  };
});

// Route parameters — /users/123
app.get('/users/:id', (ctx) => {
  return { userId: ctx.params.id };
});

// Query string — /search?q=hello&page=2
app.get('/search', (ctx) => {
  return { 
    query: ctx.query.q,
    page: ctx.query.page || '1'
  };
});

// Manual status code set गर्ने
app.get('/not-found-example', (ctx) => {
  return ctx.status(404).json({ error: 'Item not found' });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`🐬 Server http://localhost:${PORT} मा चलिरहेको छ`);
});
```

**चलाउनुहोस्:**
```bash
node app.js
# 🐬 Server http://localhost:3000 मा चलिरहेको छ
```

**Test गर्नुहोस्:**
```bash
# GET request
curl http://localhost:3000/
# {"message":"Dolphin Server चलिरहेको छ! 🐬","version":"2.14.1"}

# POST request
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"name":"Ram", "city":"Kathmandu"}'
# {"success":true,"received":{"name":"Ram","city":"Kathmandu"}}
```

---

## ४. CLI Commands

Dolphin CLI ले project structure आफैं बनाउँछ। कुनै manual files बनाउन पर्दैन।

### ४.१ पहिलो पल्ट Project सुरु गर्ने

```bash
# सम्पूर्ण project scaffold — सबैभन्दा राम्रो तरिका
npx dolphin init
```

यसले automatically बनाउँछ:
```
mero-project/
├── app.js                    ← मुख्य server file
├── adapters/
│   ├── connection.js         ← MongoDB connect गर्ने
│   └── db.js                 ← Database adapter (Mongoose)
├── models/
│   └── User.js               ← User + RefreshToken schema
└── .env                      ← Environment variables
```

### ४.२ Models र Routes थप्ने (`add` command)

```bash
# Auth system थप्ने (controllers/auth.js + models/User.js)
npx dolphin add auth

# Product को लागि CRUD थप्ने
# — models/Product.js बन्छ
# — app.js मा route automatically थपिन्छ
# — adapters/db.js मा model automatically register हुन्छ
npx dolphin add crud Product

# Order को model मात्र थप्ने (route बिना)
npx dolphin add model Order

# Custom adapter थप्ने
npx dolphin add adapter mongoose       # MongoDB
npx dolphin add adapter sequelize     # MySQL/PostgreSQL
npx dolphin add adapter redis         # Redis cache

# Route file थप्ने
npx dolphin add route payment         # routes/payment.js

# Middleware थप्ने
npx dolphin add middleware logger     # middleware/logger.js
npx dolphin add middleware ratelimit  # middleware/ratelimit.js

# Service class थप्ने
npx dolphin add service email         # services/Email.service.js
npx dolphin add service notification  # services/Notification.service.js
```

### ४.३ Database Connection Test गर्ने

```bash
# MongoDB connection test
npx dolphin connect mongoose mongodb://localhost:27017
# ✔ Host reachable: localhost:27017
# ✔ Connected! Host: localhost

# MongoDB Atlas test
npx dolphin connect mongoose "mongodb+srv://user:pass@cluster.mongodb.net"

# Redis test
npx dolphin connect redis redis://localhost:6379
```

### ४.४ Project Health Check

```bash
npx dolphin status
# ✔  package.json
# ✔  .env
# ✔  app.js / app.ts
# ✔  adapters/connection.js
# ✔  adapters/db.js
# –  models/         (folder छैन भने yellow warning)
# 
# .env keys:
#   ✔  MONGO_URI
#   ✔  JWT_SECRET
#   –  REDIS_URL    (set छैन)
```

### ४.५ Serve — Port Test

```bash
# Port खुला छ/छैन check गर्ने
npx dolphin serve
# 🐬 Dolphin Dev Server — port 3000
# ✔ Server is live at http://localhost:3000
# Ctrl+C थिचेर रोक्नुहोस्।

# Custom port
npx dolphin serve --port=8080
```

> ⚠️ यो तपाईँको `app.js` run गर्दैन — TCP port live छ/छैन check गर्ने simple utility हो। Development मा `node app.js` वा `node --watch app.js` प्रयोग गर्नुहोस्।

---

### ४.६ Deploy — PM2 Guide

```bash
npx dolphin deploy
```

यसले **step-by-step PM2 deployment guide** देखाउँछ:

```
  Step 1 — PM2 install:
  npm install -g pm2

  Step 2 — Build (TypeScript भए):
  npm run build

  Step 3 — Start:
  pm2 start app.js --name "dolphin-app" --env production

  Step 4 — Auto-start on reboot:
  pm2 startup && pm2 save

  Step 5 — Logs:
  pm2 logs dolphin-app

  ─── ecosystem.config.js (cluster mode) ────────────────
  module.exports = {
    apps: [{ name: 'dolphin-app', script: 'app.js',
      instances: 'max', exec_mode: 'cluster',
      env_production: { NODE_ENV: 'production', PORT: 3000 }
    }]
  };
  pm2 start ecosystem.config.js --env production
```

> **dist/index.js** छ भने त्यही use गर्छ, नभए `app.js` — automatically detect गर्छ।

---

### ४.७ सबै Commands Summary

```bash
# ─── Scaffolding ───────────────────────────────────
npx dolphin init                        # Full project scaffold
npx dolphin init-prod                   # init जस्तै (same output)

npx dolphin add adapter mongoose        # adapters/connection.js + db.js
npx dolphin add adapter sequelize       # config/db.js (MySQL/PostgreSQL)
npx dolphin add adapter redis           # config/redis.js

npx dolphin add auth                    # controllers/auth.js + models/User.js
npx dolphin add crud <ModelName>        # model + app.js route + db.js register (सबै automatic)
npx dolphin add model <ModelName>       # models/ModelName.js मात्र
npx dolphin add route <Name>            # routes/name.js
npx dolphin add middleware <Name>       # middleware/name.js
npx dolphin add service <Name>          # services/Name.service.js

# ─── Database ──────────────────────────────────────
npx dolphin connect mongoose [uri]      # MongoDB TCP + Mongoose test
npx dolphin connect redis [uri]         # Redis TCP test

# ─── AI (API key चाहिन्छ) ─────────────────────────
npx dolphin generate "prompt"           # → ai-generated.js
npx dolphin generate-full "prompt"      # → multiple files (AI decides)
npx dolphin chat                        # Interactive AI agent (file read/write/run)

# ─── Project ───────────────────────────────────────
npx dolphin status                      # Project health check
npx dolphin deploy                      # PM2 deployment guide
npx dolphin serve [--port=N]            # TCP port test server

# ─── Client SDK Generator ───────────────────────────
npx dolphin generate-client --url=http://localhost:3000 --out=./dolphin-client.js --key=your_secret
                                        # Auto-generated client SDK बनाउँछ
                                        # → dolphin-client.js  (browser SDK)
                                        # → dolphin-client.d.ts (TypeScript types)

# ─── Info ──────────────────────────────────────────
npx dolphin --version                   # 🐬 Dolphin CLI v2.14.1
npx dolphin help                        # सबै commands को list
```

---

## ५. Auth System

### ५.१ User Model बनाउने

`npx dolphin init` वा `npx dolphin add auth` ले automatically बनाउँछ। Manual बनाउन:

```js
// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email:                { type: String, required: true, lowercase: true, trim: true },
  password:             { type: String, required: true },
  role:                 { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
  twoFactorEnabled:     { type: Boolean, default: false },
  twoFactorSecret:      { type: String, default: null },
  pending2FASecret:     { type: String, default: null },
  recoveryCodes:        { type: [String], default: [] },
  isActive:             { type: Boolean, default: true },
  lastLoginAt:          { type: Date, default: null },
  resetPasswordToken:   { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

// Unique index — duplicate email रोक्न
userSchema.index({ email: 1 }, { unique: true });
export const User = mongoose.model('User', userSchema);

// Refresh Token — JWT refresh को लागि
const refreshTokenSchema = new mongoose.Schema({
  token:             { type: String, required: true, unique: true, index: true },
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt:         { type: Date, required: true },
  twoFactorVerified: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

// Auto-expire old tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
```

### ५.२ Adapter र Connection Setup

```js
// adapters/connection.js
import mongoose from 'mongoose';

export const connectDB = async (uri = process.env.MONGO_URI) => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Connected:', mongoose.connection.host);
  } catch (e) {
    console.error('❌ MongoDB Error:', e.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB:', err.message));
```

```js
// adapters/db.js — CORRECT setup
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';
// import { Product } from '../models/Product.js';  ← अरू models यहाँ import

export const db = createMongooseAdapter({
  User,          // Auth को लागि — यहाँ registered
  RefreshToken,  // Auth को लागि — यहाँ registered

  models: {
    // यहाँ CRUD models मात्र थप्नुहोस्
    // ⚠️ NEVER: User वा RefreshToken यहाँ थप्नु हुन्न!
    //    (Double User Bug — auth email check bypass हुन्छ)
    // Product,
    // Order,
  },
  leanByDefault: true,   // Fast reads
  softDelete: false,
});
```

### ५.३ App.js मा Auth Routes थप्ने

```js
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

const app = createDolphinServer();

// Error handler (सबैभन्दा पहिले राख्नुहोस्)
app.use(async (ctx, next) => {
  try { if (next) await next(); }
  catch (error) {
    console.error('🔥 ERROR:', error.message);
    ctx.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// MongoDB connect
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/mero_db');

// Auth controller
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET || 'change_in_production_min_32_chars',
  secureCookies: process.env.NODE_ENV === 'production',  // HTTPS भए मात्र true
});

// ── Auth Routes ──
app.post('/api/auth/register',        auth.register);
app.post('/api/auth/login',           auth.login);
app.post('/api/auth/refresh',         auth.refresh);
app.post('/api/auth/logout',          auth.requireAuth, auth.logout);
app.get('/api/auth/me',               auth.requireAuth, auth.me);
app.post('/api/auth/change-password', auth.requireAuth, auth.changePassword);
app.post('/api/auth/forgot-password', auth.forgotPassword);
app.post('/api/auth/reset-password',  auth.resetPassword);

// 2FA Routes
app.post('/api/auth/2fa/enable',      auth.requireAuth, auth.enable2FA);
app.post('/api/auth/2fa/verify',      auth.requireAuth, auth.verify2FA);
app.post('/api/auth/2fa/disable',     auth.requireAuth, auth.disable2FA);

app.get('/health', (ctx) => ({ status: 'ok', ts: new Date().toISOString() }));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`🐬 Server port ${PORT} मा चलिरहेको छ`));
```

### ५.४ Register (नयाँ User बनाउने)

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "ram@example.com", "password": "Secure123"}'
```

**Password नियमहरू (mandatory):**
- कम्तीमा **8 अक्षर**
- कम्तीमा एउटा **uppercase** (A-Z)
- कम्तीमा एउटा **lowercase** (a-z)
- कम्तीमा एउटा **number** (0-9)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456...",
    "email": "ram@example.com",
    "role": "user"
  }
}
```

**Error — duplicate email:**
```json
{ "success": false, "error": "Email already registered", "status": 400 }
```

### ५.५ Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ram@example.com", "password": "Secure123"}'
```

**Success Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "abc123...",
    "email": "ram@example.com",
    "role": "user",
    "twoFactorEnabled": false
  }
}
```
> `rt` (refresh token) cookie **automatically** set हुन्छ — client ले manually handle गर्नु पर्दैन।

**Rate Limiting:** एउटै email बाट 5 पल्ट गलत password हाले 15 मिनेटको ban।

### ५.६ Protected Routes बनाउने

```js
// Login चाहिन्छ
app.get('/api/dashboard', auth.requireAuth, (ctx) => {
  return { 
    message: `Welcome, ${ctx.req.user.email}!`,
    userId: ctx.req.user.id,
    role: ctx.req.user.role
  };
});

// Admin मात्र access गर्न सक्छ
app.get('/api/admin/users', auth.requireAdmin, (ctx) => {
  return { message: 'Admin panel — सबै users' };
});

// 2FA verified भएको मात्र
app.get('/api/sensitive', auth.require2FA, (ctx) => {
  return { message: 'Sensitive data — 2FA verified user' };
});
```

**Client बाट call गर्ने:**
```bash
curl http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### ५.७ Token Refresh

```bash
# Browser ले automatically refresh token cookie पठाउँछ
# Manual test:
curl -X POST http://localhost:3000/api/auth/refresh \
  --cookie "rt=your_refresh_token_here"
```

**Response:** नयाँ `accessToken` र नयाँ `rt` cookie।

---

## ६. CRUD Operations

### ६.१ Model बनाउने

```bash
# CLI ले automatically बनाउँछ
npx dolphin add crud Product
# models/Product.js बन्छ
# app.js मा route थपिन्छ
# adapters/db.js मा register हुन्छ
```

Manual बनाउन:
```js
// models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, default: 'general' },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false });

productSchema.index({ userId: 1, status: 1 });
productSchema.index({ createdAt: -1 });
export const Product = mongoose.model('Product', productSchema);
```

### ६.२ Adapter मा Register गर्ने

```js
// adapters/db.js — Product थप्ने
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';
import { Product } from '../models/Product.js';   // ← import

export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    Product,   // ← यहाँ थप्ने
  },
  leanByDefault: true,
  softDelete: false,
});
```

### ६.३ CRUD Routes थप्ने

```js
// app.js मा
import { createCrudRouter } from 'dolphin-server-modules/crud';
import { Product } from './models/Product.js';

// एउटै line ले सबै CRUD routes बन्छ!
app.use('/api/products', createCrudRouter(db, 'Product', {
  softDelete: true,        // DELETE ले database बाट हट्दैन, deletedAt set हुन्छ
  enforceOwnership: true,  // users ले आफ्नै data मात्र access गर्न सक्छन्
}));
```

**Available Routes:**

| Method | Endpoint | काम |
|--------|----------|-----|
| `GET` | `/api/products` | सबै list |
| `GET` | `/api/products?limit=10&offset=0` | Pagination |
| `GET` | `/api/products/:id` | एउटा हेर्ने |
| `POST` | `/api/products` | नयाँ बनाउने |
| `PUT` | `/api/products/:id` | Update गर्ने |
| `DELETE` | `/api/products/:id` | Delete गर्ने |

### ६.४ CRUD Test गर्ने

```bash
# सबैभन्दा पहिले Login गर्ने र TOKEN लिने
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ram@example.com","password":"Secure123"}' | \
  grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Product बनाउने
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Laptop", "price": 150000, "description": "Gaming laptop"}'

# सबै products हेर्ने
curl http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN"

# Pagination
curl "http://localhost:3000/api/products?limit=5&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Update गर्ने
curl -X PUT http://localhost:3000/api/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"price": 140000}'

# Delete गर्ने
curl -X DELETE http://localhost:3000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## ७. Mongoose Adapter

`createMongooseAdapter` ले Auth र CRUD दुवैको लागि MongoDB operations handle गर्छ।

### ७.१ सही Setup (Double User Bug बाट बच्ने)

```js
// adapters/db.js — ✅ CORRECT (सबैभन्दा महत्त्वपूर्ण!)
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

export const db = createMongooseAdapter({
  // Auth Models — top level मा register गर्नुहोस्
  User,          // ✅ यहाँ registered छ
  RefreshToken,  // ✅ यहाँ registered छ

  models: {
    // CRUD Models — models: {} मा मात्र थप्नुहोस्
    Product,     // ✅ यहाँ राम्रो
    Order,       // ✅ यहाँ राम्रो

    // ❌ NEVER User यहाँ थप्नु हुन्न:
    //    User,  ← यो गर्दा CRUD बाट user create गर्दा
    //              email validation र duplicate check bypass हुन्छ!
  },

  leanByDefault: true,  // Fast reads (mongoose lean mode)
  maxLimit: 100,        // Per-page maximum items
  softDelete: false,    // Global soft delete (true भए सबै collections मा)
});
```

### ७.२ Direct Database Operations

```js
// ── Auth Operations ──
const user = await db.createUser({ 
  email: 'ram@example.com', 
  password: hashedPassword  // Argon2 hash
});
const found = await db.findUserByEmail('ram@example.com');
const byId = await db.findUserById('userId123');
await db.updateUser('userId123', { role: 'admin', lastLoginAt: new Date() });

// ── Generic CRUD Operations ──
// Create
const product = await db.create('Product', { 
  title: 'Laptop', 
  price: 150000,
  userId: 'userId123'  // ownership
});

// Read many
const all = await db.read('Product', { status: 'active' });
const byUser = await db.read('Product', { userId: 'userId123' });

// Read one
const one = await db.readOne('Product', 'productId123');
const oneByUser = await db.readOne('Product', 'productId123', 'userId123');

// Update
await db.update('Product', { id: 'productId123' }, { price: 140000 });
await db.updateOne('Product', 'productId123', { price: 140000 });

// Delete
await db.delete('Product', { id: 'productId123' });
await db.deleteOne('Product', 'productId123');

// Pagination
const page = await db.paginate('Product', { status: 'active' }, 1, 10);
// Returns: { items: [...], total: 50, page: 1, limit: 10, totalPages: 5, hasNext: true, hasPrev: false }

// Count
const count = await db.count('Product', { status: 'active' });
const exists = await db.exists('Product', { title: 'Laptop' });

// Advanced read — sort, limit, offset, populate
const sorted = await db.advancedRead(
  'Product',
  { status: 'active' },
  { 
    sort: { createdAt: 'desc' },
    limit: 20,
    offset: 0,
    populate: 'userId',   // Reference populate
  }
);
```

---

## ८. Realtime WebSocket (Server-Side — RealtimeCore v2)

Dolphin को Realtime system MQTT-style pub/sub हो। Topics ले data route गर्छ, wildcards support गर्छ, Redis ले multiple servers scale गर्छ।

### ८.१ Server Setup

```js
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createRealtimeCore } from 'dolphin-server-modules/realtime';

const rt = createRealtimeCore({
  debug: false,                    // true भए verbose logs
  maxMessageSize: 256 * 1024,      // 256KB max per message (default)
  enableJSONCache: true,           // Repeated same-object publish को cache गर्ने
  useBinaryProtocol: false,        // true भए binary framing (speed+)
  maxBufferPerTopic: 100,          // pubPush buffer per topic (IoT)
  enableP2P: false,                // P2P peer discovery
  // redisUrl: process.env.REDIS_URL,  // Multiple servers को लागि
  // acl: {
  //   canSubscribe: (deviceId, topic) => true,
  //   canPublish:   (deviceId, topic) => true,
  // },
});

const app = createDolphinServer({
  realtime: rt,
  allowedWebSocketPaths: ['/realtime'],
});

app.listen(3000);
```

---

### ८.२ publish — Message पठाउने

```js
// साधारण publish
rt.publish('chat/room1', { message: 'नमस्ते!', from: 'server' });

// Retained message — नयाँ subscriber ले join गर्दा immediately पाउँछ
rt.publish('system/status', { online: true, users: 42 }, { retain: true });

// TTL सहित retained — 1 मिनेट पछि expire
rt.publish('flash/sale', { discount: 20 }, { retain: true, ttl: 60_000 });

// ACL device ID सहित (optional)
rt.publish('news/global', { headline: '...' }, {}, 'device-abc');
```

---

### ८.३ subscribe / unsubscribe — Message सुन्ने

```js
// Exact match
rt.subscribe('chat/room1', (data, topic) => {
  console.log('Room1 message:', data);
});

// Wildcard: + = एक level मात्र
rt.subscribe('chat/+', (data, topic) => {
  // 'chat/room1', 'chat/room2' — match हुन्छ
  // 'chat/room1/messages' — match हुँदैन
  console.log(`[${topic}]`, data);
});

// Wildcard: # = सबै sub-levels
rt.subscribe('logs/#', (data, topic) => {
  // 'logs/error', 'logs/info', 'logs/http/404' — सबै match
});

// Device-specific subscribe (subscription tracking को लागि)
rt.subscribe('user/abc123/notify', (data) => {
  console.log('User notification:', data);
}, 'device-abc123');

// Unsubscribe — function reference चाहिन्छ
const handler = (data, topic) => console.log(data);
rt.subscribe('updates/+', handler);
rt.unregister('device-abc123', 'updates/+');  // deviceId-based unsubscribe
```

---

### ८.४ broadcast — सबैलाई पठाउने

```js
// Connected सबै devices लाई पठाउने
rt.broadcast('announcements/all', { 
  message: 'Server restart in 5 minutes!',
  ts: Date.now()
});

// Specific devices लाई exclude गरेर
rt.broadcast('chat/room1', { message: 'Hello everyone!' }, {
  exclude: ['device-admin', 'device-bot']  // यी दुईलाई पठाउँदैन
});
```

---

### ८.५ sendTo — एउटै Device लाई Direct पठाउने

```js
// deviceId जान्नु पर्छ
const sent = rt.sendTo('device-abc123', {
  type: 'PRIVATE_MESSAGE',
  from: 'server',
  text: 'तपाईँको account verify भयो!'
});

if (!sent) {
  console.log('Device offline छ');
}

// Device online छ/छैन check गर्ने
const ready = rt.isReady('device-abc123');   // socket open र connected
const online = rt.isOnline('device-abc123'); // devices map मा छ
```

---

### ८.६ Device Management

```js
// Device register गर्ने (server ले automatically गर्छ WebSocket upgrade मा)
// Manual register (custom WebSocket server भए):
rt.register('my-device-001', socket, { userAgent: 'Mobile App' });

// Device kick गर्ने (ban/abuse)
rt.kick('bad-device-id', 'Terms of service violation');

// सबै subscriptions हटाउने (disconnect)
rt.unregister('device-abc123');

// Specific topic बाट मात्र हटाउने
rt.unregister('device-abc123', 'chat/room1');

// Device lastSeen update गर्ने (heartbeat)
rt.touch('device-abc123');

// Stats हेर्ने
const stats = rt.getStats();
console.log(stats);
// {
//   version: '2.0',
//   devices: 42,          ← connected devices
//   retained: 5,          ← retained messages
//   plugins: 0,
//   highFreqBuffers: 3,   ← IoT buffer topics
//   files: 2,             ← registered files
//   activeTransfers: 1,   ← ongoing downloads
//   peers: 0
// }
```

---

### ८.७ pubPush / subPull — High-Frequency IoT Data

IoT sensors, live graphs, stock tickers — JSON overhead बिना ultra-fast data streaming।

```js
// Server side: sensor data push (No JSON.stringify, No Redis, No ACL overhead)
setInterval(() => {
  // Binary Buffer (fastest)
  rt.pubPush('sensors/temp', Buffer.from([Math.round(25 + Math.random() * 10)]));
  
  // Object पनि चल्छ
  rt.pubPush('sensors/humidity', { value: 65.3, ts: Date.now() });
  
  // Stock ticker
  rt.pubPush('stocks/NABIL', { price: 1240.5, change: +2.3 });
}, 100);  // 10 times per second

// Client ले पुरानो data माग्ने (server ले buffer बाट दिन्छ)
rt.subPull('device-mobile-001', 'sensors/temp', 50);  // पछिल्लो 50 readings
// Device लाई PULL_DATA type message मिल्छ
```

**Client side (Raw WebSocket):**
```js
ws.send(JSON.stringify({ type: 'pub_push', topic: 'sensors/temp', payload: 25.4 }));
ws.send(JSON.stringify({ type: 'sub_pull', topic: 'sensors/temp', count: 20 }));
```

---

### ८.८ pubFile / subFile — File Transfer (Chunked)

ठूला files WebSocket मार्फत 64KB chunks मा transfer।

**Server: File register गर्ने**
```js
import { readFileSync } from 'fs';

// File server मा register गर्ने
const fileData = readFileSync('./reports/monthly.pdf');
const fileId = await rt.pubFile('monthly-report-2026', fileData, 'monthly.pdf');
console.log(`File registered: ${fileId}`);

// File info
const info = rt.getFileInfo('monthly-report-2026');
// { path, size, chunkSize: 65536, totalChunks, name, hash, createdAt }

// सबै available files
const files = rt.listFiles();
// [{ fileId, name, size, totalChunks }]
```

**Server: Client लाई file पठाउने**
```js
// Client ले request गर्दा device लाई chunks पठाउने
rt.subFile('device-mobile-001', 'monthly-report-2026');

// Chunk 5 बाट resume गर्ने (partially downloaded)
rt.subFile('device-mobile-001', 'monthly-report-2026', 5);

// Resume: progress automatically track गरेको ठाउँबाट सुरु
rt.resumeFile('device-mobile-001', 'monthly-report-2026');

// Progress check
const lastChunk = rt.getFileProgress('device-mobile-001', 'monthly-report-2026');
```

---

### ८.९ P2P Pass — Peer-to-Peer Data

Server ले directly client-to-client data relay गर्छ (WebRTC signaling alternative)।

```js
// P2P enable गर्ने
const rt = createRealtimeCore({ enableP2P: true });

// File peer लाई announce गर्ने
rt.announceToPeers('big-video-file', 'device-seeder');
// सबै connected devices लाई 'p2p/announce' topic मा PEER_AVAILABLE message जान्छ

// कुन devices मा file छ?
const peers = rt.getPeersForFile('big-video-file');
// ['device-seeder', 'device-xyz']

// Peer बाट specific chunk माग्ने
rt.requestFromPeer('device-downloader', 'device-seeder', 'big-video-file', 3);
// device-seeder लाई P2P_REQUEST message जान्छ

// Peer-to-peer data पठाउने (server pass-through)
rt.sendToPeer('device-a', 'device-b', { chunk: 3, data: '...' });
```

---

### ८.१० ACL — Access Control

कुन device ले कुन topic subscribe/publish गर्न सक्छ।

```js
const rt = createRealtimeCore({
  acl: {
    canSubscribe: (deviceId, topic) => {
      // Admin जो पनि subscribe गर्न सक्छ
      if (deviceId.startsWith('admin-')) return true;
      
      // Users ले आफ्नै topic मात्र
      if (topic.startsWith(`user/${deviceId}/`)) return true;
      
      // Public topics
      if (topic.startsWith('public/')) return true;
      
      return false;  // बाँकी सबै deny
    },
    canPublish: (deviceId, topic) => {
      // Admin ले जतापनि publish
      if (deviceId.startsWith('admin-')) return true;
      
      // Users ले आफ्नै namespace मात्र
      return topic.startsWith(`user/${deviceId}/`);
    }
  }
});
```

---

### ८.११ Redis Scaling — Multiple Servers

```bash
npm install ioredis
```

```js
// Server 1 र Server 2 — दुवैमा same Redis URL
const rt = createRealtimeCore({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Server 1 मा publish → Server 2 का subscribers ले पनि पाउँछन्
// Automatic — कुनै code change चाहिँदैन
```

---

### ८.१२ Plugins — Custom Protocols (Modbus, HL7)

```js
import { RealtimePlugin } from 'dolphin-server-modules/realtime';

// Custom binary protocol plugin
const myProtocol = {
  name: 'my-sensor-protocol',
  
  // यो plugin कहिले activate हुन्छ?
  match: (ctx) => ctx.raw && ctx.raw[0] === 0xAA,  // Magic byte check
  
  // Binary → Object
  decode: (buf) => ({
    deviceId: buf.readUInt16BE(1),
    temperature: buf.readInt16BE(3) / 100,
    humidity: buf.readUInt16BE(5) / 100,
  }),
  
  // Object → Binary
  encode: (data) => {
    const buf = Buffer.alloc(7);
    buf[0] = 0xAA;
    buf.writeUInt16BE(data.deviceId, 1);
    buf.writeInt16BE(Math.round(data.temperature * 100), 3);
    buf.writeUInt16BE(Math.round(data.humidity * 100), 5);
    return buf;
  },
  
  // Message handler
  onMessage: (ctx) => {
    const decoded = ctx.payload;
    ctx.publish(`sensors/${decoded.deviceId}/data`, decoded);
  }
};

rt.use(myProtocol);
```

---

### ८.१३ Raw WebSocket Protocol (Browser — no library)

#### JWT Authentication (WebSocket)

WebSocket connection मा JWT token `&token=` query parameter मार्फत पठाउन सकिन्छ। Server ले token verify गर्छ — invalid वा expired token भएमा connection तुरुन्त disconnect हुन्छ।

```js
// JWT सहित connect (authenticated realtime)
const token = localStorage.getItem('access_token'); // Login पछि पाएको JWT
const ws = new WebSocket(
  `ws://localhost:3000/realtime?deviceId=browser-001&token=${token}`
);
// ⚠️ Token invalid वा expire भएमा server ले disconnect गर्छ
```

#### SSE Fallback

यदि WebSocket support नभए वा blocked भए, client स्वतः **Server-Sent Events (SSE)** मा fall back गर्छ। `DolphinClient` library ले यो automatically handle गर्छ।

```
GET /realtime/sse?deviceId=browser-001&token=JWT_TOKEN
```

#### Raw WebSocket (बिना library)

```js
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=browser-001');

ws.onopen = () => {
  // Subscribe
  ws.send(JSON.stringify({ type: 'sub', topic: 'chat/room1' }));

  // Publish
  ws.send(JSON.stringify({ 
    type: 'pub', 
    topic: 'chat/room1', 
    payload: { message: 'नमस्ते!', from: 'Ram' }
  }));

  // High-freq push
  ws.send(JSON.stringify({ type: 'pub_push', topic: 'sensors/temp', payload: 25.4 }));

  // Pull historical data
  ws.send(JSON.stringify({ type: 'sub_pull', topic: 'sensors/temp', count: 20 }));

  // File download request
  ws.send(JSON.stringify({ type: 'sub_file', fileId: 'monthly-report-2026' }));

  // Unsubscribe
  ws.send(JSON.stringify({ type: 'unsub', topic: 'chat/room1' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch(msg.type) {
    case 'message':    // Normal pub/sub
      console.log(`[${msg.topic}]`, msg.payload);
      break;
    case 'PULL_DATA':  // subPull response
      console.log('Historical data:', msg.data);
      break;
    case 'PULL_EMPTY': // No buffer data
      console.log('No data yet for:', msg.topic);
      break;
    case 'FILE_CHUNK': // File transfer chunk
      console.log(`Chunk ${msg.chunkIndex}/${msg.totalChunks}:`, msg.data);
      break;
    case 'FILE_COMPLETE':
      console.log('Download complete!');
      break;
    case 'KICK':
      console.log('Kicked:', msg.message);
      break;
  }
};

ws.onclose = () => console.log('WebSocket closed');
ws.onerror = (e) => console.error('WebSocket error:', e);
```

---

## ८-ख. DolphinClient (Frontend Library)

`dolphin-client` package ले Browser र Node.js मा Dolphin server सँग connect गर्न मद्दत गर्छ। Auth, HTTP API, Realtime WebSocket, File transfer, React store — सबै built-in।

### ८-ख.१ Install र Setup

```bash
npm install dolphin-client
```

```html
<!-- Browser (CDN) -->
<script src="node_modules/dolphin-client/dist/dolphin-client.js"></script>
```

```js
// ESM / Node.js
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient('http://localhost:3000', 'my-device-001', {
  autoConnect: true,        // new DolphinClient पछि automatically connect
  reconnectAttempts: 5,     // disconnect भए कति पल्ट retry
  reconnectDelay: 2000,     // retry बीच ms
  debug: false,             // true भए verbose logs
  httpTimeout: 10_000,      // HTTP request timeout (ms)
  wsHeartbeat: 30_000,      // WebSocket ping interval
});

// Manual connect (autoConnect: false भए)
await dolphin.connect();

// Disconnect
dolphin.disconnect();
```

#### Auto-Generated SDK (CLI बाट बनाइएको)

`npx dolphin generate-client` command ले `dolphin-client.js` र `dolphin-client.d.ts` generate गर्छ। यो auto-generated SDK directly import गर्न सकिन्छ:

```html
<!-- Browser मा auto-generated SDK use गर्ने -->
<script src="./dolphin-client.js"></script>
```

```js
// ESM / TypeScript मा
import { DolphinClient } from './dolphin-client.js';
// TypeScript types: dolphin-client.d.ts automatically picked up
```

#### Topic Subscriptions सँग Realtime Connect

Realtime connect गर्दा specific topics को list पठाउन सकिन्छ। Server ले ती topics मा आउने messages मात्र client लाई पठाउँछ।

```js
// Topic list सहित connect
await client.connectRealtime(
  (message) => {
    // message = { action: 'create'|'update'|'delete', data: {...}, topic: 'todos' }
    console.log(`[${message.topic}] ${message.action}:`, message.data);
  },
  ['todos', 'notifications', 'chat/room1']  // Subscribe गर्ने topics
);
```

> **SSE Fallback:** WebSocket connect हुन नसकेमा `DolphinClient` स्वतः SSE (`/realtime/sse?deviceId=...&token=...`) मा fall back गर्छ — code मा कुनै परिवर्तन चाहिँदैन।

---

### ८-ख.२ Realtime — Pub/Sub

```js
// Subscribe — MQTT wildcards support
dolphin.subscribe('chat/room1', (payload, topic) => {
  console.log(`[${topic}]`, payload);
});

dolphin.subscribe('user/+/update', (payload, topic) => {
  const userId = topic.split('/')[1];
  console.log(`User ${userId} updated:`, payload);
});

// Publish — offline भए queue मा राख्छ, reconnect भएपछि flush
dolphin.publish('chat/room1', { 
  message: 'नमस्ते!', 
  from: 'Ram',
  ts: Date.now() 
});

// Unsubscribe
const handler = (payload) => console.log(payload);
dolphin.subscribe('news/#', handler);
dolphin.unsubscribe('news/#', handler);

// High-frequency push (IoT)
dolphin.pubPush('sensors/temp', { value: 25.4, ts: Date.now() });

// Historical data माग्ने
dolphin.subPull('sensors/temp', 30);  // पछिल्लो 30 readings
```

---

### ८-ख.३ Auth — Login / Register / 2FA

```js
// Register
const regResult = await dolphin.auth.register({
  email: 'ram@example.com',
  password: 'Secure123',
  name: 'Ram Bahadur',  // extra fields pass गर्न सकिन्छ
});

// Login
const loginResult = await dolphin.auth.login('ram@example.com', 'Secure123');
console.log(loginResult.accessToken);  // JWT
// Token automatically save + future requests मा header लाग्छ

// Current user
const user = await dolphin.auth.me();
console.log(user.email, user.role);

// Logout (token clear + refresh token revoke)
await dolphin.auth.logout();

// Token manually set गर्ने (external login flow भए)
dolphin.setToken('eyJhbGc...');

// Token refresh गर्ने (httpOnly cookie बाट)
const refreshed = await dolphin.auth.refresh();  // returns true/false

// ─── 2FA ───
const { secret, uri } = await dolphin.auth.enable2FA();
// uri लाई QR code बनाउन QRCode library use गर्नुहोस्

await dolphin.auth.verify2FA('123456', 'ram@example.com');

await dolphin.auth.disable2FA('123456');

// Password Reset
await dolphin.auth.forgotPassword('ram@example.com');
await dolphin.auth.resetPassword('reset-token-from-email', 'NewPass456');
```

---

### ८-ख.४ API — HTTP Requests

```js
// Proxy-style (chainable path)
const products = await dolphin.api.products.get();
const one = await dolphin.api.products({ id: 'abc123' }).get();
const created = await dolphin.api.products.post({ title: 'Laptop', price: 150000 });
const updated = await dolphin.api.products({ id: 'abc123' }).put({ price: 140000 });
await dolphin.api.products({ id: 'abc123' }).del();

// Direct request
const data = await dolphin.api.request('GET', '/api/products');
const posted = await dolphin.api.request('POST', '/api/auth/register', {
  email: 'test@example.com',
  password: 'Test1234'
});

// requestDirect — timeout, retry, auto token-refresh सहित
const result = await dolphin.api.requestDirect('GET', '/api/auth/me');

// Custom headers
const secured = await dolphin.api.request('GET', '/api/admin', null, {
  headers: { 'X-Admin-Key': 'secret' }
});
```

---

### ८-ख.५ Store — React useSyncExternalStore

Server data React component मा automatically sync। No useState, No useEffect।

```js
import { useSyncExternalStore } from 'react';
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient('http://localhost:3000', 'react-app');
await dolphin.connect();

// Product list React component मा sync
function ProductList() {
  const products = useSyncExternalStore(
    (listener) => dolphin.store.subscribe(listener),
    () => dolphin.store.getSnapshot('products')
  );

  if (!products) return <p>Loading...</p>;

  return (
    <ul>
      {products.items.map(p => (
        <li key={p.id}>{p.title} — रु. {p.price}</li>
      ))}
    </ul>
  );
}

// Server-side: products publish गर्ने
// rt.publish('products/update', updatedProducts) — automatic sync!

// Cleanup (component unmount)
useEffect(() => {
  return () => dolphin.store.destroy();
}, []);
```

---

### ८-ख.६ File Transfer (Client-side)

```js
// File Upload (Browser → Server)
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

await dolphin.pubFile(
  'user-upload-001',     // fileId (unique)
  file,                  // Blob | ArrayBuffer | Uint8Array
  file.name,             // filename (optional)
  (progress) => {        // progress callback 0-100
    console.log(`Upload: ${progress}%`);
    progressBar.style.width = progress + '%';
  }
);

// File Download (Server → Client)
dolphin.subscribe('file/download/response', (chunk) => {
  // Chunk data आउँछ
});
dolphin.subFile('monthly-report-2026');  // chunk 0 बाट

// Partial download resume
dolphin.resumeFile('monthly-report-2026');

// Progress save/load
dolphin.saveFileProgress('monthly-report-2026', 42);  // chunk 42 सम्म downloaded

// Signals (WebRTC को लागि)
dolphin.onSignal((signal) => {
  console.log('Signaling message:', signal);
});
dolphin.offSignal(handler);

// New file available notification
dolphin.onFileAvailable((meta) => {
  console.log(`New file available: ${meta.name} (${meta.size} bytes)`);
});
```

---

### ८-ख.७ Hookless DOM — JavaScript नलेखीकनै UI

`DolphinClient` ले HTML `data-*` attributes मार्फत automatic API calls र realtime binding गर्छ।

**Form Submit → API:**
```html
<!-- Login form — JavaScript छैन! -->
<form data-api-submit="POST /api/auth/login" 
      data-api-redirect="/dashboard">
  <input type="email"    name="email"    placeholder="Email" />
  <input type="password" name="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>

<!-- Register form -->
<form data-api-submit="POST /api/auth/register" 
      data-api-redirect="/welcome">
  <input name="email"    required />
  <input name="password" required />
  <button>Register</button>
</form>

<!-- Product create form -->
<form data-api-submit="POST /api/products"
      data-api-reload="true">
  <input name="title" placeholder="Product name" />
  <input name="price" type="number" />
  <button>थप्नुहोस्</button>
</form>
```

**Button Click → API:**
```html
<!-- Logout button -->
<button data-api-click="POST /api/auth/logout"
        data-api-redirect="/login">
  Logout
</button>

<!-- Delete product -->
<button data-api-click="DELETE /api/products/{{id}}"
        data-api-reload="true">
  Delete
</button>

<!-- API result DOM मा राख्ने -->
<button data-api-click="GET /api/auth/me"
        data-api-result="userProfile">
  Load Profile
</button>
<div id="userProfile"></div>
```

**Realtime DOM Binding:**
```html
<!-- Array list — Loop automatically -->
<ul data-api-get="/api/products"
    data-rt-bind="/api/products"
    data-rt-template="<li>{{title}} — रु.{{price}}</li>">
</ul>
<!-- Server ले rt.publish('products/update', [...]) गर्दा list automatically update -->

<!-- Context binding — nested data -->
<div data-rt-bind="auth/user" data-rt-type="context">
  <img data-rt-attr="src:avatarUrl, alt:name" />
  <h2>स्वागत छ, <span data-rt-text="name"></span>!</h2>
  <p data-rt-html="bio"></p>
  
  <!-- Conditional show/hide -->
  <button data-rt-if="isAdmin">Admin Panel</button>
  <p data-rt-hide="isVerified">Email verify गर्नुहोस्!</p>
</div>
```

**Realtime Input Push:**
```html
<!-- Input type हुँदा realtime publish हुन्छ -->
<input type="text"
       name="search"
       data-rt-push="search/query"
       placeholder="खोज्नुहोस्..." />
<!-- rt.subscribe('search/query', ...) ले server मा receive गर्छ -->
```

**Form → Realtime Publish:**
```html
<!-- Form submit → WebSocket publish (API होइन) -->
<form data-rt-submit="chat/room1">
  <input name="message" placeholder="Message..." />
  <input name="from"    value="Ram" type="hidden" />
  <button>Send</button>
</form>
```

**Dynamic Payload with Context:**
```html
<div data-rt-bind="user/profile" data-rt-type="context">
  <!-- {{id}} context बाट automatically fill हुन्छ -->
  <button data-rt-click="user/{{id}}/like"
          data-rt-payload='{"action":"like","targetId":"{{id}}"}'>
    Like
  </button>
</div>
```

**DOM Initialization:**
```html
<script type="module">
  import { DolphinClient } from '/node_modules/dolphin-client/dist/index.js';

  // DolphinClient create भएपछि DOM binding automatically active हुन्छ
  window.dolphin = new DolphinClient('http://localhost:3000', 'page-user', {
    autoConnect: true
  });
</script>
```

---

## ९. Middleware

### ९.१ Global Middleware

```js
// ── Logger ──
app.use(async (ctx, next) => {
  const start = Date.now();
  if (next) await next();
  const ms = Date.now() - start;
  console.log(`[${ctx.req.method}] ${ctx.req.url} — ${ms}ms`);
});

// ── CORS ──
app.use(async (ctx, next) => {
  ctx.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  ctx.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  ctx.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  ctx.setHeader('Access-Control-Allow-Credentials', 'true');
  if (ctx.req.method === 'OPTIONS') {
    return ctx.status(204).json({});
  }
  if (next) await next();
});

// ── Error Handler ──
app.use(async (ctx, next) => {
  try {
    if (next) await next();
  } catch (error) {
    console.error('🔥 Server Error:', error.message);
    ctx.status(error.status || 500).json({ 
      success: false, 
      message: error.message || 'Internal Server Error' 
    });
  }
});
```

### ९.२ Zod Validation

```bash
npm install zod
```

```js
import { zodMiddleware } from 'dolphin-server-modules/middleware/zod';
import { z } from 'zod';

// Schema define गर्ने
const createProductSchema = z.object({
  title:       z.string().min(1, 'Title required').max(200),
  price:       z.number().min(0, 'Price cannot be negative'),
  description: z.string().optional(),
  category:    z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Password min 8 chars'),
});

// Route मा use गर्ने
app.post('/api/products',
  auth.requireAuth,
  zodMiddleware(createProductSchema),   // Validation — गलत data भए automatic 400
  (ctx) => {
    // ctx.body here is already validated and typed
    return { success: true, data: ctx.body };
  }
);

// Custom error response
app.post('/api/auth/login',
  zodMiddleware(loginSchema, {
    errorStatus: 422,
    errorMessage: 'Validation failed'
  }),
  auth.login
);
```

---

## १०. 2FA (Two-Factor Authentication)

TOTP-based 2FA — Google Authenticator, Authy सँग compatible।

### १०.१ Enable गर्ने

```bash
POST /api/auth/2fa/enable
Authorization: Bearer TOKEN

# Response:
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "uri": "otpauth://totp/App:user@example.com?secret=JBSWY3...&issuer=App&algorithm=SHA1&digits=6&period=30"
}
```

**QR Code generate गर्न** (frontend):
```js
import QRCode from 'qrcode';  // npm install qrcode
const qrUrl = await QRCode.toDataURL(response.uri);
// <img src={qrUrl} /> — Google Authenticator मा scan गर्नुहोस्
```

### १०.२ Verify र Activate गर्ने

```bash
POST /api/auth/2fa/verify
Authorization: Bearer TOKEN
{ "totp": "123456" }    # Google Authenticator बाट 6-digit code

# Response:
{
  "success": true,
  "recoveryCodes": [
    "AB12-CD34",
    "EF56-GH78",
    ...8 codes
  ]
}
```

> ⚠️ **Recovery codes** सुरक्षित ठाउँमा राख्नुहोस्! Phone हराएमा यही प्रयोग हुन्छ।

### १०.३ 2FA सहित Login

```bash
POST /api/auth/login
{
  "email": "ram@example.com",
  "password": "Secure123",
  "totp": "654321"     # Google Authenticator को current code
}

# Phone छैन? Recovery code प्रयोग गर्ने:
{
  "email": "ram@example.com",
  "password": "Secure123",
  "recovery": "AB12-CD34"   # recovery code (एकपल्ट मात्र काम गर्छ)
}
```

### १०.४ Disable गर्ने

```bash
POST /api/auth/2fa/disable
Authorization: Bearer TOKEN
{ "totp": "123456" }
```

---

## ११. Password Reset

### ११.१ Forgot Password

```bash
POST /api/auth/forgot-password
{ "email": "ram@example.com" }

# Response (Development मा resetLink देखिन्छ):
{
  "success": true,
  "message": "If email exists, reset link sent",
  "resetLink": "http://localhost:3000/reset-password?token=abc123..."
}
```

**Email पठाउन** (production):
```js
// app.js मा forgotPassword route customize गर्ने
import nodemailer from 'nodemailer';  // npm install nodemailer

app.post('/api/auth/forgot-password', async (ctx) => {
  const result = await auth.forgotPassword(ctx);
  
  if (result.success && result.resetLink) {
    // Email पठाउने
    await sendResetEmail(ctx.body.email, result.resetLink);
  }
  
  // resetLink response मा नपठाउने (security)
  return { success: true, message: 'If email exists, reset link sent' };
});
```

### ११.२ Reset Password

```bash
POST /api/auth/reset-password
{
  "token": "abc123...",        # Email मा आएको token
  "newPassword": "NewPass456"  # नयाँ password (8+ chars, uppercase, lowercase, number)
}

# Success:
{ "success": true, "message": "Password reset successfully" }
```

---

## १२. AI Features

### १२.१ Setup — API Key

कुनै एउटा मात्र चाहिन्छ। `.env` मा राख्नुहोस्:

```env
# ── Cloud AI (कुनै एउटा) ─────────────────────────────
GEMINI_API_KEY=your_gemini_api_key      # Google Gemini (recommended, free tier छ)
GROQ_API_KEY=your_groq_api_key          # Groq — Llama 3 (ultra fast, free tier)
OPENAI_API_KEY=your_openai_api_key      # OpenAI GPT-4

# Universal alias (माथिका जुनसुकैलाई)
DOLPHIN_AI_KEY=your_any_api_key_here

# ── Advanced (optional) ──────────────────────────────
DOLPHIN_AI_BASE_URL=https://custom-endpoint.com/v1   # Custom OpenAI-compatible endpoint
DOLPHIN_AI_MODEL=gemini-2.0-flash                    # Model override

# ── Local AI (Free, Offline) ─────────────────────────
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest
```

> **Priority:** `DOLPHIN_AI_KEY` → `GEMINI_API_KEY` → `GROQ_API_KEY` → `OPENAI_API_KEY` → Ollama

---

### १२.२ `dolphin generate` — Single File Generation

AI ले एउटा JavaScript file बनाउँछ — `ai-generated.js` मा save हुन्छ।

```bash
# Middleware generate
npx dolphin generate "Create a request logger middleware that logs method, url, status and response time"

# Service generate
npx dolphin generate "Create an email service using nodemailer with sendMail and sendResetLink functions"

# Mongoose aggregation
npx dolphin generate "MongoDB aggregation pipeline for monthly sales report grouped by category"

# Helper function
npx dolphin generate "Nepali date converter - AD to BS and BS to AD"
```

**Output:** `ai-generated.js` current directory मा बन्छ।

> ⚠️ दोस्रो पल्ट run गर्दा **overwrite** हुन्छ। Important file भए rename गर्नुहोस्।

---

### १२.३ `dolphin generate-full` — Full Project Architecture

AI ले **multiple files** एकैपटक बनाउँछ — models, routes, controllers, adapters सबै।

```bash
npx dolphin generate-full "E-commerce backend with products, categories, orders, cart, and payment status tracking"
```

**AI ले बनाउन सक्ने files:**
```
models/Product.js
models/Order.js
models/Category.js
routes/products.js
routes/orders.js
controllers/orderController.js
adapters/db.js        (⚠ .env छ भने skip गर्छ)
app.js
```

**अर्को example:**
```bash
npx dolphin generate-full "School management system with students, teachers, classes, and attendance"

npx dolphin generate-full "Hospital appointment booking API with doctors, patients, and time slots"

npx dolphin generate-full "Blog platform with posts, comments, tags, and user profiles"
```

> **Tip:** Prompt जति specific भयो, output उति राम्रो हुन्छ। Model names, fields, relationships mention गर्नुहोस्।

---

### १२.४ `dolphin chat` — AI Agent (Cursor Mode)

यो सबैभन्दा शक्तिशाली feature हो। AI agent ले तपाईँको project **हेर्न**, **code लेख्न**, **patch गर्न**, र **command run गर्न** सक्छ।

```bash
npx dolphin chat
# 🐬 Dolphin Agent Ready!
# > _
```

**Agent ले गर्न सक्ने काम:**

| Action | Example Prompt |
|--------|----------------|
| File पढ्ने | `"app.js मा के छ?"` |
| File लेख्ने / update गर्ने | `"models/Product.js मा stock field थप"` |
| Code patch गर्ने | `"auth.js को login function मा lastLoginAt update गर"` |
| Files list गर्ने | `"models/ folder मा के-के छ?"` |
| Command run गर्ने | `"npm install zod run gar"` |
| Code search गर्ने | `"app.js मा CORS कहाँ छ?"` |

**Real examples:**

```
> Product model मा rating (1-5) र reviewCount field थप र mongoose validation लगाऊ

> app.js मा /api/products route छ? नभए थपिदेऊ

> adapters/db.js मा Order model register गरिदेऊ

> Register endpoint मा name field पनि accept गर र User model मा save गर

> createCrudRouter ले pagination support गर्छ? देखाऊ
```

**Roman Nepali पनि बुझ्छ:**
```
> Product model ma price validation thap - minimum 0 hunu parcha
> app.js ma rate limiting middleware thap
> User model ko email field ko index herna
```

**History हेर्ने:**
```
> /history      ← पछिल्ला conversations हेर्ने
> /clear        ← history clear गर्ने
> /exit         ← chat बाट बाहिर
```

---

### १२.५ `dolphin chat` — Agent Permissions

Agent ले file modify गर्न **confirm माग्न सक्छ**:

```
🔧 Code lekhdai/update gardai: models/Product.js
  Confirm? (y/n): y
  📝 Wrote to models/Product.js ✅

⚠️ Khataranak Command: rm -rf node_modules
  Confirm? (y/n): n
  🚫 Action denied.
```

> Agent ले dangerous commands (`rm -rf`, `format`, `drop`) run गर्न confirm गर्छ।

---

### १२.६ Local AI (Ollama — Free, Offline)

Cloud API key नभई पनि आफ्नो machine मा AI run गर्न:

```bash
# Step 1: Ollama install
# macOS:   brew install ollama
# Linux:   curl -fsSL https://ollama.ai/install.sh | sh

# Step 2: Model download (एकपल्ट मात्र)
ollama pull gemma3:latest      # Google Gemma3 (recommended, ~5GB)
ollama pull llama3.2:latest    # Meta Llama 3.2 (~2GB, faster)
ollama pull codellama:latest   # Code-focused model

# Step 3: Ollama server start
ollama serve

# Step 4: .env मा set गर्ने
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest

# Step 5: Use गर्ने
npx dolphin chat           # Local AI — internet नचाहिने!
npx dolphin generate "..."  # Local AI generate
```

**Ollama vs Cloud:**

| Feature | Ollama (Local) | Cloud (Gemini/Groq) |
|---------|----------------|---------------------|
| Cost | Free | Free tier / Paid |
| Speed | Machine depend | Fast |
| Privacy | 100% local | Cloud मा जान्छ |
| Internet | Not needed | Required |
| Quality | Good | Better |

---

## १३. Production Deployment

### १३.१ Environment Variables (Production)

```env
# .env.production — Secure values!
NODE_ENV=production
PORT=3000

# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster0.mongodb.net/mydb?retryWrites=true

# Strong random keys (minimum 32 characters)
JWT_SECRET=qwertyuiopasdfghjklzxcvbnm1234567890abcd
ENCRYPTION_KEY=another_different_secret_key_for_2fa_data

# Optional
REDIS_URL=redis://localhost:6379
APP_URL=https://myapp.com
FRONTEND_URL=https://myfrontend.com

# Client SDK Generator — generate-client command को लागि secret key
DOLPHIN_GENERATE_KEY=your_secret_key
```

> **`DOLPHIN_GENERATE_KEY`**: यो key बिना `/dolphin-client.js` endpoint `403 Forbidden` फर्काउँछ। सधैं गोप्य राख्नुहोस् र `npx dolphin generate-client --key=` मा pass गर्नुहोस्।

**⚠️ `.env` file `.gitignore` मा राख्नुहोस्:**
```
node_modules/
.env
.env.*
dist/
*.log
```

### १३.२ PM2 सँग Deploy

```bash
# PM2 install
npm install -g pm2

# Single instance
pm2 start app.js --name "dolphin-app" --env production

# Cluster mode (multiple CPU cores)
pm2 start app.js --name "dolphin-app" -i max --env production

# Auto-restart on reboot
pm2 startup
pm2 save

# Useful commands
pm2 status         # Status हेर्ने
pm2 logs dolphin-app  # Logs हेर्ने
pm2 restart dolphin-app  # Restart गर्ने
pm2 stop dolphin-app     # Stop गर्ने
```

### १३.३ Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/myapp
server {
    listen 80;
    server_name myapp.com www.myapp.com;
    
    # HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name myapp.com www.myapp.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
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

### १३.४ Production Checklist

- ✅ `NODE_ENV=production`
- ✅ `JWT_SECRET` minimum 32 random characters
- ✅ `ENCRYPTION_KEY` set गरेको (2FA को लागि)
- ✅ `DOLPHIN_GENERATE_KEY` सेट गरिएको छ (SDK generator सुरक्षित)
- ✅ `.env` file `.gitignore` मा छ
- ✅ `secureCookies: true` (HTTPS मा deploy भएको)
- ✅ MongoDB Atlas (वा secure MongoDB setup)
- ✅ Redis (optional — rate limiting scale को लागि)
- ✅ Nginx वा reverse proxy
- ✅ SSL certificate (Let's Encrypt — free)
- ✅ PM2 cluster mode

---

## १४. Common Bugs र Solutions

### ❌ Bug #1: Double User — duplicate users बन्छ

**Problem:** `adapters/db.js` मा `User` दुई पल्ट register गरिएको:
```js
// ❌ WRONG — यसरी गर्नु हुन्न!
export const db = createMongooseAdapter({
  User,        // ← यहाँ छ
  RefreshToken,
  models: {
    User,      // ← यहाँ पनि छ — DOUBLE REGISTRATION!
  },
});
```

**Effect:** CRUD बाट `db.create('User', ...)` call हुँदा `auth.register()` को email normalization र duplicate check bypass हुन्छ। Duplicate email भएका users बन्न सक्छन्।

**Fix:**
```js
// ✅ CORRECT — User models: {} भित्र थप्नु हुन्न
export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    // User र RefreshToken यहाँ नभएको सही हो
    Product,   // ← अरू CRUD models मात्र
    Order,
  },
});
```

---

### ❌ Bug #2: Middleware काम गर्दैन (401/403 crash)

**Problem (v2.14.1 अगाडि):** Auth middleware ले `ctx.req, ctx.res, next` pass गर्थ्यो, तर Dolphin server मा `res.status()` छैन — crash हुन्थ्यो।

**Fix:** `npm update dolphin-server-modules` गर्नुहोस् — v2.14.1 मा fixed छ।

---

### ❌ Bug #3: Cookie काम गर्दैन (Development)

**Problem:** `secureCookies: true` set गरिएको, तर HTTP (non-HTTPS) मा test गरिरहेको।

**Fix:**
```js
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production',  // ← यसरी राख्नुहोस्
});
```

---

### ❌ Bug #4: `require is not defined` — ESM Error

**Problem:** `require()` use गरिएको।

**Fix:** `package.json` मा `"type": "module"` थप्नुहोस् र `import` मात्र use गर्नुहोस्:
```js
// ❌ WRONG
const { createDolphinServer } = require('dolphin-server-modules/server');

// ✅ CORRECT
import { createDolphinServer } from 'dolphin-server-modules/server';
```

---

### ❌ Bug #5: MongoDB connect हुँदैन

**Problem:** MongoDB running छैन वा URI गलत छ।

**Fix:**
```bash
# MongoDB status check
sudo systemctl status mongod      # Linux
brew services list | grep mongo  # macOS

# Start गर्ने
sudo systemctl start mongod      # Linux
brew services start mongodb-community  # macOS

# Connection test
npx dolphin connect mongoose mongodb://localhost:27017

# URI format check (Atlas):
# mongodb+srv://username:password@cluster.mongodb.net/dbname
```

---

### ❌ Bug #6: Rate Limit — 429 Error

**Problem:** धेरै पल्ट login attempt गरेर rate limit hit भयो।

**Fix:** 15 मिनेट पर्खनुहोस् वा Redis use गर्नुहोस्:
```js
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  rateLimit: { 
    max: 10,           // 10 attempts allowed (default: 5)
    window: 900_000    // 15 minutes
  },
  redisClient: redisClient,  // Redis ले per-server limit manage गर्छ
});
```

---

## १५. सम्पूर्ण Example Project

एउटा complete blog API बनाउने:

```bash
# Setup
mkdir my-blog-api && cd my-blog-api
npm init -y

# package.json मा "type": "module" थप्नुहोस्

npm install dolphin-server-modules mongoose

# Project scaffold
npx dolphin init

# Blog post CRUD थप्ने
npx dolphin add crud Post

# Status check
npx dolphin status
```

**Generated `app.js` edit गर्नुहोस्:**
```js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { createCrudRouter } from 'dolphin-server-modules/crud';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

const app = createDolphinServer();

// Error handler
app.use(async (ctx, next) => {
  try { if (next) await next(); }
  catch (error) {
    ctx.status(error.status || 500).json({ success: false, message: error.message });
  }
});

// DB connect
connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/blog_db');

// Auth
const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET || 'blog-secret-change-me-32chars!!',
  secureCookies: process.env.NODE_ENV === 'production',
});

// Auth routes
app.post('/api/auth/register', auth.register);
app.post('/api/auth/login',    auth.login);
app.post('/api/auth/refresh',  auth.refresh);
app.post('/api/auth/logout',   auth.requireAuth, auth.logout);
app.get('/api/auth/me',        auth.requireAuth, auth.me);

// Blog Post CRUD (login चाहिन्छ)
app.use('/api/posts', auth.requireAuth, createCrudRouter(db, 'Post', {
  softDelete: true,        // Delete गर्दा database बाट हट्दैन
  enforceOwnership: true,  // आफ्नै posts मात्र edit/delete
}));

app.get('/health', (ctx) => ({ status: 'ok', version: '1.0.0' }));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`🐬 Blog API port ${PORT} मा चलिरहेको छ!`));
```

**Test गर्नुहोस्:**
```bash
node app.js

# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"blogger@example.com","password":"Blog1234"}'

# Login र token लिने
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"blogger@example.com","password":"Blog1234"}'
# accessToken copy गर्नुहोस्

# Blog post create
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"title":"मेरो पहिलो Blog","description":"Dolphin Framework भनेको..."}'

# सबै posts हेर्ने
curl http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## थप Resources

| Resource | Link |
|----------|------|
| README | [README.md](./README.md) |
| English Tutorial | [TUTORIAL.md](./TUTORIAL.md) |
| Realtime Deep Dive | [RT_TUTORIAL_NEPALI.md](./RT_TUTORIAL_NEPALI.md) |
| AI Agent Guide | [AI_TUTORIAL_NEPALI.md](./AI_TUTORIAL_NEPALI.md) |
| Client Tutorial | [CLIENT_TUTORIAL_NEPALI.md](./CLIENT_TUTORIAL_NEPALI.md) |
| Master Guide | [DOLPHIN_MASTER_GUIDE_NEPALI.md](./DOLPHIN_MASTER_GUIDE_NEPALI.md) |
| NPM Package | [npmjs.com/package/dolphin-server-modules](https://www.npmjs.com/package/dolphin-server-modules) |
| GitHub Issues | [github.com/Phuyalshankar/dolphin-server-modules/issues](https://github.com/Phuyalshankar/dolphin-server-modules/issues) |

---

**Happy Coding! 🇳🇵🐬**  
*Dolphin Server Modules v2.14.1 — Nepali Developers को लागि, Nepali Developers द्वारा।*
