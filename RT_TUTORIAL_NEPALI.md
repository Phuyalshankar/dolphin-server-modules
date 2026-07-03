# 🐬 Dolphin Realtime (RT) — सम्पूर्ण Tutorial (नेपालीमा)
**Version: 2.14.1 | RealtimeCore v2 | 100% Nepali**

---

## 📚 सामग्री तालिका

1. [Realtime के हो?](#१-realtime-के-हो)
2. [Setup](#२-setup)
3. [publish — message पठाउने](#३-publish--message-पठाउने)
4. [subscribe / unsubscribe](#४-subscribe--unsubscribe)
5. [broadcast — सबैलाई पठाउने](#५-broadcast--सबैलाई-पठाउने)
6. [sendTo — Direct Device](#६-sendto--एउटै-device-लाई-पठाउने)
7. [Device Management](#७-device-management)
8. [pubPush / subPull — IoT](#८-pubpush--subpull--high-frequency-iot)
9. [pubFile / subFile — File Transfer](#९-pubfile--subfile--file-transfer)
10. [P2P Pass](#१०-p2p-pass--peer-to-peer)
11. [ACL — Access Control](#११-acl--access-control)
12. [Redis Scaling](#१२-redis-scaling--multiple-servers)
13. [Plugins — Custom Protocols](#१३-plugins--custom-protocols)
14. [Raw WebSocket Protocol](#१४-raw-websocket-browser)
15. [DolphinClient — Frontend RT](#१५-dolphinclient-frontend-realtime)
16. [Complete Chat App Example](#१६-complete-chat-app)
17. [Common Bugs & Fixes](#१७-common-bugs--fixes)

---

## १. Realtime के हो?

Dolphin Realtime (**RealtimeCore v2**) एउटा **WebSocket-based Pub/Sub system** हो। यसले:

- ✅ **MQTT-style topic wildcards** (`#`, `+`) support गर्छ
- ✅ **High-frequency IoT data** buffering (pubPush/subPull)
- ✅ **File transfer** chunked streaming (resume support सहित)
- ✅ **P2P relay** — server मार्फत peer-to-peer data
- ✅ **ACL** — कुन device ले कुन topic access गर्न सक्छ
- ✅ **Redis scaling** — multiple servers बीच sync
- ✅ **Custom binary protocols** (Modbus, HL7, etc.)

**कहाँ use गर्ने?**
- Chat applications
- Live dashboards
- IoT sensor data
- Real-time notifications
- Video streaming signaling
- Collaborative tools (Google Docs जस्तो)

---

## २. Setup

```bash
# Install
npm install dolphin-server-modules mongoose
```

```js
// app.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createRealtimeCore } from 'dolphin-server-modules/realtime';

// ─── RealtimeCore बनाउने ───────────────────────────────────
const rt = createRealtimeCore({
  maxMessageSize: 1024 * 1024,  // 1MB per message (default)
  debug: false,                  // true भए verbose logs
  
  // Optional: Redis URL (multiple servers को लागि)
  // redisUrl: process.env.REDIS_URL,
});

// ─── Server मा RT attach गर्ने ────────────────────────────
const app = createDolphinServer({ realtime: rt });

app.listen(3000, () => {
  console.log('🐬 Server + Realtime चलिरहेको छ!');
});
```

```bash
node app.js
# 🐬 Server + Realtime चलिरहेको छ!
```

**Client कनेक्ट गर्ने URL:**
```
ws://localhost:3000/realtime?deviceId=YOUR_DEVICE_ID
```

> ⚠️ **deviceId** अनिवार्य छ — हरेक client ले unique deviceId दिनुपर्छ।

---

## ३. publish — Message पठाउने

**Server → Client(s) मा message पठाउने:**

```js
// Basic publish
rt.publish('chat/room1', {
  message: 'नमस्ते!',
  from: 'server',
  ts: Date.now(),
});

// Nested topics
rt.publish('users/123/notifications', {
  type: 'alert',
  text: 'तपाईंको profile update भयो।',
});

// System-wide message
rt.publish('system/announcement', {
  text: 'Server 5 मिनेटमा restart हुन्छ।',
  severity: 'warning',
});
```

**Topic Naming Convention:**
```
namespace/subtopic/id
chat/room1
users/123/notifications
sensors/device-001/temperature
system/status
```

---

## ४. subscribe / unsubscribe

**Server-side ले topics सुन्ने:**

```js
// Exact topic match
rt.subscribe('chat/room1', (data, topic) => {
  console.log(`[${topic}]`, data);
});

// Single-level wildcard (+) — एउटा level मात्र
rt.subscribe('users/+/notifications', (data, topic) => {
  const userId = topic.split('/')[1];
  console.log(`User ${userId} को notification:`, data);
});

// Multi-level wildcard (#) — सबै sub-topics
rt.subscribe('chat/#', (data, topic) => {
  console.log(`Chat message [${topic}]:`, data.message);
});

// Sensor सबै
rt.subscribe('sensors/#', (data, topic) => {
  console.log(`Sensor data:`, data);
});

// Unsubscribe
const handler = (data) => console.log(data);
rt.subscribe('news/breaking', handler);
rt.unsubscribe('news/breaking', handler);
```

**Wildcard Reference:**

| Pattern | Match गर्छ | Match गर्दैन |
|---------|-----------|------------|
| `chat/#` | `chat/room1`, `chat/room1/sub` | `news/xyz` |
| `users/+/msg` | `users/123/msg`, `users/abc/msg` | `users/123/456/msg` |
| `#` | सबै topics | — |

---

## ५. broadcast — सबैलाई पठाउने

**सबै connected devices लाई message:**

```js
// सबैलाई
rt.broadcast({ type: 'server_message', text: 'Welcome!' });

// Specific topic मा subscribe गरेकालाई
rt.publish('announcements/all', {
  title: 'New Feature!',
  body: 'Realtime v2 launch भयो।',
});
```

---

## ६. sendTo — एउटै Device लाई पठाउने

**Specific device लाई direct message:**

```js
// deviceId थाहा छ भने
rt.sendTo('device-mobile-001', 'chat/private', {
  from: 'admin',
  message: 'तपाईंको account suspend भएको छ।',
  ts: Date.now(),
});

// Notification पठाउने
rt.sendTo('user-phone-xyz', 'notifications', {
  type: 'push',
  title: 'नयाँ message',
  body: 'Ram ले message पठायो।',
});
```

---

## ७. Device Management

**Connected devices हेर्ने र manage गर्ने:**

```js
// सबै connected devices list
const devices = rt.getDevices();
console.log(devices);
// ['browser-001', 'mobile-abc', 'iot-sensor-1', ...]

// Specific device छ/छैन check
const isOnline = rt.isDeviceConnected('browser-001');
console.log(isOnline); // true / false

// Device को metadata set गर्ने (custom data store)
rt.setDeviceMetadata('mobile-abc', {
  userId: '64abc123...',
  userName: 'Ram Bahadur',
  platform: 'Android',
  appVersion: '2.1.0',
  joinedAt: Date.now(),
});

// Metadata पढ्ने
const meta = rt.getDeviceMetadata('mobile-abc');
console.log(meta.userName); // 'Ram Bahadur'

// Device kick गर्ने (disconnect)
rt.kickDevice('spammer-device-001', 'Spam activity detected');

// Device events
rt.on('deviceConnected', (deviceId) => {
  console.log(`✅ ${deviceId} connected`);
  rt.setDeviceMetadata(deviceId, { connectedAt: Date.now() });
});

rt.on('deviceDisconnected', (deviceId) => {
  console.log(`❌ ${deviceId} disconnected`);
});
```

---

## ८. pubPush / subPull — High-Frequency IoT

**IoT sensors, live tracking को लागि।** Server ले data buffer मा store गर्छ — client ले historical data माग्न सक्छ।

```js
// ─── Server: High-freq data push ─────────────────────────
// IoT sensor बाट आएको data publish गर्ने (buffer मा store)
rt.pubPush('sensors/temp-001', {
  deviceId: 'temp-001',
  temperature: 25.4,
  humidity: 65.2,
  ts: Date.now(),
});

// हरेक second temperature update
setInterval(() => {
  rt.pubPush('sensors/temp-001', {
    temperature: 20 + Math.random() * 10,
    ts: Date.now(),
  });
}, 1000);

// ─── Server: Historical data माग्ने ──────────────────────
// पछिल्लो 50 readings
const history = rt.subPull('sensors/temp-001', 50);
console.log(history); // [ {data: ..., ts: ...}, ... ]
```

**Client (Browser) बाट:**
```js
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=dashboard-001');

ws.onopen = () => {
  // Subscribe to live updates
  ws.send(JSON.stringify({ type: 'sub', topic: 'sensors/temp-001' }));

  // Request last 50 historical readings
  ws.send(JSON.stringify({ type: 'sub_pull', topic: 'sensors/temp-001', count: 50 }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'message') {
    // Live update
    updateChart(msg.payload);
  } else if (msg.type === 'PULL_DATA') {
    // Historical batch
    initChart(msg.data);
  } else if (msg.type === 'PULL_EMPTY') {
    console.log('Buffer empty — कुनै data छैन');
  }
};
```

**Buffer Configuration:**
```js
const rt = createRealtimeCore({
  maxBufferPerTopic: 200,  // Topic प्रति max 200 messages buffer (default: 100)
});
```

---

## ९. pubFile / subFile — File Transfer

**Server → Client मा large files chunk गरेर पठाउने:**

```js
// ─── Server: File register र serve ───────────────────────
import fs from 'fs';

// File register गर्ने
rt.pubFile(
  'report-jan-2026',           // fileId (unique)
  '/path/to/reports/jan.pdf',  // file path
  {
    chunkSize: 64 * 1024,      // 64KB chunks (default)
    name: 'january-report.pdf',
    // hash: optional checksum for integrity
  }
);

// File available announce गर्ने (सबैलाई)
rt.publish('files/available', {
  fileId: 'report-jan-2026',
  name: 'January Report 2026',
  size: fs.statSync('/path/to/reports/jan.pdf').size,
});

// Specific device लाई file serve गर्ने
rt.subFile('device-mobile-001', 'report-jan-2026', 0); // chunk 0 बाट start
```

**Resume Support:**
```js
// Client ले कुन chunk सम्म पाइसक्यो?
const lastChunk = rt.getFileProgress('device-mobile-001', 'report-jan-2026');
console.log(`Last received chunk: ${lastChunk}`);

// Resume बाट serve गर्ने
rt.resumeFile('device-mobile-001', 'report-jan-2026');
```

**Client (Browser) बाट download:**
```js
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=browser-down');

let chunks = [];
let totalChunks = 0;

ws.onopen = () => {
  // File request गर्ने
  ws.send(JSON.stringify({
    type: 'sub_file',
    fileId: 'report-jan-2026',
    startChunk: 0  // 0 बाट start (resume को लागि last chunk)
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'FILE_CHUNK') {
    totalChunks = msg.totalChunks;
    chunks[msg.chunkIndex] = msg.data;

    // Progress
    const progress = Math.round((msg.chunkIndex + 1) / totalChunks * 100);
    console.log(`Download: ${progress}%`);

  } else if (msg.type === 'FILE_COMPLETE') {
    console.log('✅ Download complete!');
    // chunks जोड्ने र file save/display गर्ने
    const fileData = chunks.join('');
    // further processing...
  }
};
```

---

## १०. P2P Pass — Peer-to-Peer

**Server ले client-to-client data relay गर्छ (WebRTC signaling alternative):**

```js
// P2P enable गर्ने
const rt = createRealtimeCore({ enableP2P: true });

// File seeder ले announce गर्ने
rt.announceToPeers('big-video-2026', 'device-seeder');
// → सबैलाई 'p2p/announce' topic मा PEER_AVAILABLE message जान्छ

// कुन devices मा file छ?
const peers = rt.getPeersForFile('big-video-2026');
console.log(peers); // ['device-seeder', 'device-xyz']

// Peer बाट chunk माग्ने
rt.requestFromPeer('device-downloader', 'device-seeder', 'big-video-2026', 3);
// → device-seeder लाई P2P_REQUEST message जान्छ

// Peer-to-peer data relay (server pass-through)
rt.sendToPeer('device-a', 'device-b', {
  chunk: 3,
  data: 'base64encodeddata...',
  fileId: 'big-video-2026',
});
```

---

## ११. ACL — Access Control

**कुन device ले कुन topic access गर्न सक्छ:**

```js
const rt = createRealtimeCore({
  acl: {
    canSubscribe: (deviceId, topic) => {
      // Admin ले सबै
      if (deviceId.startsWith('admin-')) return true;

      // User ले आफ्नै namespace
      if (topic.startsWith(`user/${deviceId}/`)) return true;

      // Public topics
      if (topic.startsWith('public/')) return true;
      if (topic === 'system/status') return true;

      return false; // बाँकी deny
    },

    canPublish: (deviceId, topic) => {
      // Admin ले जतापनि publish
      if (deviceId.startsWith('admin-')) return true;

      // User ले आफ्नै namespace मात्र
      if (topic.startsWith(`user/${deviceId}/`)) return true;

      // Chat room publish (subscribe गरेको भए)
      if (topic.startsWith('chat/room')) return true;

      return false;
    },
  },
});
```

**Auth-based ACL (JWT verify गरेर):**
```js
import { verifyToken } from 'dolphin-server-modules/auth';

const rt = createRealtimeCore({
  acl: {
    canSubscribe: async (deviceId, topic) => {
      // deviceId = JWT token (client ले ?deviceId=token पठाउँछ)
      try {
        const user = await verifyToken(deviceId, process.env.JWT_SECRET);
        if (user.role === 'admin') return true;
        return topic.startsWith(`user/${user.id}/`);
      } catch {
        return false; // Invalid token — deny
      }
    },
    canPublish: async (deviceId, topic) => {
      try {
        const user = await verifyToken(deviceId, process.env.JWT_SECRET);
        return topic.startsWith(`user/${user.id}/`);
      } catch {
        return false;
      }
    },
  },
});
```

---

## १२. Redis Scaling — Multiple Servers

**Multiple server instances बीच messages sync गर्ने:**

```bash
npm install ioredis
```

```js
// Server 1 (port 3000) — same Redis URL
const rt1 = createRealtimeCore({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Server 2 (port 3001) — same Redis URL
const rt2 = createRealtimeCore({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Server 1 मा publish → Server 2 का subscribers ले पनि पाउँछन्!
// Automatic — कुनै code change चाहिँदैन
rt1.publish('chat/room1', { message: 'Hello from server 1!' });
```

**`.env`:**
```env
REDIS_URL=redis://localhost:6379
# वा Redis Cloud:
REDIS_URL=redis://default:password@redis-xyz.cloud.redislabs.com:12345
```

**Deployment Architecture:**
```
Load Balancer (Nginx)
    ├── Server 1 (port 3000) ──┐
    ├── Server 2 (port 3001) ──┤── Redis ──── All sync
    └── Server 3 (port 3002) ──┘
```

---

## १३. Plugins — Custom Protocols

**Binary protocols (Modbus, HL7, MQTT raw, custom IoT):**

```js
// Custom sensor protocol plugin
const sensorProtocol = {
  name: 'my-sensor-protocol',

  // यो plugin कहिले activate हुन्छ?
  match: (ctx) => ctx.raw && ctx.raw[0] === 0xAA, // Magic byte check

  // Binary → Object decode गर्ने
  decode: (buf) => ({
    deviceId: buf.readUInt16BE(1),
    temperature: buf.readInt16BE(3) / 100,
    humidity: buf.readUInt16BE(5) / 100,
    timestamp: Date.now(),
  }),

  // Object → Binary encode गर्ने
  encode: (data) => {
    const buf = Buffer.alloc(7);
    buf[0] = 0xAA;                                        // Magic byte
    buf.writeUInt16BE(data.deviceId, 1);                  // 2 bytes
    buf.writeInt16BE(Math.round(data.temperature * 100), 3); // 2 bytes
    buf.writeUInt16BE(Math.round(data.humidity * 100), 5);   // 2 bytes
    return buf;
  },

  // Decoded message handle गर्ने
  onMessage: (ctx) => {
    const sensor = ctx.payload;
    // Server side topic मा publish गर्ने
    ctx.publish(`sensors/${sensor.deviceId}/data`, sensor);
    console.log(`Sensor ${sensor.deviceId}: ${sensor.temperature}°C`);
  },
};

// Plugin register गर्ने
rt.use(sensorProtocol);
```

---

## १४. Raw WebSocket (Browser)

**Library बिना browser बाट connect गर्ने:**

```js
const ws = new WebSocket('ws://localhost:3000/realtime?deviceId=browser-001');

ws.onopen = () => {
  console.log('✅ Connected to Dolphin Realtime!');

  // ─── Subscribe ────────────────────────────────────────
  ws.send(JSON.stringify({ type: 'sub', topic: 'chat/room1' }));
  ws.send(JSON.stringify({ type: 'sub', topic: 'notifications' }));

  // ─── Publish ──────────────────────────────────────────
  ws.send(JSON.stringify({
    type: 'pub',
    topic: 'chat/room1',
    payload: { message: 'नमस्ते!', from: 'Ram', ts: Date.now() }
  }));

  // ─── High-frequency push ──────────────────────────────
  ws.send(JSON.stringify({
    type: 'pub_push',
    topic: 'sensors/temp',
    payload: { value: 25.4, ts: Date.now() }
  }));

  // ─── Historical data माग्ने ───────────────────────────
  ws.send(JSON.stringify({
    type: 'sub_pull',
    topic: 'sensors/temp',
    count: 20
  }));

  // ─── File download ────────────────────────────────────
  ws.send(JSON.stringify({
    type: 'sub_file',
    fileId: 'monthly-report-2026',
    startChunk: 0
  }));

  // ─── Unsubscribe ──────────────────────────────────────
  ws.send(JSON.stringify({ type: 'unsub', topic: 'chat/room1' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'message':      // Normal pub/sub message
      console.log(`[${msg.topic}]`, msg.payload);
      break;

    case 'PULL_DATA':    // subPull response (historical data)
      console.log('Historical data:', msg.data);
      initDashboard(msg.data);
      break;

    case 'PULL_EMPTY':   // Buffer empty
      console.log('No historical data for:', msg.topic);
      break;

    case 'FILE_CHUNK':   // File transfer chunk
      console.log(`Chunk ${msg.chunkIndex + 1}/${msg.totalChunks}`);
      saveChunk(msg.chunkIndex, msg.data);
      break;

    case 'FILE_COMPLETE': // Download finished
      console.log('✅ Download complete!');
      assembleFile();
      break;

    case 'PEER_AVAILABLE': // P2P peer found
      console.log('Peer available:', msg.deviceId, 'has', msg.fileId);
      break;

    case 'P2P_REQUEST':  // Peer wants a chunk
      sendChunkToPeer(msg.requesterId, msg.chunkIndex);
      break;

    case 'KICK':         // Server ले kick गर्यो
      console.log('Kicked:', msg.message);
      ws.close();
      break;

    default:
      console.log('Unknown message type:', msg.type, msg);
  }
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  // Reconnect logic यहाँ लेख्नुहोस्
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

---

## १५. DolphinClient — Frontend Realtime

**Node.js वा Browser मा ready-made client library:**

```bash
npm install dolphin-client
```

```js
import { DolphinClient } from 'dolphin-client';

const dolphin = new DolphinClient('http://localhost:3000', 'my-device-001', {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 2000,
  debug: false,
  wsHeartbeat: 30_000,
});

await dolphin.connect();
```

### Pub/Sub

```js
// Subscribe — MQTT wildcards support
dolphin.subscribe('chat/room1', (payload, topic) => {
  displayMessage(payload);
});

dolphin.subscribe('user/+/update', (payload, topic) => {
  const userId = topic.split('/')[1];
  updateUserProfile(userId, payload);
});

// Publish — offline भए queue मा राख्छ, reconnect भएपछि flush
dolphin.publish('chat/room1', {
  message: 'नमस्ते!',
  from: 'Ram',
  ts: Date.now(),
});

// Unsubscribe
const handler = (payload) => console.log(payload);
dolphin.subscribe('news/#', handler);
dolphin.unsubscribe('news/#', handler);
```

### High-Frequency IoT

```js
// Fast sensor push
dolphin.pubPush('sensors/gps', {
  lat: 27.7172,
  lng: 85.3240,
  speed: 45,
  ts: Date.now(),
});

// Historical data माग्ने
dolphin.subPull('sensors/gps', 30); // पछिल्लो 30 readings
```

### File Transfer

```js
// File Upload (Browser → Server)
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

await dolphin.pubFile(
  'user-upload-' + Date.now(),  // unique fileId
  file,                          // Blob | ArrayBuffer | Uint8Array
  file.name,                     // filename
  (progress) => {               // 0-100
    progressBar.style.width = progress + '%';
    console.log(`Upload: ${progress}%`);
  }
);

// File Download (Server → Client)
dolphin.subFile('monthly-report-2026');  // chunk 0 बाट start

// Resume download
dolphin.resumeFile('monthly-report-2026');

// Progress tracking
dolphin.saveFileProgress('monthly-report-2026', 42); // chunk 42 सम्म downloaded

// New file available notification
dolphin.onFileAvailable((meta) => {
  console.log(`New file: ${meta.name} (${meta.size} bytes)`);
  confirmDownload(meta);
});
```

### Hookless DOM Binding

```html
<!-- Script load -->
<script src="/dolphin-client.js"></script>
<script>
  window.dolphin = new DolphinModule.DolphinClient('http://localhost:3000');
  dolphin.connect();
</script>

<!-- Realtime list — server ले rt.publish('products/list', [...]) गर्दा update -->
<ul data-api-get="/api/products"
    data-rt-bind="/api/products"
    data-rt-template="<li>{{title}} — Rs.{{price}}</li>">
</ul>

<!-- Context binding -->
<div data-rt-bind="auth/user" data-rt-type="context">
  <img data-rt-attr="src:avatarUrl, alt:name" />
  <h2>स्वागत छ, <span data-rt-text="name"></span>!</h2>
  <button data-rt-if="isAdmin">Admin Panel</button>
  <p data-rt-hide="isVerified">Email verify गर्नुहोस्!</p>
</div>

<!-- Realtime input push — टाइप गर्दा publish हुन्छ -->
<input type="text"
       name="message"
       data-rt-push="chat/typing"
       placeholder="टाइप गर्नुहोस्..." />

<!-- Form → RT Publish (API होइन, WebSocket) -->
<form data-rt-submit="chat/room1">
  <input name="message" placeholder="Message..." />
  <button>Send</button>
</form>
```

---

## १६. Complete Chat App

### Backend

```js
// chat-server.js
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createRealtimeCore } from 'dolphin-server-modules/realtime';
import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { connectDB } from './adapters/connection.js';
import { db } from './adapters/db.js';

const rt = createRealtimeCore({ debug: false });
const app = createDolphinServer({ realtime: rt });

connectDB(process.env.MONGO_URI);

const auth = createDolphinAuthController(db, {
  jwtSecret: process.env.JWT_SECRET,
  secureCookies: process.env.NODE_ENV === 'production',
});

// Auth routes
app.post('/api/auth/register', auth.register);
app.post('/api/auth/login', auth.login);
app.get('/api/auth/me', auth.requireAuth, auth.me);

// Chat message API (store in DB + broadcast)
app.post('/api/chat/message', auth.requireAuth, (ctx) => {
  const { room, message } = ctx.body;
  const user = ctx.req.user;

  const msg = {
    id: Date.now().toString(),
    from: user.email,
    message,
    ts: new Date().toISOString(),
  };

  // WebSocket मार्फत सबैलाई broadcast
  rt.publish(`chat/${room}`, msg);

  return { success: true, message: msg };
});

// Online users
app.get('/api/chat/online', (ctx) => {
  return { users: rt.getDevices() };
});

// Device events
rt.on('deviceConnected', (deviceId) => {
  rt.publish('system/presence', { event: 'join', deviceId, ts: Date.now() });
});

rt.on('deviceDisconnected', (deviceId) => {
  rt.publish('system/presence', { event: 'leave', deviceId, ts: Date.now() });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.log(`🐬 Chat Server port ${PORT} मा चलिरहेको छ!`));
```

### Frontend (HTML)

```html
<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8" />
  <title>Dolphin Chat 🐬</title>
</head>
<body>
  <div id="messages"></div>

  <form id="loginForm">
    <input type="email" id="email" placeholder="Email" required />
    <input type="password" id="password" placeholder="Password" required />
    <button type="submit">Login</button>
  </form>

  <div id="chatArea" style="display:none">
    <input type="text" id="msgInput" placeholder="Message..." />
    <button onclick="sendMsg()">Send</button>
    <div id="onlineCount"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/dolphin-client/dist/dolphin-client.js"></script>
  <script>
    const dolphin = new DolphinModule.DolphinClient('http://localhost:3000');
    const room = 'general';

    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;

      const result = await dolphin.auth.login(email, pass);
      if (result.accessToken) {
        await dolphin.connect();

        // Chat messages subscribe गर्ने
        dolphin.subscribe(`chat/${room}`, (msg) => {
          addMessage(msg.from, msg.message, msg.ts);
        });

        // Presence track गर्ने
        dolphin.subscribe('system/presence', (data) => {
          console.log(`${data.deviceId} ${data.event}ed`);
        });

        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('chatArea').style.display = 'block';
      }
    };

    async function sendMsg() {
      const msg = document.getElementById('msgInput').value.trim();
      if (!msg) return;

      await dolphin.api.request('POST', '/api/chat/message', { room, message: msg });
      document.getElementById('msgInput').value = '';
    }

    function addMessage(from, text, ts) {
      const div = document.getElementById('messages');
      div.innerHTML += `<p><strong>${from}</strong>: ${text} <small>${new Date(ts).toLocaleTimeString()}</small></p>`;
      div.scrollTop = div.scrollHeight;
    }

    // Enter key support
    document.getElementById('msgInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMsg();
    });
  </script>
</body>
</html>
```

---

## १७. Common Bugs & Fixes

### ❌ Bug 1: deviceId नदिने

```
ws://localhost:3000/realtime  ← ❌ WRONG — deviceId छैन

ws://localhost:3000/realtime?deviceId=my-device-001  ← ✅ CORRECT
```

### ❌ Bug 2: Topic names मा space दिने

```js
rt.publish('chat room 1', data);  // ❌ WRONG — space छैन

rt.publish('chat/room1', data);   // ✅ CORRECT — / use गर्ने
```

### ❌ Bug 3: Wildcard गलत प्रयोग

```js
rt.subscribe('chat/*', handler);  // ❌ WRONG — * Dolphin मा छैन

rt.subscribe('chat/#', handler);  // ✅ CORRECT — MQTT wildcards # र + use गर्ने
```

### ❌ Bug 4: Redis connect नहुँदा crash

```js
// ❌ WRONG — Redis URL गलत
const rt = createRealtimeCore({ redisUrl: 'redis://wrong-host' });

// ✅ CORRECT — Redis optional छ
const rt = createRealtimeCore({
  redisUrl: process.env.REDIS_URL, // undefined भए Redis skip गर्छ
});
```

### ❌ Bug 5: Server restart भएपछि subscribers हराउँछन्

```js
// ✅ FIX: Clients ले reconnect भएपछि re-subscribe गर्नुपर्छ
dolphin.on('reconnected', () => {
  dolphin.subscribe('chat/room1', handleMessage);
  dolphin.subscribe('notifications', handleNotification);
  console.log('Re-subscribed after reconnect!');
});
```

### ❌ Bug 6: File transfer incomplete

```js
// ✅ FIX: Resume support प्रयोग गर्नुहोस्
ws.onclose = () => {
  // Reconnect भएपछि resume गर्ने
  ws.send(JSON.stringify({
    type: 'sub_file',
    fileId: 'monthly-report-2026',
    startChunk: lastReceivedChunk + 1  // last saved chunk
  }));
};
```

---

## थप Resources

| Resource | Link |
|----------|------|
| Main Tutorial (Nepali) | [TUTORIAL_NEPALI.md](./TUTORIAL_NEPALI.md) |
| AI Tutorial (Nepali) | [AI_TUTORIAL_NEPALI.md](./AI_TUTORIAL_NEPALI.md) |
| Client Tutorial | [CLIENT_TUTORIAL_NEPALI.md](./CLIENT_TUTORIAL_NEPALI.md) |
| GitHub | [github.com/Phuyalshankar/dolphin-server-modules](https://github.com/Phuyalshankar/dolphin-server-modules) |

---

**Happy Coding! 🇳🇵🐬**  
*Dolphin RealtimeCore v2 — Nepal को IoT, Chat, र Live dashboards को लागि।*
