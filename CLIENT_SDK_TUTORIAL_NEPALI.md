# 🐬 Dolphin Client SDK — सम्पूर्ण Tutorial (नेपालीमा)
**Version: 2.14.1 | dolphin-client | 100% Nepali**

Dolphin Client SDK एउटा शक्तिशाली JavaScript library हो जसले तपाईंको frontend लाई Dolphin backend सँग जोड्छ।  
यसमा **HTTP API client**, **Realtime WebSocket/SSE**, **Auto-Generated SDK**, **Hookless DOM binding**, र **React store** सबै built-in छन्।

---

## 📚 सामग्री तालिका

1. [Client SDK के हो?](#१-client-sdk-के-हो)
2. [Install र Setup](#२-install-र-setup)
3. [Auto-Generated SDK (generate-client)](#३-auto-generated-sdk-generate-client)
4. [Authentication — Login / Register](#४-authentication--login--register)
5. [HTTP API Calls](#५-http-api-calls)
6. [Realtime Connection (WebSocket/SSE)](#६-realtime-connection-websocketsse)
7. [JWT Auth — Secure Realtime](#७-jwt-auth--secure-realtime)
8. [Topic Subscriptions](#८-topic-subscriptions)
9. [Reactive Routes — Auto RT Update](#९-reactive-routes--auto-rt-update)
10. [SSE Fallback — Auto Fallback](#१०-sse-fallback--auto-fallback)
11. [Hookless DOM Binding](#११-hookless-dom-binding)
12. [React Integration](#१२-react-integration)
13. [File Upload/Download](#१३-file-uploaddownload)
14. [Pub/Sub — Real-time Messaging](#१४-pubsub--real-time-messaging)
15. [Push Notifications (Client-side)](#१५-push-notifications-client-side)
16. [Error Handling](#१६-error-handling)
17. [TypeScript Support (.d.ts)](#१७-typescript-support-dts)
18. [DOLPHIN_GENERATE_KEY — SDK Security](#१८-dolphin_generate_key--sdk-security)
19. [Complete Real App Example](#१९-complete-real-app-example)
20. [Common Bugs र Fixes](#२०-common-bugs-र-fixes)

---

## १. Client SDK के हो?

Dolphin Client SDK (`dolphin-client`) ले frontend developer लाई backend API सँग काम गर्न सजिलो बनाउँछ।

**बिना SDK (पुरानो तरिका):**
```js
// ❌ हरेक API call मा manual fetch — झन्झटिलो!
const res = await fetch('/api/todos', {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});
const todos = await res.json();

// Realtime को लागि छुट्टै WebSocket
const ws = new WebSocket('ws://...');
ws.onmessage = (e) => { /* manually parse */ };
```

**Dolphin Client SDK सँग (नयाँ तरिका):**
```js
// ✅ सबै एकठाउँ — clean र simple!
const client = new DolphinClient('http://localhost:3000', 'my-device');
await client.auth.login('user@email.com', 'password');
const todos = await client.api.todos.get();
client.connectRealtime(onUpdate, ['todos']);
```

**मुख्य फिचरहरू:**
| Feature | विवरण |
|---|---|
| 🔑 Auth | Login, Register, Refresh Token automatic |
| 📡 HTTP API | सबै CRUD operations एकै syntax |
| ⚡ Realtime | WebSocket + SSE auto-fallback |
| 🎯 Topic Filter | आफूलाई चाहिने topic मात्र सुन्ने |
| 📄 File Transfer | Upload/Download resume support |
| 🔔 Push Notifications | Browser notification integration |
| 🧩 Auto SDK | CLI बाट generate — TypeScript types सहित |
| 🪝 Hookless DOM | JavaScript नलेखी HTML मा API data bind |

---

## २. Install र Setup

### तरिका १ — npm (React/Node.js Project)
```bash
npm install dolphin-client
```

```js
import { DolphinClient } from 'dolphin-client';

const client = new DolphinClient('http://localhost:3000', 'my-device-001', {
  autoConnect: true,        // new गर्नासाथ WebSocket connect
  reconnectAttempts: 5,     // disconnect भए कति पल्ट retry
  reconnectDelay: 2000,     // retry बीच milliseconds
  debug: false,             // true भए console logs देखिन्छ
  httpTimeout: 10_000,      // HTTP request timeout (ms)
  wsHeartbeat: 30_000,      // WebSocket ping interval (ms)
});
```

### तरिका २ — CDN (Plain HTML)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Dolphin App</title>
</head>
<body>
  <!-- Dolphin Client load गर्नुहोस् -->
  <script src="node_modules/dolphin-client/dist/dolphin-client.js"></script>

  <script>
    const client = new DolphinClient('http://localhost:3000', 'browser-001');
  </script>
</body>
</html>
```

### तरिका ३ — Auto-Generated SDK (Best!) 🌟
```html
<!-- generate-client CLI बाट बनाइएको SDK -->
<script src="./dolphin-client.js"></script>
<!-- सबै API types automatically known! -->
```
*(यसको पूरा विवरण Section ३ मा हेर्नुहोस्)*

### DeviceId के हो?
`deviceId` प्रत्येक client को unique पहिचान हो। Server ले यसलाई प्रयोग गरेर specific device लाई message पठाउन सक्छ।

```js
// Best practice — unique device ID बनाउने
const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID();
localStorage.setItem('deviceId', deviceId);

const client = new DolphinClient('http://localhost:3000', deviceId);
```

---

## ३. Auto-Generated SDK (generate-client)

यो **सबैभन्दा सजिलो र शक्तिशाली** तरिका हो। Dolphin server मा भएका सबै routes scan गरेर automatically एउटा typed JavaScript SDK बनाउँछ।

### ३.१ Server मा Generate गर्ने

```bash
# Server चलिरहेको बेला यो command चलाउनुहोस्
npx dolphin generate-client \
  --url=http://localhost:3000 \
  --out=./public/dolphin-client.js \
  --key=your_secret_generate_key
```

**Options:**
| Flag | विवरण | Default |
|---|---|---|
| `--url` | तपाईंको Dolphin server URL | required |
| `--out` | output file path | `./dolphin-client.js` |
| `--key` | DOLPHIN_GENERATE_KEY (security) | optional |

यसले **दुईवटा फाइल** बनाउँछ:
- `dolphin-client.js` — Browser मा सिधै use गर्न मिल्ने SDK
- `dolphin-client.d.ts` — TypeScript IntelliSense/Autocomplete

### ३.२ Generated SDK use गर्ने

**Plain HTML मा:**
```html
<script src="./dolphin-client.js"></script>
<script>
  // DolphinClient globally available!
  const client = new DolphinClient('http://localhost:3000', 'browser-001');

  // VS Code मा autocomplete पाउँछ!
  const todos = await client.api.todos.get();
  const users = await client.api.users.get();
  const product = await client.api.products.post({
    name: 'Laptop',
    price: 150000
  });
</script>
```

**TypeScript मा:**
```typescript
// dolphin-client.d.ts automatically picked up
import { DolphinClient } from './dolphin-client.js';

const client = new DolphinClient('http://localhost:3000', 'ts-device');

// Full type safety!
const todos: Todo[] = await client.api.todos.get();
//                                ^^^  TypeScript error यदि endpoint नभए!
```

### ३.३ कहिले regenerate गर्ने?
Backend मा नयाँ route थपेपछि वा route बदलेपछि `generate-client` फेरि चलाउनुहोस्:

```bash
# package.json मा script थप्नुहोस्
{
  "scripts": {
    "gen-sdk": "dolphin generate-client --url=http://localhost:3000 --out=./src/sdk.js --key=$DOLPHIN_GENERATE_KEY"
  }
}

npm run gen-sdk
```

---

## ४. Authentication — Login / Register

Dolphin Client ले JWT authentication automatically manage गर्छ — token refresh, storage, headers सबै।

### ४.१ Register (नयाँ account बनाउने)
```js
try {
  const result = await client.auth.register({
    name: 'राम बहादुर',
    email: 'ram@example.com',
    password: 'SecurePass123',
    // आफ्नो model अनुसार थप fields:
    role: 'user',
    phone: '9841234567',
  });

  console.log('Register सफल!', result.user);
  // client ले automatically token save गर्छ
} catch (err) {
  console.error('Register असफल:', err.message);
}
```

### ४.२ Login
```js
const result = await client.auth.login('ram@example.com', 'SecurePass123');

console.log(result.user);         // { id, name, email, role }
console.log(result.accessToken);  // JWT token (client ले automatically store गर्छ)
```

### ४.३ Token Automatic Refresh
```js
// यो manually गर्नु पर्दैन! Client ले automatically handle गर्छ।
// Access token expire हुनु अगाडि नै refresh हुन्छ।

// तर manually refresh गर्नु परे:
await client.auth.refresh();
```

### ४.४ Current User Info
```js
const me = await client.auth.me();
console.log(me); // { id, name, email, role, createdAt, ... }
```

### ४.५ Logout
```js
await client.auth.logout();
// Token delete हुन्छ, WebSocket disconnect हुन्छ
```

### ४.६ Token Manually Access गर्ने
```js
const token = client.auth.getToken();     // current access token
const isLoggedIn = client.auth.isLoggedIn(); // true/false
```

---

## ५. HTTP API Calls

Auto-generated SDK वा manual API calls गर्न निम्न syntax प्रयोग गर्नुहोस्।

### ५.१ GET — डाटा ल्याउने
```js
// सबै items
const todos = await client.api.todos.get();

// Query parameters सहित
const filtered = await client.api.todos.get({
  params: { status: 'active', limit: 10, offset: 0 }
});
// → GET /api/todos?status=active&limit=10&offset=0

// एउटा item
const todo = await client.api.todos.get({ id: '64abc...' });
// → GET /api/todos/64abc...
```

### ५.२ POST — नयाँ बनाउने
```js
const created = await client.api.todos.post({
  title: 'बजार जाने',
  priority: 'high',
  dueDate: '2026-07-10'
});

console.log(created); // { id, title, priority, dueDate, createdAt }
```

### ५.३ PUT — पूरै update गर्ने
```js
const updated = await client.api.todos.put('64abc...', {
  title: 'बजार जाने (urgent)',
  priority: 'urgent',
  dueDate: '2026-07-05'
});
```

### ५.४ PATCH — आंशिक update गर्ने
```js
// केवल status मात्र update
const patched = await client.api.todos.patch('64abc...', {
  status: 'completed'
});
```

### ५.५ DELETE — मेट्ने
```js
await client.api.todos.delete('64abc...');
```

### ५.६ Custom Endpoint (raw request)
```js
// generate-client मा नभएको endpoint call गर्न
const result = await client.request('POST', '/api/auth/change-password', {
  body: { oldPassword: 'old', newPassword: 'new' }
});
```

---

## ६. Realtime Connection (WebSocket/SSE)

### ६.१ Basic Connect
```js
// WebSocket connect गर्ने
await client.connect();

// Disconnect गर्ने
client.disconnect();
```

### ६.२ connectRealtime — सबैभन्दा सजिलो तरिका
```js
// सबै realtime events सुन्ने
const unsubscribe = client.connectRealtime((message) => {
  console.log('New event:', message);
  // message = { action, data, topic }
});

// पछि बन्द गर्न:
unsubscribe();
```

### ६.३ Connection Events
```js
client.on('connect', () => {
  console.log('✅ Realtime connected!');
});

client.on('disconnect', () => {
  console.log('❌ Realtime disconnected');
});

client.on('reconnect', (attempt) => {
  console.log(`🔄 Reconnecting... attempt ${attempt}`);
});

client.on('error', (err) => {
  console.error('WebSocket error:', err);
});
```

### ६.४ Connection Status जाँच्ने
```js
const isConnected = client.isConnected();   // true/false
const transport = client.getTransport();    // 'websocket' वा 'sse'
```

---

## ७. JWT Auth — Secure Realtime

Login पछि पाएको JWT token सँग WebSocket connect गरेमा server ले user verify गर्छ — unauthorized users disconnect हुन्छन्।

### ७.१ Token सहित Connect (Automatic)
```js
// Login भइसकेपछि client ले automatically token pass गर्छ
await client.auth.login('ram@example.com', 'password');
await client.connect(); // Token automatically WebSocket URL मा थपिन्छ!
```

पर्दा पछाडि के हुन्छ:
```
ws://localhost:3000/realtime?deviceId=browser-001&token=eyJhbGciOiJI...
                                                   ^^^^^ JWT Token!
```

### ७.२ Manual Token Pass गर्ने
```js
const token = localStorage.getItem('accessToken');
await client.connect({ token });
```

### ७.३ Token Expire भएमा
```js
// Client ले automatically नयाँ token लिएर reconnect गर्छ।
// तर manual handle गर्न:
client.on('tokenExpired', async () => {
  await client.auth.refresh();
  await client.connect(); // नयाँ token सहित reconnect
});
```

### ७.४ Server Side — JWT Verification
Server (Dolphin Framework) ले automatically token verify गर्छ:
- ✅ Valid token → Connection accept
- ❌ Invalid/expired token → Immediately disconnect
- ❌ No token → Accept (यदि server ले require नगरेमा)

---

## ८. Topic Subscriptions

सबै messages सुन्नुको सट्टा specific topics मात्र filter गरेर सुन्न सकिन्छ।

### ८.१ Single Topic
```js
client.connectRealtime(
  (msg) => {
    console.log(`[${msg.topic}]`, msg.action, msg.data);
  },
  ['todos']  // 'todos' topic मात्र
);
```

### ८.२ Multiple Topics
```js
client.connectRealtime(
  (msg) => {
    switch(msg.topic) {
      case 'todos':
        updateTodoList(msg);
        break;
      case 'notifications':
        showNotification(msg.data);
        break;
      case 'chat':
        appendChatMessage(msg.data);
        break;
    }
  },
  ['todos', 'notifications', 'chat']  // तीन topics
);
```

### ८.३ Wildcard Topics (MQTT-style)
```js
client.connectRealtime(
  (msg) => console.log(msg),
  ['chat/+']    // chat/room1, chat/room2, chat/anything
);

client.connectRealtime(
  (msg) => console.log(msg),
  ['sensor/#']  // sensor/ अन्तर्गत सबै topics
);
```

### ८.४ Message Format
```typescript
interface RealtimeMessage {
  action: 'create' | 'update' | 'delete' | 'custom';
  data: any;          // actual data object
  topic: string;      // कुन topic बाट आयो
  deviceId?: string;  // कुन device बाट आयो
  timestamp: number;  // Unix timestamp
}
```

### ८.५ Topic बाट Unsubscribe गर्ने
```js
const stop = client.connectRealtime(onMessage, ['todos']);

// पछि बन्द गर्न:
stop();
```

---

## ९. Reactive Routes — Auto RT Update

Dolphin Framework को सबैभन्दा innovative feature! Backend मा साधारण HTTP route लेखेमा POST/PUT/DELETE मा **automatically** realtime broadcast हुन्छ।

### ९.१ कसरी काम गर्छ?

**Backend (एकपल्ट मात्र लेख्ने):**
```js
// app.js — यति मात्र!
app.use('/api/todos', createCrudRouter(db, 'Todo'));
// ☝️ POST /api/todos गर्दा automatically 'todos' topic मा broadcast!
```

**Frontend (सुन्ने):**
```js
// कुनैले नयाँ todo थप्यो भने तुरुन्त update आउँछ!
client.connectRealtime((msg) => {
  if (msg.action === 'create') addToList(msg.data);
  if (msg.action === 'update') updateInList(msg.data);
  if (msg.action === 'delete') removeFromList(msg.data.id);
}, ['todos']);
```

**Topic कसरी निर्धारण हुन्छ:**
```
URL: /api/todos       → topic: 'api/todos'
URL: /api/products    → topic: 'api/products'
URL: /api/users/posts → topic: 'api/users/posts'
```

### ९.२ एउटा पनि extra backend code छैन!
पहिले (पुरानो तरिका):
```js
// ❌ हरेक route मा manually broadcast लेख्नु पर्थ्यो
app.post('/api/todos', async (ctx) => {
  const todo = await db.create(ctx.body);
  rt.broadcast('todos', { action: 'create', data: todo }); // ← extra line
  return todo;
});
```

अब (Dolphin Reactive Routes):
```js
// ✅ CRUD router मात्र — broadcast automatic!
app.use('/api/todos', createCrudRouter(db, 'Todo'));
```

### ९.३ Specific Route मा बन्द गर्ने
```js
// Password change जस्ता sensitive routes मा broadcast गर्दैन
app.post('/api/auth/change-password', async (ctx) => {
  ctx.state.noReactive = true;  // ← यो route मा broadcast बन्द
  await changePassword(ctx.user, ctx.body);
  return { success: true };
});
```

### ९.४ Global मा बन्द गर्ने
```js
// Server setup मा
const app = createDolphinServer({
  realtime: rt,
  autoReactive: false,  // सबै routes मा बन्द
});
```

---

## १०. SSE Fallback — Auto Fallback

WebSocket काम नगरेमा (corporate firewall, old browsers) Dolphin Client ले **automatically** Server-Sent Events (SSE) मा switch गर्छ। तपाईंलाई केही थाहा नपाइ!

### १०.१ Transparent Fallback
```js
// Code exactly उही रहन्छ — transport automatically select हुन्छ
const client = new DolphinClient('http://localhost:3000', 'device-001');
await client.connect(); // WS try → fail भए SSE use

const transport = client.getTransport(); // 'websocket' वा 'sse'
console.log(`Using: ${transport}`);
```

### १०.२ SSE Endpoint
```
Server-Sent Events endpoint:
GET /realtime/sse?deviceId=device-001&token=JWT_TOKEN

Response headers:
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### १०.३ SSE vs WebSocket फरक

| | WebSocket | SSE |
|---|---|---|
| Direction | Bidirectional (दुवैतर्फ) | Server → Client मात्र |
| Reconnect | Manual | Automatic |
| Browser Support | 97%+ | 98%+ |
| Firewall | कहिलेकाहीं block | हमेसा काम |
| Dolphin Use | Default | Fallback |

### १०.४ Force SSE use गर्ने
```js
const client = new DolphinClient('http://localhost:3000', 'device-001', {
  transport: 'sse',  // WebSocket try नगरी सिधै SSE
});
```

---

## ११. Hookless DOM Binding

JavaScript नलेखी HTML `data-*` attributes मात्र प्रयोग गरेर API data HTML मा bind गर्न सकिन्छ।

### ११.१ Setup
```html
<head>
  <script src="./dolphin-client.js"></script>
  <script>
    window.dolphin = new DolphinClient('http://localhost:3000', 'browser-001');
    dolphin.initDOM(); // DOM binding activate गर्ने
  </script>
</head>
```

### ११.२ API Data देखाउने (`data-api-get`)
```html
<!-- /api/products बाट data ल्याएर template मा render गर्छ -->
<ul
  data-api-get="/api/products"
  data-rt-bind="/api/products"
  data-rt-template="<li>{{name}} — Rs.{{price}}</li>">
  <!-- यहाँ automatically <li> हरू आउँछन् -->
</ul>
```

### ११.३ Form Submit (JavaScript बिना)
```html
<!-- Login form — एकै line JavaScript छैन! -->
<form
  data-api-submit="POST /api/auth/login"
  data-api-redirect="/dashboard">
  <input type="email" name="email" placeholder="Email" required />
  <input type="password" name="password" placeholder="Password" required />
  <button type="submit">Login</button>
</form>
```

```html
<!-- Register form -->
<form
  data-api-submit="POST /api/auth/register"
  data-api-redirect="/login"
  data-api-success-msg="Account बन्यो! Login गर्नुहोस्।">
  <input type="text" name="name" placeholder="पूरा नाम" required />
  <input type="email" name="email" placeholder="Email" required />
  <input type="password" name="password" placeholder="Password" required />
  <button type="submit">Register</button>
</form>
```

### ११.४ Button Click API
```html
<!-- Logout button -->
<button
  data-api-click="POST /api/auth/logout"
  data-api-redirect="/login">
  Logout
</button>

<!-- Delete button -->
<button
  data-api-click="DELETE /api/todos/{{id}}"
  data-api-reload="true"
  data-api-confirm="साँच्चिकै मेट्ने?">
  Delete
</button>
```

### ११.५ Context Binding (Rich UI)
```html
<!-- User profile — context binding सँग -->
<div data-rt-bind="auth/user" data-rt-type="context">

  <!-- Image attribute -->
  <img data-rt-attr="src:avatarUrl, alt:name" />

  <!-- Text content -->
  <h2>स्वागत छ, <span data-rt-text="name"></span>!</h2>

  <!-- HTML content -->
  <div data-rt-html="bioHtml"></div>

  <!-- Conditional show/hide -->
  <span data-rt-if="isAdmin" class="badge">Admin</span>
  <p data-rt-hide="isBanned">✅ Account active छ।</p>

  <!-- Dynamic CSS class -->
  <div data-rt-class="online:isOnline, offline:isOffline">
    Status indicator
  </div>

</div>
```

### ११.६ Two-Way Realtime Input
```html
<!-- टाइप गर्दा-गर्दै realtime publish हुन्छ -->
<input
  type="text"
  name="message"
  data-rt-push="chat/typing"
  placeholder="केही टाइप गर्नुहोस्..." />
```

---

## १२. React Integration

### १२.१ Setup
```bash
npm install dolphin-client
```

```tsx
// lib/dolphin.ts — singleton client
import { DolphinClient } from 'dolphin-client';

export const client = new DolphinClient(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  typeof window !== 'undefined'
    ? (localStorage.getItem('deviceId') || crypto.randomUUID())
    : 'server',
);
```

### १२.२ Custom Hook बनाउने
```tsx
// hooks/useRealtime.ts
import { useEffect, useState } from 'react';
import { client } from '../lib/dolphin';

export function useRealtime<T>(
  initialState: T[],
  topics: string[]
) {
  const [data, setData] = useState<T[]>(initialState);

  useEffect(() => {
    const stop = client.connectRealtime((msg) => {
      if (msg.action === 'create') {
        setData(prev => [...prev, msg.data]);
      } else if (msg.action === 'update') {
        setData(prev => prev.map(item =>
          (item as any).id === msg.data.id ? msg.data : item
        ));
      } else if (msg.action === 'delete') {
        setData(prev => prev.filter(item =>
          (item as any).id !== msg.data.id
        ));
      }
    }, topics);

    return stop; // cleanup
  }, []);

  return data;
}
```

### १२.३ Component मा Use गर्ने
```tsx
// components/TodoList.tsx
import { client } from '../lib/dolphin';
import { useRealtime } from '../hooks/useRealtime';

export default function TodoList({ initialTodos }) {
  // Realtime updates automatically आउँछ!
  const todos = useRealtime(initialTodos, ['api/todos']);

  const addTodo = async (title: string) => {
    await client.api.todos.post({ title });
    // ← Reactive Routes ले automatically broadcast गर्छ
    // useRealtime hook ले automatically list update गर्छ
    // manual setState() लेख्नु पर्दैन!
  };

  const deleteTodo = async (id: string) => {
    await client.api.todos.delete(id);
    // automatically list बाट हट्छ!
  };

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          {todo.title}
          <button onClick={() => deleteTodo(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

### १२.४ Auth Hook
```tsx
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { client } from '../lib/dolphin';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await client.auth.login(email, password);
    setUser(result.user);
    return result;
  };

  const logout = async () => {
    await client.auth.logout();
    setUser(null);
  };

  return { user, loading, login, logout };
}
```

---

## १३. File Upload/Download

### १३.१ File Upload
```js
// HTML file input बाट
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

const result = await client.files.upload(file, {
  topic: 'user-avatars',    // realtime progress topic
  onProgress: (percent) => {
    console.log(`Upload: ${percent}%`);
    progressBar.style.width = `${percent}%`;
  }
});

console.log('Uploaded:', result.url);
```

### १३.२ Realtime File Transfer (pubFile)
```js
// sender
await client.rt.pubFile('user/123/document', largeFile, {
  chunkSize: 64 * 1024,  // 64KB chunks
  onProgress: (sent, total) => {
    console.log(`${sent}/${total} bytes`);
  }
});
```

```js
// receiver
client.rt.subFile('user/123/document', async (chunks, metadata) => {
  const blob = new Blob(chunks, { type: metadata.mimeType });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = metadata.name;
});
```

---

## १४. Pub/Sub — Real-time Messaging

### १४.१ Subscribe गर्ने
```js
// callback, topic
const unsub = client.subscribe('chat/room1', (payload, topic) => {
  console.log(`[${topic}]`, payload);
  // payload = { message: 'Hello!', from: 'Ram', ts: 1234... }
});

// Unsubscribe
unsub();
```

### १४.२ Publish गर्ने
```js
client.publish('chat/room1', {
  message: 'नमस्ते! म नयाँ member हुँ।',
  from: 'Ram',
  ts: Date.now(),
});
```

### १४.३ Wildcard Subscribe
```js
// chat/room1, chat/room2, chat/support — सबै
client.subscribe('chat/+', (payload, topic) => {
  const room = topic.split('/')[1];
  appendMessage(room, payload);
});

// notification/ अन्तर्गत सबै topics
client.subscribe('notification/#', (payload) => {
  showNotification(payload);
});
```

### १४.४ Specific Device मा पठाउने
```js
// एउटै user को device लाई private message
client.rt.sendTo('device-456', {
  type: 'private_message',
  message: 'यो तिमीलाई मात्र',
});
```

---

## १५. Push Notifications (Client-side)

### १५.१ Browser Notification Permission
```js
const granted = await client.notifications.requestPermission();
if (granted) {
  console.log('✅ Notifications enabled');
}
```

### १५.२ Realtime Event मा Notification देखाउने
```js
client.connectRealtime((msg) => {
  if (msg.action === 'create' && msg.topic === 'api/orders') {
    // Browser notification
    client.notifications.show({
      title: '🛒 नयाँ Order!',
      body: `Order #${msg.data.orderNumber} आयो`,
      icon: '/logo.png',
      onClick: () => {
        window.location.href = `/orders/${msg.data.id}`;
      }
    });
  }
}, ['api/orders']);
```

### १५.३ Custom Sound सहित
```js
client.notifications.show({
  title: '💬 नयाँ Message',
  body: 'Ram ले message गर्यो',
  sound: '/notification.mp3',  // sound play हुन्छ
});
```

---

## १६. Error Handling

### १६.१ HTTP Errors
```js
try {
  const user = await client.api.users.get({ id: '123' });
} catch (err) {
  switch(err.status) {
    case 401:
      console.log('Login चाहिन्छ');
      window.location = '/login';
      break;
    case 403:
      console.log('Permission छैन');
      break;
    case 404:
      console.log('User भेटिएन');
      break;
    case 429:
      console.log('धेरै request — पछि try गर्नुहोस्');
      break;
    case 500:
      console.log('Server error');
      break;
    default:
      console.error('Unknown error:', err.message);
  }
}
```

### १६.२ Global Error Handler
```js
// सबै API errors यहाँ catch हुन्छन्
client.on('error', (err) => {
  console.error('Dolphin error:', err);
  if (err.status === 401) {
    // Redirect to login
    window.location = '/login';
  }
});
```

### १६.३ Validation Errors (422)
```js
try {
  await client.api.todos.post({ title: '' }); // empty title
} catch (err) {
  if (err.status === 422) {
    // Validation errors
    err.errors.forEach(e => {
      console.log(`${e.field}: ${e.message}`);
      // title: "Title required छ"
    });
  }
}
```

---

## १७. TypeScript Support (.d.ts)

### १७.१ Auto-generated Types
```bash
npx dolphin generate-client --url=http://localhost:3000 --out=./src/sdk.js
```

यसले `sdk.d.ts` पनि बनाउँछ जसमा सबै API endpoints को types हुन्छन्:

```typescript
// Generated sdk.d.ts (auto — edit नगर्नुहोस्!)
export declare class DolphinClient {
  api: {
    todos: {
      get(options?: { params?: { status?: string; limit?: number } }): Promise<Todo[]>;
      post(data: CreateTodoDto): Promise<Todo>;
      put(id: string, data: UpdateTodoDto): Promise<Todo>;
      delete(id: string): Promise<void>;
    };
    users: {
      get(): Promise<User[]>;
      get(options: { id: string }): Promise<User>;
    };
    // ... सबै routes
  };
  auth: {
    login(email: string, password: string): Promise<AuthResult>;
    register(data: RegisterDto): Promise<AuthResult>;
    logout(): Promise<void>;
    me(): Promise<User>;
    getToken(): string | null;
    isLoggedIn(): boolean;
  };
}
```

### १७.२ Manual Types
```typescript
// types/dolphin.ts
interface Todo {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  userId: string;
}

interface RealtimeMsg<T = any> {
  action: 'create' | 'update' | 'delete';
  data: T;
  topic: string;
  timestamp: number;
}

// Usage
client.connectRealtime((msg: RealtimeMsg<Todo>) => {
  const todo: Todo = msg.data; // fully typed!
}, ['api/todos']);
```

---

## १८. DOLPHIN_GENERATE_KEY — SDK Security

Production मा SDK generator endpoint सुरक्षित गर्नु अत्यन्त जरुरी छ।

### १८.१ Server मा Key set गर्ने
```env
# .env
DOLPHIN_GENERATE_KEY=my-super-secret-sdk-key-2026
```

### १८.२ Client (CLI) मा Key pass गर्ने
```bash
npx dolphin generate-client \
  --url=https://api.myapp.com \
  --out=./src/sdk.js \
  --key=my-super-secret-sdk-key-2026
```

### १८.३ Key बिना के हुन्छ?
```bash
# Key बिना request गरेमा:
curl https://api.myapp.com/dolphin-client.js
# 403 Forbidden
# {"error": "SDK generation requires authorization key"}
```

### १८.४ Key कहाँ राख्ने?
```bash
# CI/CD environment variable मा राख्नुहोस्
# GitHub Actions:
secrets.DOLPHIN_GENERATE_KEY

# Deployment script:
DOLPHIN_GENERATE_KEY=$SECRET npm run gen-sdk
```

> ⚠️ **कहिल्यै नगर्नुहोस्:** Key लाई frontend code मा hardcode, git commit, वा public URL मा expose।

---

## १९. Complete Real App Example

### Todo App — Full Realtime (HTML + JavaScript)

```html
<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8">
  <title>🐬 Dolphin Todo App</title>
  <script src="./dolphin-client.js"></script>
  <style>
    body { font-family: sans-serif; max-width: 500px; margin: 50px auto; }
    .todo-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; }
    .badge { background: green; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    #status { color: #999; font-size: 12px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>🐬 Dolphin Todo</h1>

  <!-- Login Section -->
  <div id="loginSection">
    <h3>Login</h3>
    <input id="email" type="email" placeholder="Email" value="test@test.com" />
    <input id="password" type="password" placeholder="Password" value="Test1234!" />
    <button id="loginBtn">Login</button>
  </div>

  <!-- App Section (hidden until login) -->
  <div id="appSection" style="display:none">
    <p id="status">⚡ Connecting...</p>
    <div id="userInfo"></div>

    <h3>Todos</h3>
    <form id="addForm">
      <input id="todoInput" type="text" placeholder="नयाँ todo..." required />
      <button type="submit">थप्ने</button>
    </form>

    <ul id="todoList"></ul>
  </div>

  <script>
    // ── Setup ──────────────────────────────────────────────────
    const deviceId = localStorage.getItem('dId') || crypto.randomUUID();
    localStorage.setItem('dId', deviceId);

    const client = new DolphinClient('http://localhost:3000', deviceId, {
      autoConnect: false,
      debug: false,
    });

    // ── Helpers ────────────────────────────────────────────────
    const todoList = document.getElementById('todoList');
    const statusEl = document.getElementById('status');
    let todos = [];

    function renderTodos() {
      todoList.innerHTML = todos.map(t => `
        <li class="todo-item" data-id="${t.id}">
          <span>${t.title}</span>
          <button onclick="deleteTodo('${t.id}')">🗑</button>
        </li>
      `).join('');
    }

    async function deleteTodo(id) {
      await client.api.todos.delete(id);
      // Realtime ले automatically remove गर्छ
    }

    // ── Login ──────────────────────────────────────────────────
    document.getElementById('loginBtn').addEventListener('click', async () => {
      try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const result = await client.auth.login(email, password);
        document.getElementById('userInfo').textContent =
          `👤 ${result.user.name} (${result.user.email})`;

        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('appSection').style.display = 'block';

        // Connect realtime (JWT automatically included)
        await client.connect();
        statusEl.textContent = `✅ Connected via ${client.getTransport()}`;

        // Initial load
        todos = await client.api.todos.get();
        renderTodos();

        // Realtime subscription
        client.connectRealtime((msg) => {
          if (msg.action === 'create') {
            todos = [...todos, msg.data];
          } else if (msg.action === 'update') {
            todos = todos.map(t => t.id === msg.data.id ? msg.data : t);
          } else if (msg.action === 'delete') {
            todos = todos.filter(t => t.id !== msg.data.id);
          }
          renderTodos();
        }, ['api/todos']);

      } catch (err) {
        alert('Login असफल: ' + err.message);
      }
    });

    // ── Add Todo ────────────────────────────────────────────────
    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('todoInput').value.trim();
      if (!title) return;

      await client.api.todos.post({ title });
      // Reactive Routes ले automatically 'api/todos' topic मा broadcast गर्छ
      // connectRealtime callback ले automatically list update गर्छ
      document.getElementById('todoInput').value = '';
    });

    // ── Connection Events ───────────────────────────────────────
    client.on('disconnect', () => {
      statusEl.textContent = '❌ Disconnected — reconnecting...';
    });

    client.on('reconnect', (attempt) => {
      statusEl.textContent = `🔄 Reconnecting (attempt ${attempt})...`;
    });

    client.on('connect', () => {
      statusEl.textContent = `✅ Connected via ${client.getTransport()}`;
    });
  </script>
</body>
</html>
```

---

## २०. Common Bugs र Fixes

### ❌ Bug १: CORS Error
```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:5173' blocked
```
**Fix:** Server मा CORS enable गर्नुहोस्:
```js
// app.js
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
```

### ❌ Bug २: WebSocket 401 — Token Invalid
```
WebSocket connection to 'ws://...' failed: Error during WebSocket handshake: 401
```
**Fix:** Login पहिले, connect पछि:
```js
// ❌ WRONG
await client.connect();
await client.auth.login(...);

// ✅ CORRECT
await client.auth.login(...);
await client.connect(); // token automatically included
```

### ❌ Bug ३: Realtime Events आउँदैन
```js
// ❌ WRONG — topics array नदिएमा कुनै message आउँदैन
client.connectRealtime(onMessage, ['wrong-topic']);

// ✅ CORRECT — exact topic match गर्नुपर्छ
// URL: /api/todos → topic: 'api/todos' (slash include!)
client.connectRealtime(onMessage, ['api/todos']);
```

### ❌ Bug ४: generate-client 403 Error
```
Error: 403 Forbidden — SDK generation requires authorization key
```
**Fix:** `--key` flag थप्नुहोस्:
```bash
npx dolphin generate-client --url=http://localhost:3000 --out=./sdk.js --key=your_key
```

### ❌ Bug ५: Token Expire — Auto Logout हुन्छ
**Fix:** Token refresh handle गर्नुहोस्:
```js
client.on('tokenExpired', async () => {
  try {
    await client.auth.refresh();
  } catch {
    window.location = '/login';
  }
});
```

### ❌ Bug ६: Memory Leak — Unsubscribe नगरेको
```js
// ❌ WRONG — component unmount मा unsubscribe नगरेको
useEffect(() => {
  client.connectRealtime(onMessage, ['todos']);
}, []);

// ✅ CORRECT — cleanup return गर्ने
useEffect(() => {
  const stop = client.connectRealtime(onMessage, ['todos']);
  return stop; // React ले unmount मा call गर्छ
}, []);
```

---

## 📋 Quick Reference

```js
// Setup
const client = new DolphinClient(serverUrl, deviceId, options);

// Auth
await client.auth.register({ name, email, password });
await client.auth.login(email, password);
await client.auth.logout();
const me = await client.auth.me();

// HTTP
await client.api.todos.get();
await client.api.todos.get({ id });
await client.api.todos.post(data);
await client.api.todos.put(id, data);
await client.api.todos.patch(id, data);
await client.api.todos.delete(id);

// Realtime
await client.connect();
const stop = client.connectRealtime(callback, ['topic1', 'topic2']);
client.subscribe('topic', callback);
client.publish('topic', data);

// Status
client.isConnected();
client.getTransport(); // 'websocket' | 'sse'
client.auth.isLoggedIn();
client.auth.getToken();

// Events
client.on('connect', fn);
client.on('disconnect', fn);
client.on('error', fn);
client.on('reconnect', fn);
```

---

**बधाई छ! 🎉🐬**  
अब तपाईंले Dolphin Client SDK को सम्पूर्ण शक्ति बुझ्नुभयो।  
नेपालबाट विश्वस्तरको realtime application बनाउनुहोस्!

**Happy Coding! 🇳🇵**
