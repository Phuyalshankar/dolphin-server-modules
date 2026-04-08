# Dolphin Telephone System: 0 to Hero Full Tutorial 🐬📞

यो गाइडले तपाईँलाई Dolphin Framework प्रयोग गरेर एउटा अत्याधुनिक, उच्च-गतिको टेलिफोन र सिग्नलिङ्ग सिस्टम (Signaling System) बनाउन सुरुदेखि अन्तसम्म सिकाउनेछ। 

---

## १. परिचय (Introduction)

Dolphin Telephone System केवल एउटा च्याट एप मात्र होइन; यो एउटा **Unified Signaling Bus** हो। यसले निम्न कुराहरूमा मद्दत गर्छ:
- **Low Latency Call Signaling:** फोन कल जोड्नका लागि छिटो सन्देश आदान-प्रदान।
- **Device Presence:** कुन डिभाइस अनलाइन छ वा छैन भन्ने जानकारी।
- **WebRTC Ready:** अडियो र भिडियो कलको लागि थोरै मिनेटमै सेटअप।
- **Industrial Scale:** हस्पिटल इन्टरकमदेखि स्मार्ट होमसम्म प्रयोग गर्न मिल्ने।

---

## २. आर्किटेक्चर (System Architecture)

हाम्रो सिस्टम तीनवटा मुख्य खम्बामा उभिएको छ:
1. **RealtimeCore v2:** यो मुख्य इन्जिन हो जसले WebSocket कनेक्शन र Pub/Sub म्यासेजहरू ह्यान्डल गर्छ।
2. **UniversalSignaling Wrapper:** यसले WebSocket का जटिल कोडहरूलाई सजिलो फङ्सनहरू (जस्तै `invite`, `accept`) मा बदल्छ।
3. **Dolphin Server:** जहाँ हाम्रो API र WebSocket सर्भर बस्छ।

---

## ३. सर्भर सेटअप (Step 1: Server Setup)

सबैभन्दा पहिले हामीले एउटा सर्भर बनाउनुपर्छ जसमा रियल-टाइम सुविधा अन गरिएको होस्।

```typescript
// server.ts
import { createDolphinServer } from './server/server';
import { RealtimeCore } from './realtime/core';
import { createSignaling } from './signaling';

// १. Realtime Engine सुरु गर्ने
const realtime = new RealtimeCore({ 
  debug: true, 
  enableJSONCache: true 
});

// २. Dolphin Server बनाउने र Realtime Engine जोड्ने
const app = createDolphinServer({ 
  port: 5000, 
  realtime: realtime 
});

// ३. Signaling Wrapper बनाउने (कल ह्यान्डल गर्न सजिलो)
const phone = createSignaling(realtime);

app.listen(5000, () => {
  console.log("Dolphin Telephone Server is Live on Port 5000! 🚀");
});
```

---

## ४. डिभाइस रजिस्ट्रेसन (Step 2: Registration)

कुनै पनि टेलिफोनले कल पाउनका लागि सर्भरमा रजिस्टर हुनुपर्छ। डल्फिनमा यो एकदमै सजिलो छ। बाहिरको डिभाइस (Mobile/Web) ले जोडिँदा URL मा आफ्नो ID पठाउनुपर्छ।

**URL Format:** `ws://your-server:5000/realtime?deviceId=USER_NAME`

**Client-side Example:**
```javascript
const myId = "nurse_station_01";
const socket = new WebSocket(`ws://localhost:5000/realtime?deviceId=${myId}`);

socket.onopen = () => {
  console.log("Nurse Station Registered!");
};
```

---

## ५. सिग्नलिङ्ग र फोन कल (Step 3: Signaling Mastery)

रजिस्टर भइसकेपछि हामी कलको लजिक लेख्न सक्छौँ।

### क. फोन आएको सुन्ने (Listen for Incoming Call)
सर्भरमा कसैले फोन गर्यो भने के गर्ने भन्ने कोड यहाँ हुन्छ:

```typescript
// सर्भर वा ब्याकइन्डमा
phone.onSignalFor('nurse_station_01', async (payload) => {
  // हेर्ने कि कसले फोन गरेको हो
  if (payload.type === 'INVITE') {
    console.log(`Call from: ${payload.from}`);
    
    // केही बेर पछि कल स्वीकार गर्ने
    await phone.accept('nurse_station_01', payload.from);
  }
});
```

### ख. अर्को डिभाइसलाई फोन गर्ने (Making a Call)
कल गर्दा हामी `invite` फङ्सन चलाउँछौँ। यसले अटोमेटिक रूपमा Acknowledgement (पुग्यो कि पुगेन) चेक गर्छ।

```typescript
async function callDoctor() {
  const reached = await phone.invite('nurse_station_01', 'doctor_id');
  
  if (reached) {
    console.log("डाक्टरको फोनमा घण्टी बजिरहेको छ...");
  } else {
    console.log("डाक्टर अफलाइन हुनुहुन्छ।");
  }
}
```

---

## ६. एडभान्स्ड: WebRTC सँग जोड्ने (Step 4: WebRTC Flow)

यदि तपाईँलाई साँचो अडियो/भिडियो कल चाहिएको छ भने, तपाईँले **ICE Candidates** र **SDP (Offer/Answer)** साटासाट गर्नुपर्छ। डल्फिनले यसलाई धेरै सजिलो बनाउँछ:

```typescript
// ICE Candidate साटासाट गर्ने
phone.iceCandidate('caller_id', 'receiver_id', { candidate: '...' });

// कल काट्ने (End Call)
phone.end('caller_id', 'receiver_id', 'User hung up');
```

---

## ७. स्केलिङ र उत्पादन (Step 5: Production Scaling)

जब तपाईँको हजारौँ फोनहरू हुन्छन्, तपाईँलाई एउटा मात्र सर्भरले पुग्दैन। त्यस्तो अवस्थामा तपाईँले **Redis** प्रयोग गर्नुपर्छ।

```typescript
const realtime = new RealtimeCore({
  redisUrl: 'redis://localhost:6379' // एउटा सर्भरले पठाएको सिग्नल अर्कोमा पुग्छ
});
```

---

## ८. हस्पिटल इन्टरकमको पूर्ण उदाहरण (Real-world Example)

यो एउटा पूर्ण कोड हो जसले हस्पिटलको कोठा नम्बर १०१ बाट नर्स स्टेसनमा फोन गर्छ:

```typescript
import { createDolphinServer } from './server/server';
import { RealtimeCore } from './realtime/core';
import { createSignaling, SignalType } from './signaling';

const rt = new RealtimeCore();
const app = createDolphinServer({ realtime: rt });
const phone = createSignaling(rt);

// १. नर्स स्टेसनको लजिक
phone.onSignalFor('NURSE_01', (payload) => {
  if (payload.type === SignalType.INVITE) {
    console.log(`ALERT: Room ${payload.data.roomNo} is calling!`);
    phone.accept('NURSE_01', payload.from);
  }
});

// २. कोठा १०१ बाट नर्सलाई फोन गर्ने API
app.post('/emergency/:roomNo', async (ctx) => {
  const room = ctx.params.roomNo;
  const success = await phone.invite(`ROOM_${room}`, 'NURSE_01', { roomNo: room });
  
  return success ? { status: "Ringing" } : { status: "Offline" };
});

app.listen(3000);
```

---

## ९. केही टिप्सहरू (Pro Tips)

1. **Heartbeat:** डल्फिनले ६० सेकेन्डसम्म चुप लागेको डिभाइसलाई आफैँ हटाउँछ, त्यसैले पिंग-पोङ गरिरहनु पर्दैन।
2. **Security:** `RealtimeCore` को `acl` अप्सन प्रयोग गरेर कसले कसलाई फोन गर्न पाउने भन्ने फिल्टर राख्नुहोस्।
3. **Debug:** समस्या आएमा `debug: true` राखेर कन्सोलमा के भइरहेको छ हेर्नुहोस्।

---
**बधाई छ!** तपाईँ अब डल्फिन टेलिफोन सिस्टमको मास्टर हुनुभयो। 🐬📞
