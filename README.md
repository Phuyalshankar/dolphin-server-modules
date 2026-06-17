# 🐬 Dolphin Server Modules (v2.14.0)

![NPM Version](https://img.shields.io/npm/v/dolphin-server-modules?color=blue&style=flat-square)
![License](https://img.shields.io/npm/l/dolphin-server-modules?style=flat-square)
![Downloads](https://img.shields.io/npm/dm/dolphin-server-modules?style=flat-square&color=green)

**Dolphin Server Modules** is a set of practical, modular, and lightweight backend utilities for Node.js—built for real projects! No hype, just tools you can use.

---

### 📘 Official Guides (Nepal)
- **[Dolphin Master Guide (Web Version)](https://raw.githack.com/Phuyalshankar/dolphin-server-modules/main/guide.html)**
- **[Dolphin Client Tutorial (Nepali)](./CLIENT_TUTORIAL_NEPALI.md)**

---

## 📦 What's Included (Practical Tools):

| Module | What it does |
|--------|--------------|
| **Auth** | User authentication with Argon2, JWT, TOTP 2FA, password reset |
| **CRUD** | Generic CRUD operations with soft delete, ownership, and pagination |
| **Realtime** | WebSocket pub/sub with wildcard topics, Redis scaling, and high-frequency streaming |
| **Camera/RTSP** | IP camera frame handling with FFmpeg (default) or pure TCP (MJPEG only) |
| **WebRTC** | Signaling orchestrator and TURN credential generator |
| **Push Notifications** | FCM v1 (Android) and APNs (iOS) wrappers |
| **E2EE** | Web Crypto API wrappers for ECDH key exchange and AES-GCM encryption |
| **API Gateway** | Simple reverse proxy for HTTP and WebSocket |
| **RPC** | Type-safe, proxy-based RPC client/server |
| **CLI** | Dev tools for scaffolding and project management |

---

## 🚀 Quick Start

```bash
npm install dolphin-server-modules
```

### Auth Example
```javascript
import { createAuth } from 'dolphin-server-modules/auth';
import mongooseAdapter from 'dolphin-server-modules/adapters/mongoose';

const auth = createAuth({ secret: process.env.JWT_SECRET });

const user = await auth.register(mongooseAdapter, {
  email: 'test@example.com',
  password: 'SecurePass123'
});

const { accessToken } = await auth.login(mongooseAdapter, {
  email: 'test@example.com',
  password: 'SecurePass123'
});
```

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
