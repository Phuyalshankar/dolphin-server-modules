# Dolphin Framework: 0 to 100% Full Tutorial (Nepali) 🐬 [v1.7.0]

Dolphin Framework मा तपाईँलाई स्वागत छ! यो गाइडमा हामी Dolphin प्रयोग गरेर एउटा शक्तिशाली, छिटो र आधुनिक API कसरी बनाउने भनेर सुरुदेखि अन्त्यसम्म सिक्नेछौँ।

---

## १. Dolphin के हो? (Introduction)

**Dolphin** एउटा "Zero-Dependency" ब्याकइन्ड फ्रेमवर्क हो। यो Node.js को नेटिभ `http` मोड्युलमा बनेको छ, जसले गर्दा यसको स्पिड एकदमै धेरै छ।

**मुख्य विशेषताहरू:**
- **Zero-Dependency Core**: बाहिरी भारी लाइब्रेरीहरू प्रयोग नगरी नेटिभ Node.js मा आधारित।
- **Ultra-Fast**: एक्सप्रेस (Express) भन्दा धेरै गुणा छिटो।
- **100% Modular**: तपाईँलाई जे चाहिन्छ, त्यही मात्र प्रयोग गर्न सकिन्छ (Auth, CRUD, Routing सबै छुट्टाछुट्टै छन्)।

---

## २. सुरुवाती सेटअप (Project Setup)

सबैभन्दा पहिले एउटा नयाँ फोल्डर बनाउनुहोस् र प्रोजेक्ट सुरु गर्नुहोस्:

```bash
# १. फोल्डर बनाउनुहोस् र भित्र जानुहोस्
mkdir my-dolphin-app && cd my-dolphin-app

# २. npm प्रोजेक्ट सुरु गर्नुहोस्
npm init -y

# ३. आवश्यक प्याकेजहरू इन्स्टल गर्नुहोस्
npm install dolphin-server-modules mongoose zod
```

---

## ३. पहिलो सर्भर (Hello World)

अब `index.ts` (वा `index.js`) फाइल बनाउनुहोस् र यो कोड राख्नुहोस्:

```typescript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// एउटा सामान्य गेट (GET) रूट (v1.4.7: अब सिधै डाटा रिटर्न गर्न सकिन्छ!)
app.get('/', (ctx) => {
  return { message: "Dolphin को संसारमा स्वागत छ! 🐬" };
});

// सर्भर सुन्न (Listen) सुरु गर्नुहोस्
app.listen(3000, () => {
  console.log("सर्भर http://localhost:3000 मा चलिरहेको छ!");
});
```

तपाईँको सर्भर अब तयार भयो! `npx ts-node index.ts` चलाएर चेक गर्न सक्नुहुन्छ।

---

## ४. Context (ctx) बुझ्ने

Dolphin मा हामी `req` र `res` को सट्टा `ctx` (Context) प्रयोग गर्छौँ। यसले कोडलाई सफा बनाउँछ।

- `ctx.req`: नेटिभ रिक्वेस्ट अब्जेक्ट।
- `ctx.json(data)`: JSON रेस्पोन्स पठाउन।
- `ctx.body`: पोस्ट (POST) फाइल वा डाटाहरु।
- `ctx.params`: URL बाट आउने प्यारामिटरहरू (जस्तै: `/users/:id`)।

---

## ५. राउटिङ र डाइनामिक प्यारामिटर (Routing)

Dolphin को राउटिङ एकदमै शक्तिशाली छ।

```typescript
// १. डाइनामिक आईडी लिने
app.get('/users/:id', (ctx) => {
  const userId = ctx.params.id;
  ctx.json({ id: userId, name: "Nepal User" });
});

// २. पोस्ट रिक्वेस्ट (Data पठाउन)
app.post('/create', (ctx) => {
  const data = ctx.body;
  ctx.json({ status: "Received", payload: data });
});
```

---

## ६. मिडलवेयर (Middleware)

मिडलवेयरले रिक्वेस्टलाई चेक वा मोडिफाइ गर्छ। Dolphin ले "Native Style" र "Express Style" दुवै सपोर्ट गर्छ।

```typescript
// Dolphin Style Middleware
app.use((ctx, next) => {
  console.log(`${ctx.req.method} अनुरोध आयो: ${ctx.req.url}`);
  next(); // अर्को स्टेपमा जानको लागि अनिवार्य छ
});

// Express Style (जस्तै: CORS)
import cors from 'cors';
app.use(cors()); // सिधै काम गर्छ!
```

---

## ७. डेटाबेस सेटअप (Mongoose Adapter)

Dolphin ले Mongoose सँग सजिलै काम गर्छ।

```typescript
import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

// १. स्किमा (Schema) बनाउनुहोस्
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// २. अड्याप्टर (Adapter) सेटअप गर्नुहोस्
const db = createMongooseAdapter({ User });
```

---

## ८. अथेन्टिकेसन (Auth Module)

सुरक्षित API को लागि Dolphin भित्रै `auth` मोड्युल छ।

```typescript
import { createAuth } from 'dolphin-server-modules/auth';

const auth = createAuth({ secret: 'MY_SECRET_KEY' });

// कुनै रूटलाई सुरक्षित बनाउन (v1.4.7: मिडलवेयर चेन सपोर्ट!)
app.get('/profile', auth.requireAuth, async (ctx) => {
  // यहाँ पुगेको युजर भेरिफाई भइसकेको हुन्छ
  return { user: ctx.req.user };
});
```

---

## ९. अटोमेटेड CRUD (Automated API)

Dolphin को सबैभन्दा राम्रो कुरा भनेको अटोमेटिक CRUD हो। तपाईँलाई कोड लेखिरहनु पर्दैन।

```typescript
// सबै युजरको CRUD अपरेसन अटोमेटिक बनाउनुहोस्
app.get('/api/users', async (ctx) => {
  const users = await db.User.find();
  ctx.json(users);
});
// वा Dolphin को CRUD कन्ट्रोलर प्रयोग गर्नुहोस्
```

---

## १०. भ्यालिडेसन (Zod Validation)

युजरले पठाएको डाटाहरू चेक गर्न Zod प्रयोग गर्नुहोस्।

```typescript
import { z } from 'zod';
import { validate } from 'dolphin-server-modules/middleware/zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

app.post('/register', validate(registerSchema), (ctx) => {
  ctx.json({ message: "Valid Data!" });
});
```

---

## ११. रियलटाइम र IoT (Realtime & IoT Core) [NEW]
Dolphin ले अब उच्च क्षमताको रियलटाइम कम्युनिकेसन सपोर्ट गर्छ।

```typescript
import { RealtimeCore, JSONPlugin } from 'dolphin-server-modules/realtime';

const rt = new RealtimeCore();
rt.use(JSONPlugin);

// टपिकहरूमा सब्सक्राइब (Subscribe) गर्नुहोस्
rt.subscribe('sensors/+', (ctx) => {
  console.log(`टपिक: ${ctx.topic}, डाटा:`, ctx.payload);
});

// पब्लिस (Publish) गर्नुहोस्
rt.publish('sensors/temp', { value: 24.5 });
```

---

## १२. इन्डिपेन्डेन्ट राउटिङ (Independent Routing) [NEW]
ठूला एप्लिकेसनहरूलाई व्यवस्थित गर्न अलग-अलग फाइलमा राउट्हरू राख्न सकिन्छ:

```typescript
// routes.ts
import { createDolphinRouter } from 'dolphin-server-modules/router';
export const apiRouter = createDolphinRouter();
apiRouter.get('/ping', (ctx) => ctx.json({ msg: 'pong' }));

// index.ts
import { apiRouter } from './routes';
app.use('/api', apiRouter); // Route अब /api/ping मा उपलब्ध छ
```

---

## १३. Universal Signaling (WebRTC & IoT) [NEW]
Dolphin v1.6.0 बाट नयाँ "Universal Signaling Module" थपिएको छ जसमा फोन, IoT र मेडिकल डिभाइस कन्ट्रोल गर्न सकिन्छ।

```typescript
import { createSignaling } from 'dolphin-server-modules/signaling';
const signaling = createSignaling(rt);

// IoT कमाण्ड पठाउन
await signaling.sendCommand('DoctorApp', 'Machine_01', { action: 'START' });
```

---

## १५. डल्फिन क्लाइन्ट लाइब्रेरी (Full-stack Client Library) [NEW]

डल्फिन सर्भरले अब आफैँ एउटा हलुका क्लाइन्ट लाइब्रेरी उपलब्ध गराउँछ। यसका लागि तपाईँले NPM इन्स्टल गर्नु पर्दैन।

### क. लाइब्रेरी लोड गर्ने
```html
<script src="/dolphin-client.js"></script>
```

### ख. प्रयोग गर्ने तरिका (API, Auth & Realtime)
```javascript
// १. अटो-इनिशियलाइज्ड 'dolphin' अब्जेक्ट प्रयोग गर्नुहोस्
async function setup() {
  // २. लगइन गर्ने
  await dolphin.auth.login("admin@test.com", "password");

  // ३. डेटा फेच गर्ने (अटोमेटिक टोकन म्यानेजमेन्ट)
  const products = await dolphin.api.get('/products');

  // ४. रियल-टाइम पब-सब (Pub/Sub)
  await dolphin.connect();
  dolphin.subscribe("alerts", (data) => console.log("Alert:", data));
}
```

---

## १६. अन्तिममा (Conclusion)

Dolphin Framework निकै छिटो र सजिलो छ। यसले तपाईँको ब्याकइन्ड डेभलपमेन्टको अनुभवलाई नयाँ उचाइमा पुर्‍याउँछ।

**थप जानकारीको लागि:**
- [Official Documentation](https://github.com/Phuyalshankar/dolphin-server-modules)
- माथिका सबै स्टेपहरू मिलाएर एउटा `app.ts` फाइल बनाउनुहोस् र रन गर्नुहोस्!

**Happy Coding in Nepali! 🇳🇵🐬**
