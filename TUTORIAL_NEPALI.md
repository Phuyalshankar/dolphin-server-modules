# Dolphin Framework: 0 to 100% Full Tutorial (Nepali) 🐬 [v2.9.5]

Dolphin Framework मा तपाईँलाई स्वागत छ! यो गाइडमा हामी Dolphin प्रयोग गरेर एउटा शक्तिशाली, आधुनिक र एआई-संचालित (AI-Powered) ब्याकइन्ड कसरी बनाउने भनेर सिक्नेछौँ।

---

## १. Dolphin के हो? (Introduction)

**Dolphin** एउटा "Zero-Dependency" ब्याकइन्ड फ्रेमवर्क हो। यो २०२६ को आधुनिक आवश्यकताहरूका लागि तयार पारिएको छ। अहिले यसमा **Cursor-Level Agentic AI** थपिएको छ, जसले गर्दा तपाईँको कोडिङ अनुभव पूर्ण रूपमा बदलिनेछ।

**मुख्य विशेषताहरू:**
- **Advanced AI Agent**: प्रोजेक्ट बुझ्ने र आफैं कोड लेख्ने एजेन्ट।
- **Ultra-Fast**: एक्सप्रेस (Express) भन्दा ५ गुणा सम्म छिटो।
- **Multi-Model Support**: Gemini, Groq (Llama 3), र Local Ollama सपोर्ट।
- **ESM Ready**: आधुनिक `import/export` सिन्ट्याक्समा आधारित।

---

## २. सुरुवाती सेटअप र एआई (Project Setup & AI)

Dolphin v2.9.5 मा एआईको प्रयोग गरेर १ मिनेटमै प्रोजेक्ट तयार गर्न सकिन्छ:

```bash
# १. नयाँ फोल्डर बनाउनुहोस्
mkdir my-dolphin-app && cd my-dolphin-app

# २. एआई एजेन्ट सुरु गर्नुहोस् (Cursor Mode)
# यसले तपाईँको कुरा बुझ्छ र कोड लेख्न मद्दत गर्छ
npx dolphin chat

# ३. एआई मार्फत पूर्ण प्रोजेक्ट स्ट्रक्चर बनाउनुहोस्
npx dolphin generate-full "e-commerce backend with orders and mongoose"
```

---

## ३. एआई एजेन्टसँग कुरा गर्ने (Chatting with Agent)

Dolphin Agent ले अहिले **Roman Nepali** बुझ्छ। तपाईँले यसरी सोध्न सक्नुहुन्छ:

> "Hey Dolphin, `real-test` फोल्डरमा एउटा नयाँ `order.js` मोडल बनाइदेऊ र `app.js` मा त्यसको रुट थपिदेऊ।"

एजेन्टले तपाईँको प्रोजेक्टका सबै फाइलहरू हेर्छ र सिधै कोड अपडेट गरिदिन्छ। यसका लागि कुनै पनि `require` प्रयोग नगर्नुहोस्, सधैँ **`import`** प्रयोग गर्नुहोस्।

---

## ४. पहिलो सर्भर (Modern ESM Server)

हामी आधुनिक `import` सिन्ट्याक्स मात्र प्रयोग गर्छौं, किनभने `require` ले पुराना समस्याहरू निम्त्याउन सक्छ।

```javascript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// एउटा सामान्य गेट (GET) रूट
app.get('/', (ctx) => {
  return { 
    message: "Dolphin ko sansar ma swagat chha! 🐬", 
    version: "2.9.5",
    mode: "Agentic AI Ready"
  };
});

// सर्भर सुन्न (Listen) सुरु गर्नुहोस्
app.listen(3000, () => {
  console.log("Server http://localhost:3000 ma chaliraheko chha!");
});
```

---

## ५. एआई बिनाका शक्तिशाली कमाण्डहरू

यदि तपाईँलाई एआई प्रयोग गर्न मन छैन भने, डल्फिनमा पहिले देखि नै बनेका टेम्पलेटहरू प्रयोग गर्न सक्नुहुन्छ:

```bash
# अथेन्टिकेसन सिस्टम थप्न
npx dolphin add auth

# कुनै मोडलको लागि CRUD थप्न
npx dolphin add crud Product

# मङ्गोस (Mongoose) सेटअप गर्न
npx dolphin add adapter mongoose
```

---

## ६. लोकल एआई (Ollama Support) [NEW]

यदि तपाईँ आफ्नो डेटा क्लाउडमा पठाउन चाहनुहुन्न भने, आफ्नो कम्प्युटरमै **Ollama** चलाउन सक्नुहुन्छ। `.env` फाइलमा यो सेट गर्नुहोस्:

```env
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest
```

---

## ७. अन्तिममा (Conclusion)

Dolphin Framework अब एउटा सामान्य फ्रेमवर्क मात्र होइन, यो तपाईँको एउटा "एआई साथी" पनि हो। यसले तपाईँको कोडिङ स्पिड १० गुणा बढाउन मद्दत गर्छ।

**थप जानकारीको लागि:**
- [README.md](README.md) हेर्नुहोस्।
- [Dolphin Master Guide](DOLPHIN_MASTER_GUIDE_NEPALI.md) पढ्नुहोस्।

**Happy Coding in Nepali! 🇳🇵🐬**
sole.log("डेटा आयो:", products.items);
  }
</script>
```

### ख. फिल्टर र सर्टिङ (Filtering & Sorting)
तपाईंले स्टोरमै डेटा फिल्टर र सर्ट गर्न सक्नुहुन्छ, जुन एकदमै 'Reactive' हुन्छ:

```javascript
// १. मूल्य १००० भन्दा बढी भएका सामान मात्र फिल्टर गर्ने
dolphin.store.products.where(p => p.price > 1000);

// २. नामको आधारमा मिलाउने (A to Z)
dolphin.store.products.orderBy('name', 'asc');

// ३. सबै फिल्टर हटाउने
dolphin.store.products.clear();
```

---

## ५. DolphinPersist: अफलाइन क्यासिङ [NEW v2.2.5]

यदि तपाईं इन्टरनेट नहुँदा पनि आफ्नो डेटा स्टोरमा राखिरहन चाहनुहुन्छ भने `DolphinPersist` प्रयोग गर्नुहोस्।

```html
<script src="/dolphin-client.js"></script>
<script src="path/to/dolphin-persist.js"></script>

<script>
  // IndexedDB प्रयोग गरेर अफलाइन क्यासिङ सेट गर्ने
  const persist = new DolphinPersist({ driver: 'indexeddb' });
  enablePersist(dolphin.store, persist);
  
  // अब पेज रिफ्रेस गर्दा वा इन्टरनेट नहुँदा पनि पुरानो डेटा तुरुन्तै देखिन्छ।
</script>
```

---

## ६. अटोमेटेड CRUD (Mongoose सँग)

Dolphin ले डेटाबेससँग काम गर्न अटोमेटेड CRUD सुविधा दिन्छ।

```javascript
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { createCRUD } from 'dolphin-server-modules/curd';

// १. एड्याप्टर बनाउने
const db = createMongooseAdapter({ User, Product });

// २. CRUD सर्भिस सुरु गर्ने
const crud = createCRUD(db, { 
    enforceOwnership: false, // सबैका लागि खुला गर्न
    realtime: true           // रियल-टाइम सिङ्क इनेबल गर्न
});

// ३. रुटहरूमा जोड्ने
app.get('/products', async (ctx) => ctx.json(await crud.read('Product')));
```

---

## ७. अन्तिममा (Conclusion)

Dolphin Framework अब एउटा पूर्ण 'Full-stack' ब्याकइन्ड इकोसिस्टम बनेको छ। यसले ब्याकइन्डमा मात्र होइन, फ्रन्टइन्डको डेटा सिङ्क र अफलाइन म्यानेजमेन्टमा पनि मद्दत गर्छ।

**थप जानकारीको लागि:**
- [Official Documentation](https://github.com/Phuyalshankar/dolphin-server-modules)
- [README.md](README.md) हेर्नुहोस्।

**Happy Coding in Nepali! 🇳🇵🐬**
