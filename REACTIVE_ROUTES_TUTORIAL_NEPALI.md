# 🐬 Dolphin Reactive Routes — सम्पूर्ण Tutorial (नेपालीमा)
**Version: 2.14.1 | HTTP-to-RT Auto Broadcasting | 100% Nepali**

Reactive Routes भनेको Dolphin Framework को एउटा **revolutionary feature** हो जसले HTTP requests (POST, PUT, DELETE) लाई **स्वतः** Realtime events मा रूपान्तरण गर्छ।  
Backend मा एक लाइन थप नलेखीकन, frontend ले live updates पाउँछ!

---

## 📚 सामग्री तालिका

1. [Reactive Routes के हो?](#१-reactive-routes-के-हो)
2. [कसरी काम गर्छ? (Architecture)](#२-कसरी-काम-गर्छ-architecture)
3. [Server Setup](#३-server-setup)
4. [Topic Naming — URL बाट Topic कसरी निर्धारण हुन्छ?](#४-topic-naming--url-बाट-topic-कसरी-निर्धारण-हुन्छ)
5. [Client — Events Receive गर्ने](#५-client--events-receive-गर्ने)
6. [Message Format — Payload Structure](#६-message-format--payload-structure)
7. [Action Types — create, update, delete](#७-action-types--create-update-delete)
8. [noReactive — Opt-out गर्ने](#८-noreactive--opt-out-गर्ने)
9. [autoReactive — Global Control](#९-autoreactive--global-control)
10. [Custom Topic Override](#१०-custom-topic-override)
11. [Nested Routes](#११-nested-routes)
12. [React मा Live List](#१२-react-मा-live-list)
13. [Plain HTML मा Live List](#१३-plain-html-मा-live-list)
14. [Multiple Clients — Real Collaboration](#१४-multiple-clients--real-collaboration)
15. [Complete Example — Live Todo App](#१५-complete-example--live-todo-app)
16. [Common Bugs र Fixes](#१६-common-bugs-र-fixes)

---

## १. Reactive Routes के हो?

पहिले (बिना Reactive Routes):
```js
// ❌ हरेक route मा manually broadcast लेख्नु पर्थ्यो — धेरै काम!
app.post('/api/todos', async (ctx) => {
  const todo = await db.create('Todo', ctx.body);
  // ← यो extra line सधैं लेख्नु पर्थ्यो
  rt.broadcast('todos', { action: 'create', data: todo });
  return todo;
});

app.put('/api/todos/:id', async (ctx) => {
  const todo = await db.update('Todo', ctx.params.id, ctx.body);
  rt.broadcast('todos', { action: 'update', data: todo }); // ← फेरि!
  return todo;
});

app.delete('/api/todos/:id', async (ctx) => {
  await db.delete('Todo', ctx.params.id);
  rt.broadcast('todos', { action: 'delete', data: { id: ctx.params.id } }); // ← फेरि!
});
```

अब (Reactive Routes सँग):
```js
// ✅ एक लाइन मात्र! Broadcast automatic छ!
app.use('/api/todos', createCrudRouter(db, 'Todo'));
// POST → 'create' event broadcast
// PUT/PATCH → 'update' event broadcast  
// DELETE → 'delete' event broadcast
// GET → broadcast हुँदैन (read-only)
```

**यसको फाइदा:**
- 🚀 Backend code ४०-६०% कम हुन्छ
- 🐛 Broadcast भुल्ने bug हुँदैन
- 🔄 Frontend automatically live हुन्छ
- 📦 एउटै CRUD router ले सबै मिलाउँछ

---

## २. कसरी काम गर्छ? (Architecture)

```
Client A (Browser)         Server                    Client B (Browser)
     │                        │                              │
     │── POST /api/todos ──►  │                              │
     │    { title: 'काम' }    │  1. DB मा save               │
     │                        │  2. Response return          │
     │◄── { id, title, ... } ─│  3. Auto-broadcast! ────►   │
     │                        │    topic: 'api/todos'        │
     │                        │    action: 'create'          │
     │                        │    data: { id, title }       │
     │                        │                         ◄────│
     │                        │                   Client B ले
     │                        │                   live update पाउँछ!
```

**Flow:**
1. Client A ले `POST /api/todos` पठाउँछ
2. Dolphin server ले DB मा save गर्छ
3. Response return गर्छ (normal HTTP)
4. **Background मा** automatically topic `api/todos` मा broadcast गर्छ
5. Topic subscribe गरेका सबै clients ले instant update पाउँछन्

**Middleware कहाँ छ?**

Reactive Routes एउटा **global interceptor (middleware)** हो जुन server.ts मा `send()` function wrap गर्छ। यसले:
- HTTP response success (2xx) भएमा मात्र broadcast गर्छ
- Error (4xx, 5xx) भएमा broadcast गर्दैन
- `ctx.state.noReactive = true` भएमा skip गर्छ

---

## ३. Server Setup

### ३.१ Basic Setup
```js
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { RealtimeCore } from 'dolphin-server-modules/realtime';
import { createCrudRouter } from 'dolphin-server-modules/crud';

const rt = new RealtimeCore();

// autoReactive: true — default! छुट्टै लेख्नु पर्दैन
const app = createDolphinServer({
  realtime: rt,
  autoReactive: true,   // ← यो default हो — लेख्नु नपरे पनि हुन्छ
});

// यी routes मा Reactive automatically active:
app.use('/api/todos',    createCrudRouter(db, 'Todo'));
app.use('/api/products', createCrudRouter(db, 'Product'));
app.use('/api/comments', createCrudRouter(db, 'Comment'));

app.listen(3000);
```

### ३.२ Manual Routes मा पनि काम गर्छ
```js
// CRUD router नभई manual route मा पनि!
app.post('/api/messages', async (ctx) => {
  const message = await db.create('Message', ctx.body);
  return message;
  // ← return गर्नासाथ Dolphin ले automatically broadcast गर्छ!
  // topic: 'api/messages', action: 'create'
});

app.put('/api/messages/:id', async (ctx) => {
  const updated = await db.update('Message', ctx.params.id, ctx.body);
  return updated;
  // ← automatically broadcast: action: 'update'
});

app.delete('/api/messages/:id', async (ctx) => {
  await db.delete('Message', ctx.params.id);
  return { success: true };
  // ← automatically broadcast: action: 'delete'
});
```

---

## ४. Topic Naming — URL बाट Topic कसरी निर्धारण हुन्छ?

Dolphin ले **URL path** बाट topic निकाल्छ। Rule सरल छ:

```
HTTP URL Path        →   Realtime Topic
──────────────────────────────────────────
/api/todos           →   api/todos
/api/products        →   api/products
/api/users/posts     →   api/users/posts
/v1/orders           →   v1/orders
/shop/items          →   shop/items
```

**Example:**
```js
// Server
app.use('/api/todos', createCrudRouter(db, 'Todo'));

// Client ले यो topic listen गर्ने:
client.connectRealtime(onMessage, ['api/todos']); // ← '/api/todos' को '/' हट्दैन!
```

**⚠️ सबैभन्दा ठूलो गल्ती:**
```js
// ❌ WRONG — topic match हुँदैन!
client.connectRealtime(onMessage, ['todos']);     // 'todos' ≠ 'api/todos'

// ✅ CORRECT
client.connectRealtime(onMessage, ['api/todos']); // exact match!
```

---

## ५. Client — Events Receive गर्ने

### ५.१ Basic — सबै changes catch गर्ने
```js
const client = new DolphinClient('http://localhost:3000', 'browser-001');
await client.connect();

client.connectRealtime((msg) => {
  console.log('Event:', msg.action, msg.data);
}, ['api/todos']);
```

### ५.२ Action अनुसार handle गर्ने
```js
let todos = [];

client.connectRealtime((msg) => {
  switch(msg.action) {
    case 'create':
      // नयाँ item list मा थप्ने
      todos = [...todos, msg.data];
      break;

    case 'update':
      // Existing item update गर्ने
      todos = todos.map(t =>
        t.id === msg.data.id ? msg.data : t
      );
      break;

    case 'delete':
      // Item remove गर्ने
      todos = todos.filter(t => t.id !== msg.data.id);
      break;
  }

  renderTodos(todos); // UI update
}, ['api/todos']);
```

### ५.३ Multiple Topics एकैपटक
```js
client.connectRealtime((msg) => {
  // msg.topic बाट कुन resource भनेर थाहा पाउने
  if (msg.topic === 'api/todos') {
    handleTodoEvent(msg);
  } else if (msg.topic === 'api/comments') {
    handleCommentEvent(msg);
  } else if (msg.topic === 'api/products') {
    handleProductEvent(msg);
  }
}, ['api/todos', 'api/comments', 'api/products']);
```

### ५.४ Wildcard Topics
```js
// 'api/' अन्तर्गत सबै resources
client.connectRealtime((msg) => {
  console.log(`${msg.topic} → ${msg.action}:`, msg.data);
}, ['api/#']);  // api/todos, api/products, api/orders — सबै!
```

---

## ६. Message Format — Payload Structure

Reactive Routes ले broadcast गर्ने message को format:

```typescript
interface ReactiveMessage {
  action: 'create' | 'update' | 'delete';
  data: any;           // actual DB record
  topic: string;       // URL path बाट निकालिएको
  timestamp: number;   // Unix timestamp (ms)
  deviceId?: string;   // कुन device बाट request आयो
}
```

**POST (create) को message:**
```json
{
  "action": "create",
  "data": {
    "id": "64abc123...",
    "title": "बजार जाने",
    "status": "pending",
    "createdAt": "2026-07-04T01:30:00Z",
    "userId": "64def456..."
  },
  "topic": "api/todos",
  "timestamp": 1751593800000
}
```

**PUT/PATCH (update) को message:**
```json
{
  "action": "update",
  "data": {
    "id": "64abc123...",
    "title": "बजार जाने",
    "status": "completed",
    "updatedAt": "2026-07-04T02:00:00Z"
  },
  "topic": "api/todos",
  "timestamp": 1751595600000
}
```

**DELETE को message:**
```json
{
  "action": "delete",
  "data": {
    "id": "64abc123..."
  },
  "topic": "api/todos",
  "timestamp": 1751597400000
}
```

---

## ७. Action Types — create, update, delete

| HTTP Method | Action | कहिले हुन्छ |
|---|---|---|
| `POST` | `create` | नयाँ item बनाउँदा |
| `PUT` | `update` | पूरै item replace गर्दा |
| `PATCH` | `update` | आंशिक update गर्दा |
| `DELETE` | `delete` | item मेट्दा |
| `GET` | ❌ broadcast हुँदैन | Read-only |

```js
// GET — कुनै broadcast छैन
const todos = await client.api.todos.get(); // silent

// POST → 'create' broadcast
await client.api.todos.post({ title: 'नयाँ काम' }); // ← broadcast!

// PUT → 'update' broadcast
await client.api.todos.put('id123', { title: 'Update', status: 'done' }); // ← broadcast!

// PATCH → 'update' broadcast
await client.api.todos.patch('id123', { status: 'done' }); // ← broadcast!

// DELETE → 'delete' broadcast
await client.api.todos.delete('id123'); // ← broadcast!
```

---

## ८. noReactive — Opt-out गर्ने

कुनै specific route मा broadcast रोक्न `ctx.state.noReactive = true` set गर्नुहोस्।

### ८.१ Sensitive Routes मा बन्द गर्ने
```js
// Password change — broadcast गर्नु हुँदैन!
app.post('/api/auth/change-password', async (ctx) => {
  ctx.state.noReactive = true; // ← यो route मा broadcast बन्द

  await authService.changePassword(ctx.user.id, ctx.body);
  return { success: true, message: 'Password बदलियो' };
});
```

### ८.२ Admin-only Updates
```js
// Admin ले user को data silently update गर्ने
app.patch('/api/admin/users/:id/ban', async (ctx) => {
  ctx.state.noReactive = true; // user लाई थाहा नपाओस्

  await userService.ban(ctx.params.id);
  return { success: true };
});
```

### ८.३ Internal/Background Operations
```js
// Analytics update — broadcast unnecessary
app.post('/api/analytics/track', async (ctx) => {
  ctx.state.noReactive = true; // track event broadcast नगर्ने

  await analytics.track(ctx.body);
  return { ok: true };
});
```

### ८.४ Condition अनुसार
```js
app.put('/api/settings', async (ctx) => {
  // केवल public settings change भएमा broadcast
  if (ctx.body.isPrivate) {
    ctx.state.noReactive = true; // private settings — broadcast नगर्ने
  }

  const updated = await settings.update(ctx.body);
  return updated;
});
```

---

## ९. autoReactive — Global Control

पूरै server मा Reactive Routes enable/disable गर्न:

### ९.१ Default (true)
```js
// autoReactive: true — छुट्टै लेख्नु पर्दैन, default नै हो
const app = createDolphinServer({ realtime: rt });
```

### ९.२ Globally बन्द गर्ने
```js
// Testing वा legacy project मा
const app = createDolphinServer({
  realtime: rt,
  autoReactive: false, // सबै routes मा broadcast बन्द
});
```

### ९.३ Environment अनुसार
```js
const app = createDolphinServer({
  realtime: rt,
  autoReactive: process.env.NODE_ENV !== 'test', // test मा बन्द
});
```

---

## १०. Custom Topic Override

Default topic (URL path) को सट्टा custom topic broadcast गर्न:

```js
// Default: POST /api/todos → topic: 'api/todos'
// Custom: topic: 'tasks' (rename)

app.post('/api/todos', async (ctx) => {
  const todo = await db.create('Todo', ctx.body);

  // Custom topic override
  ctx.state.reactiveTopic = 'tasks'; // ← custom topic!

  return todo;
  // broadcast: { action: 'create', data: todo, topic: 'tasks' }
});
```

```js
// Client side
client.connectRealtime(onMessage, ['tasks']); // 'tasks' topic listen
```

---

## ११. Nested Routes

Sub-resources को लागि:

```js
// Server
app.use('/api/posts/:postId/comments', createCrudRouter(db, 'Comment'));

// Topic: 'api/posts/:postId/comments'
// तर actual topic मा postId fill हुन्छ:
// Example: 'api/posts/64abc.../comments'
```

```js
// Client — specific post को comments मात्र
client.connectRealtime((msg) => {
  addComment(msg.data);
}, [`api/posts/${currentPostId}/comments`]);

// वा wildcard:
client.connectRealtime((msg) => {
  console.log('Any post comment:', msg);
}, ['api/posts/+/comments']); // सबै posts को comments
```

---

## १२. React मा Live List

### १२.१ useReactiveList Custom Hook
```tsx
// hooks/useReactiveList.ts
import { useEffect, useState } from 'react';
import { client } from '../lib/dolphin';

export function useReactiveList<T extends { id: string }>(
  apiPath: string,   // '/api/todos'
  topic: string,     // 'api/todos'
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    client.request('GET', apiPath)
      .then(data => setItems(data))
      .finally(() => setLoading(false));
  }, [apiPath]);

  // Realtime updates
  useEffect(() => {
    const stop = client.connectRealtime((msg) => {
      setItems(prev => {
        switch(msg.action) {
          case 'create':
            return [...prev, msg.data as T];
          case 'update':
            return prev.map(item =>
              item.id === (msg.data as T).id ? msg.data as T : item
            );
          case 'delete':
            return prev.filter(item => item.id !== msg.data.id);
          default:
            return prev;
        }
      });
    }, [topic]);

    return stop; // cleanup on unmount
  }, [topic]);

  return { items, loading };
}
```

### १२.२ Component मा Use
```tsx
// components/TodoList.tsx
import { useReactiveList } from '../hooks/useReactiveList';
import { client } from '../lib/dolphin';

interface Todo {
  id: string;
  title: string;
  status: 'pending' | 'completed';
}

export default function TodoList() {
  const { items: todos, loading } = useReactiveList<Todo>(
    '/api/todos',   // HTTP endpoint
    'api/todos',    // Realtime topic
  );

  const addTodo = async (title: string) => {
    await client.api.todos.post({ title });
    // 🎉 list automatically update हुन्छ! setState() लेख्नु पर्दैन!
  };

  const completeTodo = async (id: string) => {
    await client.api.todos.patch(id, { status: 'completed' });
    // 🎉 list automatically update!
  };

  const deleteTodo = async (id: string) => {
    await client.api.todos.delete(id);
    // 🎉 list automatically remove!
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <form onSubmit={(e) => {
        e.preventDefault();
        const title = (e.target as any).title.value;
        addTodo(title);
        (e.target as any).reset();
      }}>
        <input name="title" placeholder="नयाँ todo..." required />
        <button type="submit">थप्ने</button>
      </form>

      <ul>
        {todos.map(todo => (
          <li key={todo.id} style={{ textDecoration: todo.status === 'completed' ? 'line-through' : 'none' }}>
            {todo.title}
            <button onClick={() => completeTodo(todo.id)}>✅</button>
            <button onClick={() => deleteTodo(todo.id)}>🗑</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## १३. Plain HTML मा Live List

JavaScript framework नभए पनि काम गर्छ:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="./dolphin-client.js"></script>
</head>
<body>
  <h2>Live Products</h2>

  <form id="addForm">
    <input id="nameInput" placeholder="Product name" />
    <input id="priceInput" type="number" placeholder="Price" />
    <button type="submit">Add</button>
  </form>

  <ul id="productList"></ul>

  <script>
    const client = new DolphinClient('http://localhost:3000', 'web-01');
    let products = [];

    // Render function
    function render() {
      document.getElementById('productList').innerHTML =
        products.map(p => `
          <li>
            ${p.name} — Rs.${p.price}
            <button onclick="deleteProduct('${p.id}')">Delete</button>
          </li>
        `).join('');
    }

    // Delete function
    async function deleteProduct(id) {
      await client.api.products.delete(id);
      // ← Reactive Routes ले automatically 'api/products' topic मा
      //   { action: 'delete', data: { id } } broadcast गर्छ
      // ← connectRealtime ले catch गरेर list update गर्छ
    }

    // Initial load + Realtime subscribe
    async function init() {
      await client.connect();

      // Initial data load
      products = await client.api.products.get();
      render();

      // Realtime subscribe — Reactive Routes events catch गर्ने
      client.connectRealtime((msg) => {
        switch(msg.action) {
          case 'create':
            products = [...products, msg.data];
            break;
          case 'update':
            products = products.map(p => p.id === msg.data.id ? msg.data : p);
            break;
          case 'delete':
            products = products.filter(p => p.id !== msg.data.id);
            break;
        }
        render(); // re-render
      }, ['api/products']); // ← exact topic!
    }

    // Add product
    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('nameInput').value;
      const price = document.getElementById('priceInput').value;
      await client.api.products.post({ name, price: Number(price) });
      // ← Reactive Routes ले automatically broadcast गर्छ
      // ← connectRealtime ले catch गरेर list update गर्छ
      e.target.reset();
    });

    init();
  </script>
</body>
</html>
```

---

## १४. Multiple Clients — Real Collaboration

```
Browser A          Server          Browser B          Browser C
   │                  │                │                  │
   │─ POST /api/todos ►│                │                  │
   │   { title:'काम' } │                │                  │
   │                  │─ broadcast ────►│                  │
   │                  │─ broadcast ─────────────────────► │
   │◄─ { id, title } ─│                │                  │
   │                  │     Browser B र C ले               │
   │                  │     तुरुन्त update पाउँछन्!        │
```

```js
// Browser A — नयाँ todo थप्छ
await client.api.todos.post({ title: 'Meeting' });

// Browser B — automatically update पाउँछ (subscribe गरेको छ)
client.connectRealtime((msg) => {
  if (msg.action === 'create') {
    showAlert(`नयाँ todo: "${msg.data.title}"`);
    addToList(msg.data);
  }
}, ['api/todos']);

// Browser C — पनि automatically update पाउँछ
client.connectRealtime((msg) => {
  renderList(currentTodos);
}, ['api/todos']);
```

**Use cases:**
- 📝 Collaborative document editing
- 📊 Live admin dashboard (नयाँ orders, users)
- 🛒 Live inventory management
- 💬 Team task management (Trello-like)
- 📈 Live sales/analytics dashboard

---

## १५. Complete Example — Live Todo App

**Backend (app.js):**
```js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { RealtimeCore } from 'dolphin-server-modules/realtime';
import { createCrudRouter } from 'dolphin-server-modules/crud';
import { createMongooseAdapter } from 'dolphin-server-modules/mongoose';
import mongoose from 'mongoose';

// DB Schema
const Todo = mongoose.model('Todo', new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'completed'] },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
}));

const db = createMongooseAdapter({ User, RefreshToken, models: { Todo } });
const rt = new RealtimeCore();

const app = createDolphinServer({
  realtime: rt,
  autoReactive: true,   // Reactive Routes ON (default)
});

// Auth middleware
app.use(app.authMiddleware());

// Todo CRUD — एक लाइनमा पूरा Realtime CRUD!
app.use('/api/todos', createCrudRouter(db, 'Todo', {
  enforceOwnership: true, // आफ्नो todo मात्र access
}));

// Special route — noReactive example
app.post('/api/todos/bulk-delete', async (ctx) => {
  ctx.state.noReactive = true; // bulk operation — individual broadcast हुँदैन

  const { ids } = ctx.body;
  await db.deleteMany('Todo', { _id: { $in: ids } });

  // Custom broadcast — एकपल्ट मात्र
  rt.broadcast('api/todos', {
    action: 'bulk-delete',
    data: { ids },
  });

  return { deleted: ids.length };
});

await mongoose.connect(process.env.MONGO_URI);
app.listen(3000, () => console.log('🐬 Server ready!'));
```

**Frontend (index.html):**
```html
<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8">
  <title>🐬 Live Todo</title>
  <script src="./dolphin-client.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #0066cc; }
    .todo { display: flex; align-items: center; gap: 10px; padding: 10px;
            border: 1px solid #ddd; border-radius: 8px; margin: 5px 0; }
    .todo.completed span { text-decoration: line-through; color: #999; }
    .todo span { flex: 1; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%;
                  background: #4CAF50; display: inline-block; }
    #transport { color: #666; font-size: 12px; }
    .empty { color: #999; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <h1>🐬 Dolphin Live Todo</h1>
  <p id="transport">Connecting...</p>

  <!-- Login -->
  <div id="loginDiv">
    <input id="email" type="email" value="test@test.com" placeholder="Email" />
    <input id="pass" type="password" value="Test1234!" placeholder="Password" />
    <button id="loginBtn">Login</button>
  </div>

  <!-- App -->
  <div id="appDiv" style="display:none">
    <form id="addForm">
      <input id="todoInput" placeholder="नयाँ todo थप्नुहोस्..." style="width:80%" />
      <button type="submit">+</button>
    </form>
    <div id="todoList"></div>
  </div>

  <script>
    // ── Client Setup ────────────────────────────────────────────
    const deviceId = localStorage.getItem('did') || crypto.randomUUID();
    localStorage.setItem('did', deviceId);

    const client = new DolphinClient('http://localhost:3000', deviceId, {
      autoConnect: false,
    });

    // ── State ───────────────────────────────────────────────────
    let todos = [];

    // ── Render ──────────────────────────────────────────────────
    function render() {
      const list = document.getElementById('todoList');
      if (!todos.length) {
        list.innerHTML = '<div class="empty">कुनै todo छैन। माथि थप्नुहोस्!</div>';
        return;
      }
      list.innerHTML = todos.map(t => `
        <div class="todo ${t.status}" data-id="${t.id}">
          <span class="status-dot" style="background:${t.status==='completed'?'#4CAF50':'#FF9800'}"></span>
          <span>${t.title}</span>
          <button onclick="toggle('${t.id}', '${t.status}')">
            ${t.status === 'completed' ? '↩' : '✅'}
          </button>
          <button onclick="remove('${t.id}')">🗑</button>
        </div>
      `).join('');
    }

    // ── Actions (Reactive Routes ले automatically broadcast गर्छ!) ──
    async function toggle(id, currentStatus) {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await client.api.todos.patch(id, { status: newStatus });
      // ← PATCH → Reactive Routes → 'update' broadcast → render() automatic!
    }

    async function remove(id) {
      if (!confirm('Delete गर्ने?')) return;
      await client.api.todos.delete(id);
      // ← DELETE → Reactive Routes → 'delete' broadcast → render() automatic!
    }

    // ── Add Todo ────────────────────────────────────────────────
    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('todoInput').value.trim();
      if (!title) return;
      await client.api.todos.post({ title });
      // ← POST → Reactive Routes → 'create' broadcast → render() automatic!
      document.getElementById('todoInput').value = '';
    });

    // ── Login ───────────────────────────────────────────────────
    document.getElementById('loginBtn').addEventListener('click', async () => {
      try {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('pass').value;

        await client.auth.login(email, pass);

        // Realtime connect (JWT automatically included)
        await client.connect();

        const transport = client.getTransport();
        document.getElementById('transport').textContent =
          `✅ Connected via ${transport} | deviceId: ${deviceId.slice(0,8)}...`;

        document.getElementById('loginDiv').style.display = 'none';
        document.getElementById('appDiv').style.display = 'block';

        // Initial load
        todos = await client.api.todos.get();
        render();

        // 🎯 Reactive Routes Events — यहाँ magic हुन्छ!
        client.connectRealtime((msg) => {
          console.log(`[RT] ${msg.topic} → ${msg.action}:`, msg.data);

          switch(msg.action) {
            case 'create':
              todos = [...todos, msg.data];
              break;
            case 'update':
              todos = todos.map(t => t.id === msg.data.id ? msg.data : t);
              break;
            case 'delete':
              todos = todos.filter(t => t.id !== msg.data.id);
              break;
          }
          render(); // UI update!
        }, ['api/todos']); // ← exact topic!

      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // ── Connection Events ───────────────────────────────────────
    client.on('disconnect', () => {
      document.getElementById('transport').textContent = '❌ Disconnected...';
    });
    client.on('reconnect', (n) => {
      document.getElementById('transport').textContent = `🔄 Reconnecting (${n})...`;
    });
  </script>
</body>
</html>
```

---

## १६. Common Bugs र Fixes

### ❌ Bug १: Events आउँदैन — Wrong Topic
```js
// ❌ WRONG
client.connectRealtime(onMsg, ['todos']);       // 'todos' ≠ 'api/todos'
client.connectRealtime(onMsg, ['/api/todos']);  // leading slash नचाहिने

// ✅ CORRECT
client.connectRealtime(onMsg, ['api/todos']);   // URL path exactly, leading slash बिना
```

### ❌ Bug २: Duplicate Items — Double Render
```js
// ❌ WRONG — POST response र RT event दुवैले थप्ने!
const newTodo = await client.api.todos.post({ title });
todos.push(newTodo); // ← manual push!
// + connectRealtime 'create' event ले पनि push गर्छ!
// Result: duplicate!

// ✅ CORRECT — RT event मात्र use गर्ने
await client.api.todos.post({ title });
// Push नगर्ने! connectRealtime ले automatically handle गर्छ।
```

### ❌ Bug ३: noReactive काम गरेन
```js
// ❌ WRONG — return गरिसकेपछि noReactive set गर्ने
app.post('/api/secret', async (ctx) => {
  const data = await process(ctx.body);
  return data; // ← पहिले return!
  ctx.state.noReactive = true; // ← यो कहिल्यै execute हुँदैन!
});

// ✅ CORRECT — return अगाडि set गर्ने
app.post('/api/secret', async (ctx) => {
  ctx.state.noReactive = true; // ← पहिले!
  const data = await process(ctx.body);
  return data;
});
```

### ❌ Bug ४: connect() नगरी subscribe
```js
// ❌ WRONG — connect नगरी events आउँदैन
client.connectRealtime(onMsg, ['api/todos']);
// connect() नगरेकोले WebSocket छैन!

// ✅ CORRECT — पहिले connect
await client.connect();
client.connectRealtime(onMsg, ['api/todos']);
```

### ❌ Bug ५: Memory Leak — React Cleanup
```js
// ❌ WRONG — unmount मा cleanup नगर्ने
useEffect(() => {
  client.connectRealtime(onMsg, ['api/todos']);
}, []);

// ✅ CORRECT — cleanup return गर्ने
useEffect(() => {
  const stop = client.connectRealtime(onMsg, ['api/todos']);
  return stop; // React unmount मा automatically call गर्छ
}, []);
```

### ❌ Bug ६: DELETE को data.id undefined
```js
// DELETE message:
// { action: 'delete', data: { id: '64abc...' } }

// ❌ WRONG
todos = todos.filter(t => t.id !== msg.data); // msg.data is object, not string!

// ✅ CORRECT
todos = todos.filter(t => t.id !== msg.data.id); // msg.data.id!
```

---

## 📋 Quick Reference

```js
// ── Server Setup ─────────────────────────────────────────────
const app = createDolphinServer({ realtime: rt, autoReactive: true });
app.use('/api/todos', createCrudRouter(db, 'Todo')); // Auto reactive!

// ── noReactive ──────────────────────────────────────────────
app.post('/api/secret', async (ctx) => {
  ctx.state.noReactive = true;  // broadcast बन्द
  return await process(ctx.body);
});

// ── Topic Naming ─────────────────────────────────────────────
// URL /api/todos → Topic 'api/todos'
// URL /api/posts/:id/comments → Topic 'api/posts/:id/comments'

// ── Client Subscribe ─────────────────────────────────────────
await client.connect();
const stop = client.connectRealtime((msg) => {
  // msg = { action, data, topic, timestamp }
  if (msg.action === 'create') todos = [...todos, msg.data];
  if (msg.action === 'update') todos = todos.map(t => t.id === msg.data.id ? msg.data : t);
  if (msg.action === 'delete') todos = todos.filter(t => t.id !== msg.data.id);
}, ['api/todos']); // exact topic!

// ── Actions ──────────────────────────────────────────────────
// POST   → action: 'create'
// PUT    → action: 'update'
// PATCH  → action: 'update'
// DELETE → action: 'delete'
// GET    → no broadcast
```

---

**बधाई छ! 🎉🐬**  
अब तपाईंले Dolphin Reactive Routes को सम्पूर्ण शक्ति बुझ्नुभयो।  
एक लाइन backend code ले पूरा realtime collaboration सम्भव छ!

**Happy Coding! 🇳🇵**
