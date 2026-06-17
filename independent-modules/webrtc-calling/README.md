# 🐬 WebRTC Calling & Signaling Module (Nepal Government Messaging Project)

यो मोड्युलले **WebRTC voice & video calls** को लागि आवश्यक पर्ने **Signaling Server** र **dynamic Coturn TURN credentials generator** प्रदान गर्छ।

यो मोड्युल पूर्ण रूपमा **Framework Agnostic** छ, जसले गर्दा यसलाई Express, NestJS, Fastify, Dolphin वा कुनै पनि Node.js प्रोजेक्टमा प्रयोग गर्न सकिन्छ।

## सुविधाहरू (Features)
- **Framework-Agnostic Signaling:** कुनै पनि WebSocket पुस्तकालय (`ws`, `socket.io`, आदि) सँग सीधा काम गर्न सक्छ।
- **Coturn Dynamic Credentials:** HMAC-SHA1 मा आधारित REST API credentials जेनेरेटर (जसले गर्दा कल गर्दा पासवर्डहरू सधैँ परिवर्तन भइरहन्छन् र सुरक्षित हुन्छन्)।
- **Peer & Room Routing:** सहज रूपमा रूम बनाउन र रूमभित्र रहेका प्रयोगकर्ताहरू बीच SDP Offer, Answer र ICE Candidates प्रवाह गर्न सक्छ।

## प्रयोग गर्ने तरिका (Usage Guide)

### १. डायनामिक TURN Credentials सिर्जना गर्ने
जब क्लाइन्ट (एप) ले कल जडान गर्न खोज्छ, ब्याकेन्डबाट यो फङ्सन कल गरी credentials पठाउनुहोस्:
```javascript
import { generateTurnCredentials } from 'webrtc-calling';

const secret = 'यस_ठाउँमा_आफ्नो_रहस्य_कि_राख्नुहोस्'; // Coturn config को static-auth-secret
const userId = 'user_ram_123';

const turnConfig = generateTurnCredentials(secret, userId, 3600); // १ घण्टाको लागि मान्य
console.log(turnConfig);
/*
Output:
{
  username: "1780758402:user_ram_123",
  credential: "HMAC_SHA1_SIGNATURE_BASE64",
  ttl: 3600
}
*/
```

### २. Signaling Server सेटअप गर्ने (Express + `ws` उदाहरण)
यो मोड्युललाई सीधा WebSocket सर्भरमा एकीकृत गर्न सकिन्छ:

```javascript
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WebRTCSignalingOrchestrator } from 'webrtc-calling';

const server = createServer();
const wss = new WebSocketServer({ noServer: true });
const orchestrator = new WebRTCSignalingOrchestrator();

wss.on('connection', (ws, req) => {
  // Query parameters बाट peerId तान्नुहोस् (e.g. ws://localhost:3000?peerId=ram)
  const urlParams = new URL(req.url, 'http://localhost').searchParams;
  const peerId = urlParams.get('peerId') || `anonymous_${Math.random()}`;

  // Orchestrator लाई WebSocket कनेक्सन बुझाउनुहोस्
  orchestrator.handleConnection(peerId, ws);
});

// Upgrade HTTP to WS
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(3000, () => console.log('Signaling server running on port 3000'));
```

---
## इन्स्टलेसन र कम्पाइल गर्ने तरिका (Compilation & Installation)
यो मोड्युललाई आफ्नो प्रोजेक्टमा जोड्न:
```bash
npm install
npm run build
```
म्यानेजमेन्ट र सेटअप गाइडका लागि **[TURN Setup Guide](./turn-setup.md)** हेर्नुहोस्।
