# Dolphin Framework Tutorial 🐬

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using our native, high-performance modules.

---

## 1. Project Setup
Create a new directory and initialize your project:
```bash
mkdir my-dolphin-app && cd my-dolphin-app
npm init -y
npm install dolphin-server-modules mongoose zod
```

---

## 2. Database Setup (Mongoose)
Define your models using Mongoose:
```typescript
// models.ts
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

export const User = mongoose.model('User', UserSchema);
```

---

## 3. Initialize Dolphin
Create your main entry point and connect the components:
```typescript
// index.ts
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createAuth } from 'dolphin-server-modules/auth';
import { User } from './models';

// 1. Setup Adapter
const db = createMongooseAdapter({ User });

// 2. Setup Auth
const auth = createAuth({ secret: 'SUPER_SECRET' });

// 3. Setup Server
const app = createDolphinServer();
```

---

## 4. Routing with Context (ctx)
Dolphin uses a unified `ctx` object for ultra-clean handlers.

```typescript
// Simple Route (v1.4.7: Now supports Auto-JSON by returning objects!)
app.get('/', (ctx) => {
  return { message: "Welcome to Dolphin!" };
});

// Dynamic Route with Params
app.get('/users/:id', (ctx) => {
  const { id } = ctx.params;
  ctx.json({ userId: id });
});

// Post Request with Body
app.post('/echo', (ctx) => {
  ctx.json({ youSent: ctx.body });
});
```

---

## 5. Adding Authentication Middleware
Secure your routes with the `auth` module:

```typescript
// Protecting a route (v1.4.7: Chained Multi-Handler support!)
app.get('/profile', auth.requireAuth, async (ctx) => {
  // ctx.req.user is automatically populated
  return { user: ctx.req.user };
});
```

---

## 6. Global Middleware (Universal Support)
Dolphin is unique because it supports both native Context-based and standard Express-based middlewares.

```typescript
// 1. Dolphin Context Style
app.use((ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  next();
});

// 2. Standard Express Style (CORS, Helmet, etc.)
import cors from 'cors';
app.use(cors()); // No wrapper needed!
```

---

## 7. Starting the Server
```typescript
app.listen(3000, () => {
  console.log("Dolphin is swimming on http://localhost:3000 🐬");
});
```

---

## 8. Realtime & IoT Integration [NEW]
Dolphin now supports high-performance realtime communication:

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

## 9. Independent Routing [NEW]
Organize your application by separating routes into different files:

```typescript
// authRoutes.ts
import { createDolphinRouter } from 'dolphin-server-modules/router';
export const authRouter = createDolphinRouter();

authRouter.get('/login', (ctx) => ctx.json({ msg: 'Logged in' }));

// index.ts
import { authRouter } from './authRoutes';
app.use('/auth', authRouter); // Routes are now at /auth/login
```

---

## 🚀 Performance Tips
- Use **Context (ctx)** directly for JSON responses.
- Keep your routes organized using prefixing (coming in v1.1.0).
- Use the **Zod Middleware** for automatic type-safe validation.

Happy Coding!
