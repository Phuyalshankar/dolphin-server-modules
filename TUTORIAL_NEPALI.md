# Dolphin Framework: 0 to 100% Full Tutorial (Nepali) 🐬

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

// एउटा सामान्य गेट (GET) रूट
app.get('/', (ctx) => {
  ctx.json({ message: "Dolphin को संसारमा स्वागत छ! 🐬" });
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

// कुनै रूटलाई सुरक्षित बनाउन
app.get('/profile', auth.middleware(), (ctx) => {
  // यहाँ पुगेको युजर भेरिफाई भइसकेको हुन्छ
  ctx.json({ user: ctx.req.user });
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

## ११. अन्तिममा (Conclusion)

Dolphin Framework निकै छिटो र सजिलो छ। यसले तपाईँको ब्याकइन्ड डेभलपमेन्टको अनुभवलाई नयाँ उचाइमा पुर्‍याउँछ।

**थप जानकारीको लागि:**
- [Official Documentation](https://github.com/Phuyalshankar/dolphin-server-modules)
- माथिका सबै स्टेपहरू मिलाएर एउटा `app.ts` फाइल बनाउनुहोस् र रन गर्नुहोस्!

**Happy Coding in Nepali! 🇳🇵🐬**
