# Dolphin Server Modules 🐬

A world-class, extremely lightweight, and 100% modular backend utility package for Node.js. It provides plug-and-play modules for Authentication, standard CRUD operations, Next.js/Express Controllers, and Zod validation. 

Build production-grade APIs in minutes!

## 📦 Installation

```bash
npm install dolphin-server-modules
```

You will also need to install `argon2` and `zod` if you are using the auth and validation modules respectively:
```bash
npm install argon2 zod
```

## 🚀 100% Modular Structure
You can import exactly what you need without bloating your project.

```typescript
import { createAuth } from 'dolphin-server-modules/auth';
import { createCRUD } from 'dolphin-server-modules/crud';
import { createDolphinController } from 'dolphin-server-modules/controller';
import { validateStructure } from 'dolphin-server-modules/middleware/zod';
```

---

## 🔒 1. Auth Module (`/auth`)
Production-ready authentication supporting **argon2 password hashing**, **JWT**, and **TOTP (2FA)**. It also ships with internal memory LRU caches for protecting against token-reuse and rate-limiting.

```typescript
import { createAuth } from 'dolphin-server-modules/auth';

const auth = createAuth({ 
  secret: 'YOUR_SUPER_SECRET_KEY', 
  cookieMaxAge: 7 * 86400000 // 7 days
});

// Register
const user = await auth.register(db, { email: 'user@example.com', password: 'password123' });

// Login (Supports 2FA Totp)
const session = await auth.login(db, { email: 'user@example.com', password: 'password123' });
console.log(session.accessToken);
```

---

## 💾 2. CRUD Module (`/crud`)
A powerful Factory interface for databases providing instant pagination, soft-deletes, and ownership-checks out of the box.

```typescript
import { createCRUD } from 'dolphin-server-modules/crud';

const crud = createCRUD(myDatabaseAdapter, { 
    softDelete: true, 
    enforceOwnership: true 
});

// Automatically creates a record with generated IDs and createdAt fields
const newPost = await crud.create('posts', { title: 'Hello World' }, 'user_id_1');

// Read with Advanced Filtering
const posts = await crud.read('posts', { 
    $or: [{ title: { $like: 'Hello' } }, { rating: { $gt: 4 } }] 
});

// Soft Delete
await crud.deleteOne('posts', newPost.id, 'user_id_1');

// Restore Soft Deleted
await crud.restore('posts', newPost.id, 'user_id_1');
```

---

## 🎮 3. Controller Module (`/controller`)
Easily convert your `crud` instance into instant API Controllers. Supports Next.js App Router, Pages API, and Express out of the box.

```typescript
import { createDolphinController, createNextAppRoute } from 'dolphin-server-modules/controller';

const postController = createDolphinController(crud, 'posts');

// Next.js App Router API Route (app/api/posts/route.ts)
export const { GET, POST, PUT, DELETE } = createNextAppRoute(postController);
```

---

## ✅ 4. Zod Validation Middleware (`/middleware/zod`)
Validate your data effortlessly using `zod`. Protect your endpoints from bad data.

```typescript
import { z } from 'zod';
import { validateAppRoute } from 'dolphin-server-modules/middleware/zod';

const userSchema = z.object({
  name: z.string().min(2),
  age: z.number().gte(18)
});

// App Router Handler wrapped with validation
const myPostHandler = validateAppRoute(userSchema, async (req, validatedData) => {
    console.log(validatedData.name); // 100% typed and safe
    return new Response('Success');
});
```

---

## 🌐 Hosting Docs via GitHub Pages
To host this documentation cleanly:
1. Go to your repository **Settings** on GitHub.
2. Click on **Pages** on the left sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select `main` branch and `/ (root)` folder.
5. Click **Save**. GitHub will automatically host this README as your documentation website!
