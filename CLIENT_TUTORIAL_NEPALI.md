# Dolphin Client - Frontend Tutorial (नेपालीमा)

Dolphin Client एउटा शक्तिशाली, "Hookless" र "Stateless" Frontend Framework हो, जसले तपाईंलाई React वा Vue जस्ता ठूला फ्रेमवर्कहरू बिना नै डाइन्यामिक र Realtime वेबसाइटहरू बनाउन मद्दत गर्छ। यसले सिधै HTML को `data-*` एट्रिब्युटहरू प्रयोग गरेर जादु गर्छ!

---

## १. सुरुवाती सेटअप (Initialization)

तपाईंको HTML पेजमा सबैभन्दा पहिले Dolphin Client लाई लोड गर्नुहोस्:

```html
<!-- Client लोड गर्नुहोस् -->
<script src="/scripts/client.js"></script>

<script>
  // सर्भरसँग कनेक्ट गर्नुहोस्
  window.dolphin = new DolphinModule.DolphinClient('http://localhost:3000');
  
  // Realtime WebSocket कनेक्ट गर्नुहोस् (आवश्यक भएमा)
  dolphin.connect();
</script>
```

---

## २. Hookless API Calls (विना JavaScript API कल)

तपाईंले कुनै पनि फर्म (Form) वा बटन (Button) बाट JavaScript नलेखीकनै API कल गर्न सक्नुहुन्छ।

### (क) Form Submit (डाटा पठाउने)
फर्म सबमिट गर्दा पेज रिलोड नहोस् र सिधै API मा डाटा जाओस् भन्ने चाहनुहुन्छ भने `data-api-submit` प्रयोग गर्नुहोस्।

```html
<form data-api-submit="POST /api/auth/login" data-api-redirect="/dashboard">
  <input type="email" name="email" placeholder="Email" />
  <input type="password" name="password" placeholder="Password" />
  <button type="submit">Login</button>
</form>
```
* **`data-api-redirect`**: API सफल भएपछि कुन पेजमा जाने भनेर तोक्छ।

### (ख) Button Click (क्लिक गर्दा API कल गर्ने)
कुनै बटन थिच्दा सिधै API कल गर्न:

```html
<button 
  data-api-click="POST /api/users/logout"
  data-api-reload="true">
  Logout
</button>
```
* **`data-api-reload`**: API सफल भएपछि पेज रिलोड गर्छ।

---

## ३. Realtime DOM Binding (HTML मा डाटाहरू देखाउने)

तपाईंले सर्भरबाट आएको डाटालाई सिधै HTML मा टाँस्न (Bind गर्न) सक्नुहुन्छ। यसका दुईवटा तरिकाहरू छन्:

### तरिका १: Template Binding (`data-rt-template`)
एउटै अब्जेक्ट वा Array (List) लाई लुप गरेर देखाउन यो प्रयोग गरिन्छ।

**Array को उदाहरण (List Rendering):**
```html
<!-- /api/users बाट आउने Array लाई आफैं Loop गर्छ -->
<ul 
  data-api-get="/api/users" 
  data-rt-bind="/api/users" 
  data-rt-template="<li>नाम: {{name}} (उमेर: {{age}})</li>">
  <!-- यहाँ भित्र आफैं <li> हरू बन्नेछन् -->
</ul>
```

### तरिका २: Context Binding (`data-rt-type="context"`) 🔥
यो सबैभन्दा शक्तिशाली तरिका हो! ठूलो डिजाइन छ र भित्र-भित्र गएर डाटा राख्नुछ भने यो प्रयोग गरिन्छ। यसले React को Context API जस्तै काम गर्छ।

```html
<div class="user-profile" data-rt-bind="auth/user" data-rt-type="context">
  
  <!-- १. Attributes चेन्ज गर्ने (src र alt) -->
  <img data-rt-attr="src:avatarUrl, alt:name" />
  
  <!-- २. Text चेन्ज गर्ने -->
  <h2>स्वागत छ, <span data-rt-text="name"></span>!</h2>
  
  <!-- ३. HTML चेन्ज गर्ने (यदि HTML नै छ भने) -->
  <div data-rt-html="bioHtml"></div>

</div>
```
*जब `auth/user` को डाटा आउँछ, Dolphin ले आफैं भित्रका ट्यागहरूमा डाटा भर्दिन्छ!*

---

## ४. Advanced Features (सर्त अनुसार काम गर्ने)

Context Binding सँगै हामीले React/Vue जस्तै सर्त (Condition) लगाएर डिजाइन परिवर्तन गर्न सक्छौं।

### (क) Conditional Rendering (`data-rt-if` र `data-rt-hide`)
डाटामा कुनै कुरा True छ वा False छ भनेर ट्यागलाई देखाउने वा लुकाउने:

```html
<div data-rt-bind="auth/user" data-rt-type="context">
  
  <!-- यदि isAdmin = true छ भने मात्र यो बटन देखिन्छ -->
  <button data-rt-if="isAdmin">Delete User</button>
  
  <!-- यदि isBanned = true छ भने यो लुक्छ (display: none हुन्छ) -->
  <p data-rt-hide="isBanned">तपाईंको एकाउन्ट सुरक्षित छ।</p>
  
</div>
```

### (ख) Dynamic CSS Classes (`data-rt-class`)
डाटाको अवस्था हेरेर CSS क्लासहरू थप्ने वा हटाउने:

```html
<div data-rt-bind="system/status" data-rt-type="context">
  
  <!-- यदि isOnline=true छ भने 'bg-green' क्लास थपिन्छ, false भए हट्छ -->
  <!-- यदि isOffline=true छ भने 'bg-red' क्लास थपिन्छ -->
  <div data-rt-class="bg-green:isOnline, bg-red:isOffline">
    सिस्टम स्ट्याटस इन्डिकेटर
  </div>
  
</div>
```

---

## ५. Realtime Input (Two-Way Typing)

तपाईंले इनपुट बक्समा टाइप गर्दा-गर्दै त्यो डाटा WebSocket मार्फत सर्भरमा पठाउन वा अरूलाई देखाउन सक्नुहुन्छ:

```html
<input 
  type="text" 
  name="message" 
  data-rt-push="chat/typing" 
  placeholder="टाइप गर्नुहोस्..." />
```
*यसले टाइप गर्ने बित्तिकै `chat/typing` टपिकमा डाटा Publish गर्छ।*

---

**बधाई छ! 🎉** अब तपाईंले Dolphin Client को "Stateless" आर्किटेक्चर प्रयोग गरेर विना कुनै झन्झटिलो JavaScript कोड, एकदमै छिटो र रियलटाइम वेब एप्लिकेसन बनाउन सक्नुहुन्छ!

---

## ६. Auto-Generated Client SDK (स्वचालित Client SDK बनाउने)

Dolphin Framework ले तपाईंको API अनुसार स्वचालित रूपमा एउटा JavaScript Client SDK बनाइदिन्छ। यसले गर्दा तपाईंले API कल गर्न म्यानुअल `fetch` लेख्नु पर्दैन।

### SDK डाउनलोड गर्ने तरिका (CLI प्रयोग गरेर)

तलको कमाण्ड चलाउनुहोस्:

```bash
npx dolphin generate-client --url=http://localhost:4000 --out=./dolphin-client.js --key=your_key
```

* **`--url`**: तपाईंको Dolphin सर्भरको ठेगाना।
* **`--out`**: SDK फाइल कहाँ सेभ गर्ने।
* **`--key`**: सुरक्षाका लागि सिक्रेट Key (तलको `DOLPHIN_GENERATE_KEY` सेक्सन हेर्नुहोस्)।

यो कमाण्ड चलाएपछि दुईवटा फाइलहरू बन्छन्:
* **`dolphin-client.js`**: मुख्य SDK फाइल।
* **`dolphin-client.d.ts`**: TypeScript प्रयोगकर्ताहरूका लागि Type Definitions।

### HTML मा SDK प्रयोग गर्ने

```html
<!-- SDK लोड गर्नुहोस् -->
<script src="./dolphin-client.js"></script>

<script>
  // SDK आफैं सर्भरसँग कनेक्ट हुन्छ
  const todos = await client.api.todos.get();
  console.log(todos);
</script>
```

*`client.api.todos.get()` ले `/api/todos` मा GET request पठाउँछ — बिल्कुल सरल!*

---

## ७. DOLPHIN_GENERATE_KEY (SDK सुरक्षा Key)

Auto-Generated SDK डाउनलोड एन्डपोइन्ट सुरक्षित गर्न `.env` फाइलमा `DOLPHIN_GENERATE_KEY` सेट गर्नुहोस्।

```env
DOLPHIN_GENERATE_KEY=your_secret
```

> **महत्त्वपूर्ण:** यदि `DOLPHIN_GENERATE_KEY` सेट गरिएको छैन वा गलत Key पठाइयो भने, SDK डाउनलोड गर्ने बेलामा सर्भरले **`403 Forbidden`** त्रुटि फर्काउँछ। यो Key सधैं गोप्य राख्नुहोस् र सर्वजनिक नगर्नुहोस्।

---

## ८. JWT Realtime Auth (JWT प्रमाणीकरण)

Dolphin को Realtime WebSocket कनेक्सनलाई JWT (JSON Web Token) प्रयोग गरेर सुरक्षित गर्न सकिन्छ। यसले सुनिश्चित गर्छ कि केवल अधिकृत (Authorized) प्रयोगकर्ताहरू मात्र Realtime च्यानलमा कनेक्ट हुन सक्छन्।

### कसरी कनेक्ट गर्ने

JWT Token लाई WebSocket URL मा Query Parameter को रूपमा पठाउनुहोस्:

```javascript
dolphin.connect('ws://localhost:4000/realtime?deviceId=abc&token=JWT_TOKEN');
```

* **`deviceId`**: यस उपकरण (Device) को अद्वितीय पहिचान।
* **`token`**: सर्भरले जारी गरेको JWT Token।

### सर्भरमा के हुन्छ?

सर्भरले Token प्राप्त गरेपछि यसको वैधता (Validity) जाँच गर्छ। यदि Token गलत छ वा म्याद सकिएको छ भने, सर्भरले त्यो क्लाइन्टलाई तुरुन्तै **Disconnect** गरिदिन्छ।

---

## ९. Reactive Routes (HTTP-देखि-RT स्वचालित Broadcasting)

Reactive Routes Dolphin को एउटा शक्तिशाली सुविधा हो जसले HTTP र Realtime लाई एकसाथ जोड्छ। यसले `POST`, `PUT`, र `DELETE` अनुरोधहरू आएपछि **स्वचालित रूपमा** सम्बन्धित Realtime Topic मा डाटा Broadcast गर्छ।

### फाइदा के हो?

तपाईंले Backend मा अलग्गै Realtime Broadcast कोड लेख्नु पर्दैन! Dolphin ले आफैं सम्हाल्छ।

**उदाहरण:** कसैले `POST /api/todos` मा नयाँ Todo थप्यो भने, Dolphin ले आफैं `todos` Topic मा सबै जोडिएका Clients लाई नयाँ डाटाको सूचना पठाउँछ।

### Reactive Broadcasting बन्द गर्ने (Opt-out)

यदि कुनै विशेष Route मा यो सुविधा चाहिँदैन भने, Context State मा `noReactive` सेट गर्नुहोस्:

```javascript
// यो Route मा Broadcasting हुनेछैन
ctx.state.noReactive = true;
```

---

## १०. SSE Fallback (WebSocket नभए SSE प्रयोग गर्ने)

कहिलेकाहीं नेटवर्क वा प्रोक्सी (Proxy) कारणले WebSocket कनेक्सन काम नगर्न सक्छ। यस्तो अवस्थामा Dolphin Client ले **स्वचालित रूपमा** Server-Sent Events (SSE) मा फिर्ता (Fallback) हुन्छ।

### SSE कसरी काम गर्छ?

यो प्रक्रिया पूर्णतः पारदर्शी (Transparent) छ — तपाईंले कुनै थप कोड लेख्नु पर्दैन। Client ले पहिले WebSocket जडान गर्न खोज्छ, र त्यो असफल भएमा SSE मार्फत डाटा प्राप्त गर्छ।

### SSE Endpoint

```
/realtime/sse?deviceId=abc&token=JWT_TOKEN
```

* **`deviceId`**: उपकरणको अद्वितीय पहिचान।
* **`token`**: JWT प्रमाणीकरण Token (आवश्यक भएमा)।

---

## ११. Topic Subscriptions (विशेष Topic सुन्ने)

Dolphin Realtime मा एक साथ सबै सन्देशहरू सुन्नुको सट्टा, तपाईं केवल **आफूलाई चाहिने Topic हरू** मात्र सुन्न (Subscribe गर्न) सक्नुहुन्छ।

### विशेष Topic हरूमा जडान गर्ने

```javascript
// 'todos' र 'chat' Topic मात्र सुन्ने
client.connectRealtime(onMessage, ['todos', 'chat']);
```

* पहिलो Argument `onMessage`: सन्देश आउँदा चलाइने Callback Function।
* दोस्रो Argument `['todos', 'chat']`: सुन्नु पर्ने Topic हरूको सूची।

### सन्देशको ढाँचा (Message Format)

Realtime मार्फत आउने सन्देशहरू तलको ढाँचामा हुन्छन्:

```json
{
  "action": "create",
  "data": { "id": 1, "title": "नयाँ काम" },
  "topic": "todos"
}
```

| Field    | विवरण                                          |
| -------- | ---------------------------------------------- |
| `action` | के भयो: `create`, `update`, वा `delete`       |
| `data`   | परिवर्तन भएको डाटाको विवरण                   |
| `topic`  | कुन Topic बाट सन्देश आयो (जस्तै: `todos`)    |

---

**बधाई छ! 🎉** अब तपाईंले Dolphin Framework का नयाँ र शक्तिशाली सुविधाहरू — Auto SDK, JWT Auth, Reactive Routes, SSE Fallback, र Topic Subscriptions — सबै बुझ्नुभयो। यी सुविधाहरू प्रयोग गरेर झन् बढी सुरक्षित, छिटो र स्केलेबल वेब एप्लिकेसन बनाउनुहोस्!
