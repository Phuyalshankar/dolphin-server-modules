# Dolphin Framework Tutorial 🐬 (v2.11.4)

Welcome to the official tutorial for the **Dolphin Framework**. This guide will take you from zero to a production-ready API using native, high-performance modules and **Agentic AI**.

---

## 1. Project Setup with AI (Cursor Mode)

Dolphin v2.11.4 introduces a Cursor-level AI Agent that helps you architect and write code directly from your terminal.

```bash
# 1. Create directory
mkdir my-dolphin-app && cd my-dolphin-app

# 2. Start the AI Agent (Cursor Mode)
npx dolphin chat

# 3. Architect a full production project via AI
npx dolphin generate-full "e-commerce backend with orders and mongoose"
```

The AI understands your entire project and can perform precision edits using the **Patch Tool**.

---

## 2. Basic Server (Modern ESM Only)

Dolphin strictly uses **ES Modules**. Do not use `require()` as it may lead to compatibility issues.

```javascript
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/', (ctx) => {
  return { 
    message: "Welcome to the world of Dolphin! 🐬", 
    version: "2.11.4",
    mode: "AI-Powered"
  };
});

app.listen(3000, () => {
  console.log("Server swimming on http://localhost:3000");
});
```

---

## 3. Multi-Model Support (Ollama & Groq)

You can choose your AI provider in the `.env` file.

```env
# To use Local AI (Ollama)
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest

# To use Cloud AI (Groq)
GROQ_API_KEY=your_key_here
```

---

## 4. Scaffolding without AI

If you prefer standard templates, use these built-in commands:

```bash
# Add Auth System (User Model + Controller)
npx dolphin add auth

# Add CRUD for a specific model
npx dolphin add crud Product

# Setup Mongoose connection
npx dolphin add adapter mongoose
```

---

## 5. Reactive Frontend Store & Hookless Architecture

Dolphin provides a powerful reactive store in the client library that manages your data and tracking states automatically. With the new `autoBroadcast` feature, you can build entire React applications without using `useState`, `useEffect`, or `onSubmit`!

```javascript
import { useSyncExternalStore } from 'react';
import { DolphinClient } from 'dolphin-server-modules/client';

// 1. Enable autoBroadcast
const dolphin = new DolphinClient('http://localhost:3000', 'dev', { autoBroadcast: true });

function ProductApp() {
  // 2. React automatically re-renders when data changes anywhere!
  const products = useSyncExternalStore(
    (listener) => dolphin.store.subscribe(listener),
    () => dolphin.store.getSnapshot('products')
  );

  return (
      {/* 3. Hookless Form: Submits to DB and broadcasts to WebSocket automatically */}
      <form data-api-submit="POST /api/products">
        <input name="name" required />
        <button type="submit">Add Product</button>
      </form>

      {/* 4. Hookless Auth & Navigation */}
      <form data-api-submit="POST /api/auth/login" data-api-reload>
        <input type="email" name="email" required />
        <input type="password" name="password" required />
        <button type="submit">Login</button>
      </form>

      <ul>
        {products.items.map(p => <li key={p.id}>{p.name}</li>)}
      </ul>
    </div>
  );
}
```

---

## 6. Conclusion

Dolphin Framework is built for speed, modularity, and AI-driven development. It is the perfect tool for building 2026-ready backends.

Happy Coding! 🐬
