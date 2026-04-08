# Dolphin Framework Tutorial 🐬 (v1.5.6)

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using native, high-performance modules.

---

## 1. Project Setup
```bash
mkdir my-dolphin-app && cd my-dolphin-app
npm init -y
npm install dolphin-server-modules mongoose zod
```

TypeScript प्रयोग गर्दा:
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
  createdAt: String,
  updatedAt: String,
});

export const User         = mongoose.model('User', UserSchema);
export const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);
export const Product      = mongoose.model('Product', ProductSchema);
```

---

## 3. Initialize Dolphin + Mongoose Adapter

```typescript
// index.ts
import mongoose from 'mongoose';
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/crud';
import { User, RefreshToken, Product } from './models';

// 1. Connect MongoDB
await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mydb');

// 2. Create Mongoose adapter
const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: { Product },   // custom collections थप्नुहोस्
  leanByDefault: true,
  softDelete: false,
});

// 3. Create CRUD service
// ⚠️ Public API: enforceOwnership: false (auth middleware नचाहिने)
// ⚠️ Protected API: enforceOwnership: true (auth middleware चाहिने)
const crud = createCRUD(db, { enforceOwnership: false });

// 4. Create server
const app = createDolphinServer();
```

---

## 4. CRUD Routes — Correct Mapping

```typescript
// GET all products
app.get('/products', async (ctx) => {
  const { limit, offset, ...filters } = ctx.query;
  const results = await crud.read('Product', filters, {
    limit:  limit  ? parseInt(limit)  : undefined,
    offset: offset ? parseInt(offset) : undefined,
  });
  ctx.json(results);
});

// GET single product by ID
app.get('/products/:id', async (ctx) => {
  const result = await crud.readOne('Product', ctx.params.id);
  if (!result) return ctx.status(404).json({ error: 'Not Found' });
  ctx.json(result);
});

// POST create product
app.post('/products', async (ctx) => {
  const result = await crud.create('Product', ctx.body);
  ctx.status(201).json(result);
});

// PUT update product by ID
app.put('/products/:id', async (ctx) => {
  const result = await crud.updateOne('Product', ctx.params.id, ctx.body);
  if (!result) return ctx.status(404).json({ error: 'Not Found' });
  ctx.json(result);
});

// DELETE product by ID
app.delete('/products/:id', async (ctx) => {
  const result = await crud.deleteOne('Product', ctx.params.id);
  if (!result) return ctx.status(404).json({ error: 'Not Found' });
  ctx.json({ success: true, deleted: result });
});
```

---

## 5. Authentication Middleware

```typescript
import { createAuth } from 'dolphin-server-modules/auth';

const auth = createAuth({ secret: process.env.JWT_SECRET || 'SUPER_SECRET' });

// Protected route — auth middleware पहिले लगाउनुहोस्
app.get('/profile', auth.requireAuth, async (ctx) => {
  return { user: ctx.req.user }; // ctx.req.user automatically set हुन्छ
});
```

`enforceOwnership: true` सँग प्रयोग गर्दा:
```typescript
const protectedCrud = createCRUD(db, { enforceOwnership: true });

// Auth middleware ले ctx.req.user.id set गर्नुपर्छ — नत्र सबै खाली फर्काउँछ
app.get('/my-orders', auth.requireAuth, async (ctx) => {
  const orders = await protectedCrud.read('Order', {}, {}, ctx.req.user.id);
  ctx.json(orders);
});
```

---

## 6. Global Middleware

```typescript
// Dolphin Context Style
app.use((ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  next();
});

// Standard Express Style (cors, helmet, etc.)
import cors from 'cors';
app.use(cors()); // Express middleware directly काम गर्छ!
```

---

## 7. Zod Validation Middleware

```typescript
import { zodMiddleware } from 'dolphin-server-modules/middleware/zod';
import { z } from 'zod';

const ProductSchema = z.object({
  name:  z.string().min(1),
  price: z.number().positive(),
});

app.post('/products', zodMiddleware(ProductSchema), async (ctx) => {
  // ctx.body is now validated and typed
  const result = await crud.create('Product', ctx.body);
  ctx.status(201).json(result);
});
```

---

## 8. Sub-Routing (Large Apps)

```typescript
import { createDolphinRouter } from 'dolphin-server-modules/router';

// authRoutes.ts
const authRouter = createDolphinRouter();
authRouter.post('/login',    (ctx) => ctx.json({ msg: 'Login OK' }));
authRouter.post('/register', (ctx) => ctx.json({ msg: 'Registered' }));

// productRoutes.ts
const productRouter = createDolphinRouter();
productRouter.get('/',    async (ctx) => ctx.json(await crud.read('Product')));
productRouter.post('/',   async (ctx) => ctx.status(201).json(await crud.create('Product', ctx.body)));

// index.ts — prefix सँग mount
app.use('/auth',     authRouter);
app.use('/products', productRouter);
// Routes: /auth/login, /auth/register, /products/, /products/ (POST)
```

---

## 9. Realtime & IoT Integration

```typescript
import { RealtimeCore, JSONPlugin } from 'dolphin-server-modules/realtime';

const rt = new RealtimeCore();
rt.use(JSONPlugin);

// Subscribe to topics
rt.subscribe('sensors/+', (ctx) => {
  console.log(`Topic: ${ctx.topic}, Data:`, ctx.payload);
});

// Publish
rt.publish('sensors/temp', { value: 24.5 });
```

---

## 10. Starting the Server

```typescript
const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), () => {
  console.log(`🐬 Dolphin swimming on http://0.0.0.0:${PORT}`);
});
```

---

## 11. Testing with Real Mongoose (v1.5.5)

Production-safe testing को लागि `mongodb-memory-server` प्रयोग गर्नुहोस्:

```bash
npm install -D mongodb-memory-server
```

```typescript
// product.test.ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/crud';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('product CRUD', async () => {
  const db   = createMongooseAdapter({ User, RefreshToken, models: { Product } });
  const crud = createCRUD(db, { enforceOwnership: false });

  const created = await crud.create('Product', { name: 'Laptop', price: 1200 });
  expect(created.id).toBeDefined();

  const found = await crud.readOne('Product', created.id);
  expect(found?.name).toBe('Laptop');
});
```

---

## ⚠️ Common Mistakes

| Mistake | Fix |
| :--- | :--- |
| CRUD returns empty without auth | `enforceOwnership: false` set गर्नुहोस् |
| `getOne` always returns first item | Adapter को `read()` ले query filter गर्नुपर्छ — Mongoose adapter ले automatically गर्छ |
| `{ new: true }` deprecation warning | Mongoose adapter v1.5.5 मा `{ returnDocument: 'after' }` मा fix भएको छ |

---

## 🚀 Performance Tips
- `ctx.json()` directly call गर्नुहोस् — auto-serialization built-in छ।
- Routes लाई sub-routers मा organize गर्नुहोस्।
- `leanByDefault: true` (default) — Mongoose queries faster हुन्छन्।
- Production मा `enforceOwnership: true` र proper auth middleware राख्नुहोस्।

---

## 12. Universal Signaling (WebRTC & IoT)

Dolphin v1.6.0 introduces a zero-dependency universal signaling module for WebRTC and IoT/Medical device control:

```typescript
import { createSignaling } from 'dolphin-server-modules/signaling';
import { RealtimeCore } from 'dolphin-server-modules/realtime';

const rt = new RealtimeCore();
const signaling = createSignaling(rt);

// 1. WebRTC Call
await signaling.invite('user1', 'user2', { sdp: 'offer_data' });

signaling.onSignalFor('user2', async (signal) => {
  if (signal.type === 'INVITE') {
    await signaling.accept('user2', signal.from, { sdp: 'answer_data' });
  }
});

// 2. IoT / Medical Command
await signaling.sendCommand('DoctorApp', 'ECG_Monitor', { action: 'START' });
```

Happy Coding! 🐬
