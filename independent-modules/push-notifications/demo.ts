import { PushNotificationService } from './index';
import * as http2 from 'node:http2';
import * as crypto from 'node:crypto';

// --- MOCK SERVICE ACCOUNT & APNS P8 KEYS FOR DEMO ---
// Dynamically generate valid RSA and EC private keys to prevent OpenSSL decoder errors
const DUMMY_RSA_PRIVATE_KEY = crypto.generateKeyPairSync('rsa' as any, {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
}).privateKey as any as string;

const DUMMY_EC_PRIVATE_KEY = crypto.generateKeyPairSync('ec' as any, {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
}).privateKey as any as string;

// --- MOCK GLOBAL FETCH FOR GOOGLE OAUTH & FCM ---
const originalFetch = global.fetch;
global.fetch = (async (url: any, options: any): Promise<any> => {
  const urlStr = String(url);
  if (urlStr.includes('oauth2.googleapis.com')) {
    console.log('[Mock Google OAuth2] Received token request');
    const bodyParams = new URLSearchParams(options.body);
    console.log(`[Mock Google OAuth2] Assertion JWT: ${bodyParams.get('assertion')?.slice(0, 80)}...`);
    return {
      ok: true,
      json: async () => ({
        access_token: 'mock_google_oauth2_access_token_12345',
        expires_in: 3600
      })
    };
  }
  if (urlStr.includes('fcm.googleapis.com')) {
    console.log('[Mock FCM API] Received message send request');
    console.log('[Mock FCM API] Headers:', options.headers);
    console.log('[Mock FCM API] Body:', JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({
        name: 'projects/nepal-gov-app/messages/mock-fcm-msg-id-8888'
      })
    };
  }
  return originalFetch(url, options);
}) as any;

// --- MOCK HTTP2 FOR APPLE APNS ---
const mockHttp2Connect = (url: string) => {
  console.log(`[Mock APNs HTTP2] Connected to ${url}`);
  const mockReq = {
    on(event: string, cb: Function) {
      if (event === 'response') {
        // Trigger response event immediately with status 200
        setTimeout(() => cb({ ':status': 200 }), 50);
      }
      if (event === 'end') {
        // Trigger end event
        setTimeout(() => cb(), 100);
      }
      return mockReq;
    },
    write(data: string) {
      console.log(`[Mock APNs HTTP2] Sent Payload: ${data}`);
    },
    end() {}
  };
  
  return {
    on() {},
    request(headers: any) {
      console.log('[Mock APNs HTTP2] Request Headers:', headers);
      return mockReq;
    },
    close() {}
  };
};

async function runDemo() {
  console.log('--- 🐬 Push Notifications Service Demo ---');

  // Initialize service with dummy configurations
  const pushService = new PushNotificationService({
    fcm: {
      clientEmail: 'fcm-admin@nepal-gov-app.iam.gserviceaccount.com',
      privateKey: DUMMY_RSA_PRIVATE_KEY,
      projectId: 'nepal-gov-app'
    },
    apns: {
      teamId: 'TEAMID1234',
      keyId: 'KEYID56789',
      privateKey: DUMMY_EC_PRIVATE_KEY,
      sandbox: true
    },
    http2Connect: mockHttp2Connect
  });

  // 1. Send Google FCM Notification
  console.log('\n[1] Testing Google FCM v1 notification...');
  const fcmResult = await pushService.sendFCM(
    'dummy_android_device_registration_token_99999',
    {
      title: 'केन्द्र सरकारको जरुरी सूचना',
      body: 'मन्त्रिपरिषद्का निर्णयहरू सार्वजनिक गरिएका छन्।'
    },
    {
      type: 'official_alert',
      importance: 'high'
    }
  );
  console.log('FCM Dispatch Result:', fcmResult);

  // 2. Send Apple APNs Notification
  console.log('\n[2] Testing Apple APNs notification...');
  await pushService.sendAPNs(
    'dummy_ios_apns_device_hex_token_abcdef123456',
    {
      topic: 'gov.np.messagingapp',
      title: 'सुरक्षित सन्देश प्राप्त भयो',
      body: 'तपाईँको इनबक्समा नयाँ म्यासेज छ।',
      badge: 1,
      data: {
        chatRoomId: 'room_ktm_123'
      }
    }
  );
  console.log('APNs Push Dispatch initiated and mock responded with 200.');
}

runDemo().catch(console.error).finally(() => {
  // Restore original fetch
  global.fetch = originalFetch;
});
