# 🐬 E2E Cryptography Module (Nepal Government Messaging Project)

यो मोड्युलले **End-to-End Encryption (E2EE)** को लागि सुरक्षित साँचो साटासाट (ECDH Key Exchange) र म्यासेज इन्क्रिप्सन/डिक्रिप्सन (AES-256-GCM) सम्बन्धी सुविधाहरू प्रदान गर्छ। 

यो मोड्युल **Web Crypto API** मा आधारित भएकाले कुनै थप बाह्य डिपेन्डेन्सी बिना नै **Node.js (18+)** र **Web Browser** दुवैमा चल्छ।

## सुविधाहरू (Features)
- **ECDH P-256 Key Exchange:** साँचो साटासाट गर्नका लागि सुरक्षित की-पेयर जेनेरेसन।
- **AES-GCM (256-bit) Encryption:** म्यासेजहरूलाई सैन्य-स्तरको इन्क्रिप्सन प्रदान गर्न।
- **Base64 Portability:** पब्लिक तथा प्राइभेट कीहरूलाई सजिलै स्ट्रिङ ढाँचा (SPKI / PKCS8) मा निर्यात (export) र आयात (import) गर्न सकिन्छ।
- **Framework Agnostic:** Express, NestJS, Fastify, वा कुनै पनि फ्रन्टइन्ड फ्रेमवर्क (React, Vue, iOS/Android WebViews) मा चल्न सक्ने।

## प्रयोग गर्ने तरिका (Usage Guide)

### १. की-पेयर सिर्जना गर्ने (Generate Keypair)
```javascript
import { generateKeyPair, exportPublicKey } from 'e2e-cryptography';

const keyPair = await generateKeyPair();
const publicBase64 = await exportPublicKey(keyPair.publicKey);
// यो publicBase64 साँचोलाई अर्को प्रयोगकर्तालाई सर्भर मार्फत पठाउनुहोस्।
```

### २. साँचो आयात र सेयर की बनाउने (Import Key & Derive Shared Secret)
```javascript
import { importPublicKey, deriveSharedKey } from 'e2e-cryptography';

// अर्को प्रयोगकर्ताको पब्लिक की प्राप्त गरेपछि:
const remotePublicKey = await importPublicKey(remotePublicBase64);
const sharedSecret = await deriveSharedKey(keyPair.privateKey, remotePublicKey);
```

### ३. म्यासेज इन्क्रिप्ट गर्ने (Encrypt Message)
```javascript
import { encrypt } from 'e2e-cryptography';

const payload = await encrypt('मेरो गोप्य सन्देश', sharedSecret);
// payload.ciphertext र payload.iv लाई सर्भर मार्फत साथीलाई पठाउनुहोस्।
```

### ४. म्यासेज डिक्रिप्ट गर्ने (Decrypt Message)
```javascript
import { decrypt } from 'e2e-cryptography';

const plaintext = await decrypt(payload.ciphertext, payload.iv, sharedSecret);
console.log(plaintext); // 'मेरो गोप्य सन्देश'
```

---
## डेमो चलाउने तरिका (How to Run Demo)
यसको परीक्षण गर्नको लागि तलको कमान्ड चलाउनुहोस्:
```bash
npm install
npm run demo
```
