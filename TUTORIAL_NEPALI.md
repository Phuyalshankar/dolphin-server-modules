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
8. [Realtime WebSocket](#८-realtime-websocket)
9. [Middleware](#९-middleware)
10. [2FA (Two-Factor Authentication)](#१०-2fa)
11. [Password Reset](#११-password-reset)
12. [AI Features (CLI)](#१२-ai-features)
13. [Production Deployment](#१३-production-deployment)
14. [Common Bugs र Solutions](#१४-common-bugs-र-solutions)
15. [सम्पूर्ण Example Project](#१५-सम्पूर्ण-example-project)

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

### ४.५ Version र Help

```bash
npx dolphin --version    # 🐬 Dolphin CLI v2.14.1
npx dolphin help         # सबै commands को list
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

## ८. Realtime WebSocket

### ८.१ Server Setup

```js
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createRealtimeCore } from 'dolphin-server-modules/realtime';

const rt = createRealtimeCore({
  debug: false,               // true भए logs देखिन्छ
  maxMessageSize: 256 * 1024, // 256KB max per message
  // redisUrl: process.env.REDIS_URL,  // Multiple servers को लागि Redis
});

const app = createDolphinServer({ 
  realtime: rt,
  allowedWebSocketPaths: ['/realtime'],  // WebSocket accept गर्ने paths
});

// Server बाट publish गर्ने
setTimeout(() => {
  rt.publish('system/status', { 
    online: true, 
    users: 42,
    ts: Date.now() 
  }, { retain: true });  // retain: true — नयाँ subscriber ले immediately पाउँछ
}, 1000);

// Server मा subscribe गर्ने
rt.subscribe('chat/#', (data, topic) => {
  console.log(`Message on ${topic}:`, data);
  
  // Broadcast to all — सबैलाई पठाउने
  rt.publish('chat/broadcast', { 
    from: 'server',
    ...data 
  });
});

app.listen(3000);
```

### ८.२ Client (Browser)

```html
<!DOCTYPE html>
<html>
<body>
<script>
  // WebSocket connect
  const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=my-browser-001');
  
  ws.onopen = () => {
    console.log('Connected!');
    
    // Subscribe गर्ने (messages receive गर्न)
    ws.send(JSON.stringify({ 
      type: 'sub', 
      topic: 'chat/room1' 
    }));
    
    // Publish गर्ने (message पठाउन)
    ws.send(JSON.stringify({ 
      type: 'pub', 
      topic: 'chat/room1',
      payload: { 
        message: 'नमस्ते सबैलाई!',
        from: 'Ram' 
      }
    }));
  };
  
  ws.onmessage = (event) => {
    const { topic, payload } = JSON.parse(event.data);
    console.log(`[${topic}]`, payload);
    // Topic: chat/room1, Payload: { message: 'नमस्ते', from: 'Ram' }
  };
  
  ws.onclose = () => console.log('Disconnected');
  ws.onerror = (err) => console.error('WebSocket error:', err);
</script>
</body>
</html>
```

### ८.३ Topic Wildcards

```js
// Exact match
rt.subscribe('chat/room1', fn);          // 'chat/room1' मात्र

// Single level wildcard (+)
rt.subscribe('chat/+', fn);              // 'chat/room1', 'chat/room2' — एक level
rt.subscribe('user/+/update', fn);       // 'user/abc/update', 'user/xyz/update'

// Multi-level wildcard (#)
rt.subscribe('chat/#', fn);              // 'chat/room1', 'chat/room1/messages' सबै
rt.subscribe('logs/#', fn);              // 'logs/error', 'logs/info/detail' सबै
```

### ८.४ High-Frequency Data (IoT)

```js
// IoT sensors, live graphs को लागि — Ultra fast
rt.pubPush('sensors/temperature', Buffer.from([22, 45, 78]));  // Binary
rt.pubPush('sensors/humidity', { value: 65.3, ts: Date.now() });

// Client ले माग्दा डाटा दिने
rt.subPull('device-001', 'sensors/temperature', 10);  // पछिल्लो 10 readings
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

### १२.१ Setup

**.env मा API key राख्नुहोस्:**
```env
# कुनै एउटा मात्र चाहिन्छ:
GEMINI_API_KEY=your_gemini_api_key      # Google Gemini (recommended)
GROQ_API_KEY=your_groq_api_key          # Groq (Llama 3 — fast)
OPENAI_API_KEY=your_openai_api_key      # OpenAI GPT
DOLPHIN_AI_KEY=any_of_the_above        # Custom name पनि काम गर्छ
```

### १२.२ Quick Code Generation

```bash
# Single file generate गर्ने
npx dolphin generate "Create a middleware that logs all requests with timestamps and user info"
# ai-generated.js बन्छ

npx dolphin generate "Build a rate limiting middleware for Express"
npx dolphin generate "Create a MongoDB aggregation pipeline for monthly sales report"
```

### १२.३ Full Project Generate गर्ने

```bash
# पूर्ण project structure generate
npx dolphin generate-full "E-commerce backend with products, categories, orders, and payment status"
# Multiple files बन्छन् — models, routes, controllers सबै
```

### १२.४ AI Chat (Cursor Mode)

```bash
npx dolphin chat
# 🐬 Dolphin Agent Ready!
# > 
```

Chat examples:
```
> Add a Product model with name, price, stock, and category fields
> Create auth middleware that checks if user is verified
> Show me how to add pagination to the products route
> Generate an order controller with status updates
```

### १२.५ Local AI (Ollama — Free, Offline)

```bash
# Ollama install (https://ollama.ai)
ollama pull gemma3:latest    # Model download
ollama serve                 # Server start
```

**.env मा:**
```env
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest
```

```bash
npx dolphin chat   # अब local Ollama प्रयोग गर्छ — free!
```

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
```

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
| Master Guide | [DOLPHIN_MASTER_GUIDE_NEPALI.md](./DOLPHIN_MASTER_GUIDE_NEPALI.md) |
| Client Tutorial | [CLIENT_TUTORIAL_NEPALI.md](./CLIENT_TUTORIAL_NEPALI.md) |
| NPM Package | [npmjs.com/package/dolphin-server-modules](https://www.npmjs.com/package/dolphin-server-modules) |
| GitHub Issues | [github.com/Phuyalshankar/dolphin-server-modules/issues](https://github.com/Phuyalshankar/dolphin-server-modules/issues) |

---

**Happy Coding! 🇳🇵🐬**  
*Dolphin Server Modules — Nepali Developers को लागि, Nepali Developers द्वारा।*
