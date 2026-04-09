# Dolphin Framework Tutorial 🐬 (v2.0.0)

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using native, high-performance modules.

---

## 1. Project Setup
```bash
mkdir my-dolphin-app && cd my-dolphin-app
npm init -y
npm install dolphin-server-modules mongoose zod
```

If using TypeScript:
```bash
npm install -D typescript ts-node @types/node
```

---

## 2. Database Setup (Mongoose)

```typescript
// models.ts
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const RefreshTokenSchema = new mongoose.Schema({
  token:  String,
  userId: String,
});

const ProductSchema = new mongoose.Schema({
  name:      String,
  price:     Number,
  category:  String,
});

export const User         = mongoose.model('User', UserSchema);
export const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);
export const Product      = mongoose.model('Product', ProductSchema);
```

---

## 3. Initialize Dolphin Server

```typescript
// index.ts
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/crud';
import { User, RefreshToken, Product } from './models';

const app = createDolphinServer();

// Create Mongoose adapter
const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: { Product }
});

// Create CRUD service
const crud = createCRUD(db, { enforceOwnership: false });
```

---

## 4. Basic CRUD Routes

```typescript
// GET all products
app.get('/products', async (ctx) => {
  const results = await crud.read('Product');
  ctx.json(results);
});

// POST create product
app.post('/products', async (ctx) => {
  const result = await crud.create('Product', ctx.body);
  ctx.status(201).json(result);
});
```

---

## 5. Authentication

```typescript
import { createAuth } from 'dolphin-server-modules/auth';

const auth = createAuth({ secret: 'SUPER_SECRET' });

// Secure a route
app.get('/profile', auth.requireAuth, async (ctx) => {
  return { user: ctx.req.user };
});
```

---

## 6. Realtime & IoT Integration

```typescript
import { RealtimeCore, JSONPlugin } from 'dolphin-server-modules/realtime';

const rt = new RealtimeCore();
rt.use(JSONPlugin);

// Subscribe to topics
rt.subscribe('sensors/temp', (ctx) => {
  console.log(`Temperature:`, ctx.payload.value);
});

// Publish
rt.publish('sensors/temp', { value: 24.5 });
```

---

## 7. Universal Signaling (WebRTC & IoT)

```typescript
import { createSignaling } from 'dolphin-server-modules/signaling';

const signaling = createSignaling(rt);

// IoT / Medical Command
await signaling.sendCommand('DoctorApp', 'ECG_Monitor', { action: 'START' });
```

---

## 8. Dolphin Client Library (Full-stack) [NEW]

Dolphin now serves its own lightweight, zero-dependency client library directly from the server.

### Load the Library
Include this in your HTML file:
```html
<script src="/dolphin-client.js"></script>
```

### Usage (API, Auth & Realtime)
```javascript
// The 'dolphin' object is auto-initialized globally
async function startApp() {
  // 1. Auth: Seamless Login
  await dolphin.auth.login("admin@test.com", "password123");

  // 2. API: Automatic Token Handling
  const data = await dolphin.api.get('/products');
  console.log("Products:", data);

  // 3. Realtime: Mirroring & Signaling
  await dolphin.connect();
  
  // High-frequency "Sensor" Push
  dolphin.pubPush('iot/heartrate', { bpm: 72 });

  // Demand-based history Pull
  dolphin.subscribe('pull:response/logs', (batch) => {
      console.log("Buffered logs received:", batch);
  });
  dolphin.subPull('logs', 20); // Get last 20 logs

  // Managed File Download (v2.0)
  dolphin.subscribe('file:chunk/report', (chunk) => {
      console.log(`Progress: ${chunk.chunkIndex}/${chunk.totalChunks}`);
  });
  dolphin.subFile('report');
}
```

---

## 9. Conclusion

Dolphin Framework is built for speed, modularity, and ease of use. Whether you are building a simple API or a complex real-time signaling system, Dolphin has the tools you need.

Happy Coding! 🐬
