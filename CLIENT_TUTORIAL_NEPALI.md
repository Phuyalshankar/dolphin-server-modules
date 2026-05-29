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
