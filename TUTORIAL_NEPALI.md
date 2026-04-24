# Dolphin Framework: 0 to 100% Full Tutorial (Nepali) 🐬 [v2.2.5]

Dolphin Framework मा तपाईँलाई स्वागत छ! यो गाइडमा हामी Dolphin प्रयोग गरेर एउटा शक्तिशाली, छिटो र आधुनिक API कसरी बनाउने भनेर सुरुदेखि अन्त्यसम्म सिक्नेछौँ।

---

## १. Dolphin के हो? (Introduction)

**Dolphin** एउटा "Zero-Dependency" ब्याकइन्ड फ्रेमवर्क हो। यो Node.js को नेटिभ `http` मोड्युलमा बनेको छ, जसले गर्दा यसको स्पिड एकदमै धेरै छ र यो २०२६ को आधुनिक आवश्यकताहरूका लागि तयार छ।

**मुख्य विशेषताहरू:**
- **Ultra-Fast**: एक्सप्रेस (Express) भन्दा ५ गुणा सम्म छिटो।
- **Reactive Sync**: फ्रन्टइन्ड र ब्याकइन्डको डेटा अटोमेटिक सिङ्क हुने।
- **Offline Ready**: इन्टरनेट नहुँदा पनि डेटा सेभ गर्न मिल्ने (DolphinPersist)।
- **Modern CLI**: एकै मिनेटमा प्रोजेक्ट तयार गर्न मिल्ने।

---

## २. सुरुवाती सेटअप (Project Setup)

Dolphin v2.2.5 मा नयाँ CLI कमाण्डहरू थपिएका छन् जसले प्रोजेक्ट सुरु गर्न एकदमै सजिलो बनाउँछ:

```bash
# १. नयाँ फोल्डर बनाउनुहोस्
mkdir my-dolphin-app && cd my-dolphin-app

# २. डल्फिन प्रोजेक्ट सुरु गर्नुहोस् (ESM support सहित)
npx dolphin init

# ३. यदि तपाईंलाई 'Production' लेबलको फोल्डर स्ट्रक्चर चाहिन्छ भने:
npx dolphin init-prod
```

यसले अटोमेटिकल्ली `package.json`, `app.js` र आवश्यक कन्फिगरेसन फाइलहरू बनाइदिन्छ।

---

## ३. पहिलो सर्भर (Hello World)

अब `app.js` फाइलमा यो कोड राख्नुहोस् (हामी आधुनिक `import` सिन्ट्याक्स प्रयोग गर्छौं):

```javascript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

// एउटा सामान्य गेट (GET) रूट
app.get('/', (ctx) => {
  return { message: "Dolphin को संसारमा स्वागत छ! 🐬", version: "2.2.5" };
});

// सर्भर सुन्न (Listen) सुरु गर्नुहोस्
app.listen(3000, () => {
  console.log("सर्भर http://localhost:3000 मा चलिरहेको छ!");
});
```

---

## ४. DolphinStore: शक्तिशाली र रिएक्टिभ स्टोर [NEW v2.2.5]

Dolphin को नयाँ स्टोरले फ्रन्टइन्डमा डेटा म्यानेजमेन्टलाई एकदमै सजिलो बनाउँछ। यसले डेटा लोड हुँदैछ कि छैन (loading), सफल भयो कि भएन (success) र एरर आयो कि (error) भनेर अटोमेटिक जानकारी दिन्छ।

### क. स्टोर प्रयोग गर्ने तरिका
```html
<script src="/dolphin-client.js"></script>
<script>
  // १. स्टोरबाट कलेक्सन लिने
  const products = dolphin.store.products;

  // २. लोड स्टेट चेक गर्ने
  if (products.loading) console.log("डेटा लोड हुँदैछ...");
  
  // ३. डेटा आएपछि देखाउने
  if (products.success) {
      console.log("डेटा आयो:", products.items);
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
