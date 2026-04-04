# Dolphin Framework: Absolute Master Guide (100+ Pages Equivalent) 🐬🇳🇵

> **Latest Version:** v1.4.7+ | **Updated:** 2026-04-03 | **License:** MIT

यो डकुमेन्ट Dolphin Framework को आधिकारिक र विस्तृत गाइड हो। यसले तपाईँलाई एउटा साधारण कोड लेख्ने डेभलपरबाट "Framework Master" बनाउन मद्दत गर्नेछ।

---

## विषय सूची (Table of Contents)

- [०. परिचय र दर्शन](#०-परिचय-र-दर्शन)
- [१. सेटअप र वातावरण](#१-सेटअप-र-वातावरण)
- [२. कोर सर्भर इन्जिन](#२-कोर-सर्भर-इन्जिन)
- [३. Unified Context (ctx) Deep Dive](#३-unified-context-ctx-deep-dive)
- [४. एडभान्स्ड राउटिङ](#४-एडभान्स्ड-राउटिङ)
- [५. मिडलवेयर आर्किटेक्चर](#५-मिडलवेयर-आर्किटेक्चर)
- [६. डेटाबेस एड्याप्टर](#६-डेटाबेस-एड्याप्टर)
- [७. Auth मोड्युल मास्टरक्लास](#७-auth-मोड्युल-मास्टरक्लास)
- [८. अटोमेटेड CRUD इन्जिन](#८-अटोमेटेड-crud-इन्जिन)
- [९. Zod भ्यालिडेसन र सुरक्षा](#९-zod-भ्यालिडेसन-र-सुरक्षा)
- [१०. रियल-वर्ल्ड प्रोजेक्ट: DolphinStore API](#१०-रियल-वर्ल्ड-प्रोजेक्ट-dolphinstore-api)
- [११. स्केलिङ र पर्फर्मेन्स](#११-स्केलिङ-र-पर्फर्मेन्स)
- [१२. टेस्टिङ र डेभप्स](#१२-टेस्टिङ-र-डेभप्स)
- [१३. RealtimeCore: रियलटाइम पब/सब मास्टरक्लास](#१३-realtimecore-रियलटाइम-पबसब-मास्टरक्लास)
- [१४. इन्डिपेन्डेन्ट राउटिङ](#१४-इन्डिपेन्डेन्ट-राउटिङ)
- [१५. स्वतन्त्र अटो-स्वैगर जेनेरेसन](#१५-स्वतन्त्र-अटो-स्वैगर-जेनेरेसन)
- [१६. API रेफरेन्स](#१६-api-रेफरेन्स)

---

## ०. परिचय र दर्शन (Introduction & Philosophy)

### Dolphin किन जन्मियो?
ब्याकइन्ड डेभलपमेन्टको दुनियाँमा एक्सप्रेस (Express) सबैभन्दा लोकप्रिय छ। तर एक्सप्रेस पूरानो भइसक्यो। यसमा धेरै अनावश्यक वजन (Bloat) छ र यो मोडर्न एउटा (Modern) `async/await` सँग सधैँ राम्रोसँग काम गर्दैन।

**Dolphin को जन्म तीनवटा मुख्य कारणले भएको हो:**
1. **Native Speed**: कुनै पनि बाहिरी लाइब्रेरी बिना नेटिभ `http` मा चल्ने।
2. **Context-First**: `req` र `res` लाई एउटै 'Context' (ctx) मा मिलाएर कोडलाई सफा राख्ने।
3. **Total Modularity**: तपाईँले Auth चाहनुहुन्छ? Auth मोड्युल मात्र लोड गर्नुहोस्।

### पर्फर्मेन्स बेन्चमार्क
| Framework | Requests Per Second (RPS) | Latency (avg) |
| :--- | :--- | :--- |
| Express.js | ~15,000 | 10ms |
| Fastify | ~35,000 | 2ms |
| **Dolphin (v1.4.7+)** | **~45,000+** | **1.5ms** |

---

## १. सेटअप र वातावरण (Setup & Environment)

### १.१ आवश्यक चिजहरू (Prerequisites)
- **Node.js**: v18.x वा सोभन्दा माथि
- **TypeScript**: Dolphin टाइप-सेफ छ, त्यसैले TS सिफारिस गरिन्छ।

### १.२ प्रोजेक्ट सुरु गर्ने
```bash
mkdir dolphin-master-app && cd dolphin-master-app
npm init -y
npm install dolphin-server-modules mongoose zod ioredis
npm install -D typescript ts-node @types/node nodemon
१.३ TypeScript कन्फिगर (tsconfig.json)
json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
२. कोर सर्भर इन्जिन (Core Server Engine)
२.१ सर्भर कसरी बनाउने?
typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.listen(3000, () => {
  console.log("Dolphin Engine Active! 🐬");
});
३. Unified Context (ctx) Deep Dive
३.१ ctx भित्र के के हुन्छ?
typescript
app.get('/test', (ctx) => {
  // ctx.params, ctx.query, ctx.body, ctx.req, ctx.res
});
मुख्य प्रोपर्टीहरू:

ctx.req: नेटिभ http.IncomingMessage

ctx.params: URL प्यारामिटरहरू

ctx.query: Query String

ctx.body: POST/PUT डाटा

मुख्य मेथडहरू:

ctx.json(obj): JSON डाटा पठाउन

ctx.status(code): HTTP स्टेटस कोड

ctx.header(key, value): रेस्पोन्स हेडर

३.२ अटो-JSON रेस्पोन्स [v1.4.7]
typescript
// पुरानो:
app.get('/old', (ctx) => { ctx.json({ ok: true }); });

// नयाँ:
app.get('/new', (ctx) => { return { ok: true }; });
४. एडभान्स्ड राउटिङ (Advanced Routing)
typescript
// Static Route
app.get('/ping', (ctx) => ({ msg: 'pong' }));

// Dynamic Route
app.get('/users/:id', (ctx) => ({ userId: ctx.params.id }));

// Route Prefixing
app.group('/api/v1', (group) => {
  group.get('/users', (ctx) => ([]));
});
५. मिडलवेयर आर्किटेक्चर (Middleware Architecture)
typescript
// Global Middleware
app.use((ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  if (next) next();
});

// Multi-handler Support
const isAdmin = (ctx, next) => {
  if (ctx.req.user?.role === 'admin') next();
  else ctx.status(403).json({ error: "Denied" });
};

app.get('/admin', isAdmin, (ctx) => ({ message: "Welcome Admin" }));

// Express Middleware Compatible
import cors from 'cors';
app.use(cors());
६. डेटाबेस एड्याप्टर (Database Adapters)
typescript
import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

const User = mongoose.model('User', new mongoose.Schema({
  username: String, email: String
}));

const db = createMongooseAdapter({ User });

app.get('/users', async (ctx) => {
  return await db.User.find();
});
७. Auth मोड्युल मास्टरक्लास (Auth Module)
typescript
import { createAuth } from 'dolphin-server-modules/auth';

const auth = createAuth({
  secret: 'SUPER_SECRET_KEY',
  tokenExpiry: '1h',
  refreshExpiry: '7d'
});

// Protect routes
app.get('/dashboard', auth.middleware(), (ctx) => {
  return { user: ctx.req.user };
});

// 2FA Support
app.post('/auth/2fa/setup', auth.middleware(), async (ctx) => {
  return await auth.setup2FA(ctx.req.user.id);
});
८. अटोमेटेड CRUD इन्जिन (Automated CRUD)
typescript
import { createCrudController } from 'dolphin-server-modules/curd';

const userCrud = createCrudController(db.User);

app.get('/api/users', userCrud.getAll);
app.post('/api/users', userCrud.create);
app.get('/api/users/:id', userCrud.getOne);
app.put('/api/users/:id', userCrud.update);
app.delete('/api/users/:id', userCrud.delete);
९. Zod भ्यालिडेसन (Zod Validation)
typescript
import { z } from 'zod';
import { validate } from 'dolphin-server-modules/middleware/zod';

const UserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email()
});

app.post('/users', validate(UserSchema), (ctx) => {
  return { success: true, data: ctx.body };
});
१०. रियल-वर्ल्ड प्रोजेक्ट: DolphinStore API
typescript
// src/index.ts
import { createDolphinServer } from 'dolphin-server-modules/server';
import { createAuth } from 'dolphin-server-modules/auth';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCrudController } from 'dolphin-server-modules/curd';
import mongoose from 'mongoose';

const app = createDolphinServer();
const auth = createAuth({ secret: 'DOLPHIN_STORE_SECRET' });

const Product = mongoose.model('Product', new mongoose.Schema({
  name: String, price: Number, stock: { type: Number, default: 0 }
}));

const db = createMongooseAdapter({ Product });
const productCrud = createCrudController(db.Product);

app.get('/products', productCrud.getAll);
app.post('/products', auth.middleware(), productCrud.create);
app.get('/products/:id/stock', async (ctx) => {
  const product = await Product.findById(ctx.params.id);
  if (!product) return ctx.status(404).json({ error: "Not found" });
  return { stock: product.stock };
});

app.listen(8080, () => console.log("DolphinStore live on 8080! 🛒"));
११. स्केलिङ र पर्फर्मेन्स (Scaling)
typescript
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  os.cpus().forEach(() => cluster.fork());
} else {
  const app = createDolphinServer();
  app.listen(3000);
}
१२. टेस्टिङ र डेभप्स (Testing)
typescript
import request from 'supertest';
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();
app.get('/test', (ctx) => ({ ok: true }));

test('GET /test', async () => {
  const res = await request(app.server).get('/test');
  expect(res.body.ok).toBe(true);
});
१३. RealtimeCore: रियलटाइम पब/सब मास्टरक्लास (RealtimeCore)
RealtimeCore Dolphin को उच्च-प्रदर्शन युनिफाइड पब/सब बस हो। यो IoT डिभाइसहरू, वेबसकेटहरू, र माइक्रोसर्भिसहरू बीच रियलटाइम डाटा संचारको लागि डिजाइन गरिएको छ।

१३.१ RealtimeCore को मुख्य विशेषताहरू
Feature	Description
TopicTrie	O(L) समयमा टपिक म्याचिङ (वाइल्डकार्ड + स्ट्याटिक)
Retained Messages	अन्तिम मेसेज सम्झने क्षमता (MQTT जस्तै)
Redis Bridge	मल्टिपल सर्भरहरू बीच स्केलिङ
DJSON Integration	बाइनरी, हेक्स, बेस६४ डाटा अटो-डिकोड
JSON Cache	दोहोरिने पेलोडहरूको क्यासिङ (५ सेकेण्ड TTL)
ACL Support	डिभाइस-लेभल पब्लिस/सब्सक्राइब अनुमति
Plugins System	HL7, Modbus, MQTT जस्ता प्रोटोकलहरू थप्न
१३.२ स्थापना (Installation)
bash
npm install dolphin-server-modules ioredis
१३.३ आधारभूत प्रयोग (Basic Usage)
typescript
import { RealtimeCore } from 'dolphin-server-modules/realtime';

// RealtimeCore को इन्स्ट्यान्स बनाउने
const rt = new RealtimeCore({
  maxMessageSize: 512 * 1024,    // 512KB म्याक्स
  enableJSONCache: true,          // JSON क्यास सक्षम
  debug: true,                    // डिबग लग
  useBinaryProtocol: false        // बाइनरी प्रोटोकल प्रयोग
});

// टपिक सब्सक्राइब गर्ने (वाइल्डकार्ड + सपोर्ट)
rt.subscribe('sensors/temperature/+', (payload) => {
  console.log(`तापक्रम डाटा: ${payload.value}°C`);
});

// टपिकमा पब्लिस गर्ने
rt.publish('sensors/temperature/room1', { value: 23.5, unit: 'celsius' });

// रिटेन्ड मेसेज (नयाँ सब्सक्राइबरले पाउने)
rt.publish('config/system', { mode: 'active' }, { retain: true, ttl: 3600000 });
१३.४ वाइल्डकार्ड म्याचिङ (Wildcard Matching)
RealtimeCore ले MQTT-शैली वाइल्डकार्डहरू सपोर्ट गर्छ:

typescript
// + (सिङ्गल लेभल) - एउटा सेग्मेन्ट मात्र
rt.subscribe('sensors/+/temperature', (data) => {
  // म्याच: sensors/room1/temperature, sensors/room2/temperature
  // म्याच गर्दैन: sensors/room1/floor2/temperature
});

// # (मल्टी लेभल) - सबै सेग्मेन्टहरू
rt.subscribe('sensors/#', (data) => {
  // म्याच: sensors/temp, sensors/room1/humidity, sensors/building/floor/room/temp
});

// स्ट्याटिक टपिक (पूर्ण म्याच)
rt.subscribe('device/online', (data) => {
  // केवल device/online मात्र
});
१३.५ डिभाइस रजिस्ट्रेसन र सकेट ह्यान्डलिङ (Device Registration)
typescript
// WebSocket कनेक्सन ह्यान्डल गर्ने (उदाहरण: ws लाइब्रेरीसँग)
import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws, req) => {
  const deviceId = req.headers['device-id'] as string || `device-${Date.now()}`;
  
  // डिभाइस रजिस्टर गर्ने
  rt.register(deviceId, ws, { type: 'sensor', location: 'kathmandu' });
  
  // मेसेज ह्यान्डल गर्ने
  ws.on('message', async (data: Buffer) => {
    await rt.handle(data, ws, deviceId);
  });
  
  ws.on('close', () => {
    rt.unregister(deviceId);
  });
});

// सिग्नलिङ टपिकहरू अटोम्याटिक रूपमा बन्छन्:
// - phone/signaling/{deviceId} → डिभाइस-स्पेसिफिक
// - phone/signaling/all → सबै डिभाइसहरूमा ब्रोडकास्ट
१३.६ DJSON डाटा ह्यान्डलिङ (DJSON Data Handling)
RealtimeCore ले djson मार्फत बाइनरी, हेक्स, र बेस६४ डाटा अटो-डिकोड गर्छ:

typescript
// क्लाइन्टबाट पठाइएको डाटा (विभिन्न फर्म्याटमा)
// १. सामान्य JSON
rt.handle(Buffer.from(JSON.stringify({ 
  topic: 'sensor/data', 
  payload: { value: 42 } 
})));

// २. बेस६४-इन्कोडेड JSON
rt.handle(Buffer.from(JSON.stringify({
  raw: Buffer.from(JSON.stringify({ topic: 'test', payload: { x: 1 } })).toString('base64')
})));

// ३. हेक्स-इन्कोडेड डाटा
rt.handle(Buffer.from(JSON.stringify({
  _type: 'hex',
  raw: '7b22746f706963223a2274657374222c227061796c6f6164223a7b7d7d'
})));

// सबै केसहरूमा RealtimeCore ले आफै डिकोड गरेर publish गर्छ
१३.७ रेडिस स्केलिङ (Redis Scaling)
एकाधिक सर्भरहरू बीच मेसेज सिंक गर्न:

typescript
// सर्भर १
const rt1 = new RealtimeCore({ redisUrl: 'redis://localhost:6379' });

// सर्भर २ (अर्को मेसिनमा)
const rt2 = new RealtimeCore({ redisUrl: 'redis://localhost:6379' });

// rt1 मा पब्लिस गरेको मेसेज rt2 मा पुग्छ
rt1.publish('global/event', { message: 'Hello from Server 1' });
१३.८ एसीएल (Access Control List)
typescript
const rt = new RealtimeCore({
  acl: {
    canSubscribe: (deviceId, topic) => {
      // डिभाइसले केवल आफ्नै टपिकमा सब्सक्राइब गर्न पाउँछ
      return topic.startsWith(`devices/${deviceId}`) || topic === 'public/#';
    },
    canPublish: (deviceId, topic) => {
      // सेन्सर डिभाइसले sensors/ मात्र पब्लिस गर्न पाउँछ
      if (deviceId.startsWith('sensor-')) return topic.startsWith('sensors/');
      return true;
    }
  }
});
१३.९ प्लगिन सिस्टम (Plugin System)
typescript
import { RealtimePlugin, RealtimeContext } from 'dolphin-server-modules/plugins';

// MQTT प्लगिन बनाउने
const mqttPlugin: RealtimePlugin = {
  name: 'mqtt-bridge',
  match: (ctx) => ctx.raw[0] === 0x10, // MQTT CONNECT प्याकेट
  decode: (raw) => {
    // MQTT डिकोडिङ लजिक
    return { type: 'mqtt', payload: raw };
  },
  onMessage: (ctx) => {
    console.log('MQTT मेसेज आयो:', ctx.payload);
  }
};

rt.use(mqttPlugin);
१३.१० एपिआई रेफरेन्स (API Reference)
Constructor Options
typescript
interface RealtimeCoreConfig {
  maxMessageSize?: number;      // डिफल्ट: 256KB
  redisUrl?: string;             // Redis URL (ऐच्छिक)
  acl?: {                        // Access Control
    canSubscribe: (deviceId, topic) => boolean;
    canPublish: (deviceId, topic) => boolean;
  };
  enableJSONCache?: boolean;     // JSON क्यास सक्षम
  useBinaryProtocol?: boolean;   // बाइनरी प्रोटोकल
  debug?: boolean;               // डिबग मोड
}
Methods
Method	Description
subscribe(topic, fn, deviceId?)	टपिकमा सब्सक्राइब
publish(topic, payload, opts?, deviceId?)	टपिकमा पब्लिस
handle(raw, socket?, deviceId?)	कच्चा डाटा प्रोसेस
broadcast(topic, payload, opts?)	सबै डिभाइसमा पठाउने
register(deviceId, socket?, metadata?)	डिभाइस रजिस्टर
unregister(deviceId)	डिभाइस हटाउने
use(plugin)	प्लगिन थप्ने
getStats()	स्ट्याटिस्टिक्स
destroy()	सबै रिसोर्स क्लिनअप
१३.११ पूर्ण उदाहरण: IoT Sensor Platform
typescript
// iot-server.ts
import { RealtimeCore } from 'dolphin-server-modules/realtime';
import WebSocket from 'ws';

const rt = new RealtimeCore({
  maxMessageSize: 1024 * 1024,
  enableJSONCache: true,
  debug: process.env.NODE_ENV === 'development'
});

// तापक्रम डाटा प्रोसेसिङ
rt.subscribe('sensors/+/temperature', (data) => {
  if (data.value > 40) {
    console.warn(`उच्च तापक्रम अलर्ट! ${data.value}°C`);
    rt.publish('alerts/high-temp', { value: data.value, timestamp: Date.now() });
  }
});

// सबै सेन्सर डाटा लग गर्ने
rt.subscribe('sensors/#', (data, topic) => {
  console.log(`[${new Date().toISOString()}] ${topic}:`, data);
});

// WebSocket सर्भर
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const deviceId = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('id') 
    || `device-${Date.now()}`;
  
  rt.register(deviceId, ws, { ip: req.socket.remoteAddress });
  
  ws.on('message', (data) => rt.handle(data as Buffer, ws, deviceId));
  ws.on('close', () => rt.unregister(deviceId));
});

// हेल्थ चेक एन्डपोइन्ट
setInterval(() => {
  const stats = rt.getStats();
  console.log(`Realtime Stats: ${stats.devices} devices, ${stats.retained} retained`);
}, 30000);

process.on('SIGTERM', async () => {
  await rt.destroy();
  process.exit(0);
});

console.log('IoT Platform running on ws://localhost:8080');
१४. इन्डिपेन्डेन्ट राउटिङ (Independent Routing)
typescript
// userRoutes.ts
import { createDolphinRouter } from 'dolphin-server-modules/router';
export const userRouter = createDolphinRouter();

userRouter.get('/profile', (ctx) => ({ name: "Ram", email: "ram@example.com" }));
userRouter.post('/update', (ctx) => ({ success: true }));

// main.ts
import { createDolphinServer } from 'dolphin-server-modules/server';
import { userRouter } from './userRoutes';

const app = createDolphinServer();
app.use('/users', userRouter); // /users/profile, /users/update
१५. स्वतन्त्र अटो-स्वैगर जेनेरेसन (Auto-Swagger Generation)
typescript
import { z } from 'zod';
import { generateSwagger, serveSwaggerUI } from 'dolphin-server-modules/swagger';
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

const UserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  age: z.number().optional()
});

const apiDocs = generateSwagger({
  title: "DolphinStore API",
  version: "1.0.0",
  modules: [{
    path: "/users",
    method: "post",
    schema: UserSchema,
    summary: "Create new user",
    tags: ["Users"]
  }]
});

app.get('/docs', (ctx) => {
  const html = serveSwaggerUI(apiDocs, "DolphinStore API");
  return ctx.html(html);
});

app.get('/docs/json', (ctx) => ctx.json(apiDocs));
१६. API रेफरेन्स (API Reference)
Server
Method	Description
app.listen(port, cb)	सर्भर सुरु गर्ने
app.get/patch/post/put/delete(path, ...handlers)	HTTP मेथड
app.use(path?, middleware/router)	मिडलवेयर वा राउटर
app.group(prefix, callback)	रूट ग्रुपिङ
RealtimeCore
Method	Description
rt.subscribe(topic, fn, deviceId?)	सब्सक्राइब
rt.publish(topic, payload, opts?, deviceId?)	पब्लिस
rt.handle(raw, socket?, deviceId?)	डाटा ह्यान्डल
rt.register(deviceId, socket?, metadata?)	डिभाइस रजिस्टर
rt.destroy()	क्लिनअप
निष्कर्ष (Conclusion)
बधाई छ! तपाईँले Dolphin Framework को Master Guide पूरा गर्नुभयो। अब तपाईँ:

✅ हाई-पर्फर्मेन्स API सर्भर बनाउन

✅ अटोमेटेड CRUD र भ्यालिडेसन प्रयोग गर्न

✅ RealtimeCore सँग IoT र रियलटाइम एप्लिकेसन बनाउन

✅ Redis सँग मल्टिपल सर्भर स्केल गर्न

✅ अटो-जेनेरेटेड Swagger डकुमेन्टेसन बनाउन

सक्नुहुन्छ।

Happy Coding! 🐬🇳🇵
नेपालबाट विश्वस्तरको सफ्टवेयर बनाऔँ!

text

## 📄 PDF कसरी बनाउने?

### विधि १: VS Code (सजिलो)
1. माथिको कोडलाई `dolphin-master-guide.md` मा सेभ गर्नुहोस्
2. VS Code मा `Markdown PDF` एक्सटेन्सन इन्स्टल गर्नुहोस्
3. फाइलमा राइट क्लिक → `Markdown PDF: Export (pdf)`

### विधि २: कमान्ड लाइन (Pandoc)
```bash
pandoc dolphin-master-guide.md -o dolphin-framework-guide.pdf --pdf-engine=xelatex -V geometry:margin=1in