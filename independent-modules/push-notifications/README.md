# 🐬 Push Notifications Module (Nepal Government Messaging Project)

यो मोड्युलले **FCM v1 (Android)** र **APNs (iOS)** दुवैमा कुनै बाह्य भारी डिपेन्डेन्सी बिना नै सुरक्षित पुश नोटिफिकेशनहरू पठाउन मद्दत गर्छ। 

यो मोड्युल पूर्ण रूपमा **Framework Agnostic** छ, जसले गर्दा यसलाई Express, Fastify, NestJS, Dolphin वा कुनै पनि Node.js प्रोजेक्टमा प्रयोग गर्न सकिन्छ।

## सुविधाहरू (Features)
- **FCM v1 Support:** गुगलको पछिल्लो FCM v1 API अनुकूल र सुरक्षित OAuth2 टोकन जेनेरेसन।
- **APNs support (HTTP/2):** एप्पलको पुश नोटिफिकेशन गेटवे सँग सीधा HTTP/2 कनेक्शन (ECDSA ES256 हस्ताक्षरित)।
- **Zero runtime dependencies:** `node:crypto` र `node:http2` जस्ता नेटिभ मोड्युलहरू मात्र प्रयोग गरिएको छ।

## प्रयोग गर्ने तरिका (Usage Guide)

### १. इन्स्टलेसन र सेटअप (Installation & Initialization)
```javascript
import { PushNotificationService } from 'push-notifications';

const pushService = new PushNotificationService({
  fcm: {
    clientEmail: 'service-account@project.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\n...', // Google Service Account Key
    projectId: 'your-firebase-project-id'
  },
  apns: {
    teamId: 'APPLE_TEAM_ID',
    keyId: 'APPLE_KEY_ID_P8',
    privateKey: '-----BEGIN PRIVATE KEY-----\n...', // Apple Auth Key (.p8 file text)
    sandbox: true // Sandbox (Development) वा Production को लागि false
  }
});
```

### २. FCM पठाउने तरिका (Send FCM - Android)
```javascript
try {
  const result = await pushService.sendFCM(
    'android_device_registration_token',
    {
      title: 'केन्द्र सरकारको जरुरी सूचना',
      body: 'मन्त्रिपरिषद्का निर्णयहरू सार्वजनिक गरिएका छन्।'
    },
    {
      type: 'official_alert',
      importance: 'high'
    }
  );
  console.log('FCM Success:', result);
} catch (error) {
  console.error('FCM Error:', error);
}
```

### ३. APNs पठाउने तरिका (Send APNs - iOS)
```javascript
try {
  await pushService.sendAPNs(
    'ios_device_hex_token',
    {
      topic: 'gov.np.messagingapp', // App Bundle ID
      title: 'सुरक्षित सन्देश प्राप्त भयो',
      body: 'तपाईँको इनबक्समा नयाँ म्यासेज छ।',
      badge: 1,
      data: {
        chatRoomId: 'room_ktm_123'
      }
    }
  );
  console.log('APNs Push Sent successfully.');
} catch (error) {
  console.error('APNs Error:', error);
}
```

---
## डेमो र परीक्षण (How to Run Demo)
यसको अफलाइन परीक्षण (mock mock API) चलाउनको लागि:
```bash
npm install
npm run demo
```
