# Dolphin Framework Tutorial 🐬 (v2.2.5)

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using native, high-performance modules.

---

## 1. Project Setup

Dolphin v2.2.5 makes it easier than ever to start a project using the CLI.

```bash
# 1. Create directory
mkdir my-dolphin-app && cd my-dolphin-app

# 2. Initialize project (ESM by default)
npx dolphin init

# 3. For a structured production setup:
npx dolphin init-prod
```

This will automatically create `package.json` (with `"type": "module"`), `app.js`, and basic folders.

---

## 2. Basic Server (Hello World)

Using modern ESM syntax:

```javascript
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/', (ctx) => {
  return { message: "Welcome to the world of Dolphin! 🐬", version: "2.2.5" };
});

app.listen(3000, () => {
  console.log("Server swimming on http://localhost:3000");
});
```

---

## 3. Reactive Frontend Store [NEW v2.2.5]

Dolphin now provides a powerful reactive store in the client library that manages your data and tracking states automatically.

### Usage
```html
<script src="/dolphin-client.js"></script>
<script>
  async function init() {
    // 1. Get collection
    const products = dolphin.store.products;

    // 2. State Tracking (Reactive)
    if (products.loading) console.log("Fetching data...");
    
    // 3. Filtering & Sorting
    // Items are automatically re-sorted/filtered even on realtime updates
    products
        .where(p => p.price > 100)
        .orderBy('price', 'desc');

    // 4. Using data
    console.log(products.items);
  }
</script>
```

---

## 4. Offline Persistence [NEW v2.2.5]

Enable instant loading by caching your store data locally using the `DolphinPersist` plugin.

```html
<script src="/dolphin-client.js"></script>
<script src="path/to/dolphin-persist.js"></script>

<script>
  // Setup persistence with IndexedDB
  const persist = new DolphinPersist({ driver: 'indexeddb' });
  enablePersist(dolphin.store, persist);
  
  // Data will now load from cache instantly before syncing with server
</script>
```

---

## 5. Database Integration (Mongoose)

Dolphin provides an automated bridge to Mongoose.

```javascript
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/curd';

// 1. Setup adapter
const db = createMongooseAdapter({ User, Product });

// 2. Create CRUD service
const crud = createCRUD(db, { 
    enforceOwnership: false,
    realtime: true // Sync with DolphinStore automatically
});

// 3. Register routes
app.get('/products', async (ctx) => ctx.json(await crud.read('Product')));
```

---

## 6. Realtime & IoT Integration

```javascript
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

## 7. Conclusion

Dolphin Framework is built for speed, modularity, and ease of use. With the new v2.2.5 features, you have a complete full-stack synchronization engine for modern web apps.

Happy Coding! 🐬
