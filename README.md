# 🐬 Dolphin Framework (v2.11.7)

![NPM Version](https://img.shields.io/npm/v/dolphin-server-modules?color=blue&style=flat-square)
![License](https://img.shields.io/npm/l/dolphin-server-modules?style=flat-square)
![Downloads](https://img.shields.io/npm/dm/dolphin-server-modules?style=flat-square&color=green)

**Dolphin** is a 2026-ready, ultra-lightweight, and 100% modular backend ecosystem built on native Node.js. Now featuring **Advanced Agentic AI (Cursor-Level)**—Dolphin doesn't just run your code; it understands your entire project, tracks symbols, and performs precision edits using semantic search.

> "Native performance. Agentic AI integration. Multi-model support."

---

### 📘 Official Master Guide (Nepal)
Dolphin Framework को विस्तृत र आधिकारिक गाइड उपलब्ध छ। यसमा **Auth, CRUD, Models, र Controllers** को १००% ट्युटोरियल समावेश छ।

👉 **[Dolphin Master Guide (Web Version)](https://raw.githack.com/Phuyalshankar/dolphin-server-modules/main/guide.html)** *(Most Up-to-Date)*

---

## 🤖 Cursor-Level AI Features (New in v2.11.4)

Dolphin v2.11.4 introduces a complete overhaul of the AI Agent, bringing it closer to professional AI editors like Cursor.

### 1. Semantic Project Search
The AI doesn't just look at one file; it indexes your entire project. When you ask a question, it uses semantic token overlap to find the 5 most relevant files automatically.

### 2. Symbol & Reference Tracking
Dolphin indexes every `function`, `class`, and `variable` across your project. The AI knows exactly where a symbol is defined and where it's used.

### 3. Precision Patching (No Full Re-writes)
Using the new **Patch Tool**, Dolphin performs surgical edits to your code. No more slow, risky full-file overwrites for small changes.

### 4. Multi-Model Support (Local & Cloud)
Use any AI provider you want. Supports **Google Gemini**, **Groq (Llama 3)**, and **Local Ollama (Gemma 3/Llama 3)**.
```bash
# To use Local Ollama, set this in .env:
USE_OLLAMA=true
OLLAMA_MODEL=gemma3:latest
```

### 5. Personalized Support (Roman Nepali)
The agent understands and replies in **Roman Nepali** (e.g., "Sanchai hunuhunchha?"), making it more comfortable for Nepali developers.

---

## 🛠️ CLI Usage

```bash
# Start the Autonomous AI Agent (Cursor Mode)
npx dolphin chat

# Architect a full production project
npx dolphin generate-full "e-commerce backend"

# Scaffold standard components (No AI needed)
npx dolphin add auth         # Add Auth System
npx dolphin add crud Product # Add CRUD for Product
npx dolphin add adapter mongoose # Setup DB

# Initialize folders
npx dolphin init-prod

# Start Dev Server
npx dolphin serve --port=3000
```

---

## 🚀 Microservices & Smart Intercom Ecosystem (New in v2.11.7)

Dolphin v2.11.7 introduces a complete suite of enterprise-grade microservice modules and smart building signaling/streaming pipelines:

### 1. Universal HTTP Framework Adapters
Run Dolphin's Mongoose-synced CRUD controllers and Auth middleware directly inside **Express** or **Fastify**!
```javascript
import express from 'express';
import { createCrudController, toExpress } from 'dolphin-server-modules';

const app = express();
const ctrl = createCrudController(db, 'Products');

app.get('/api/products', toExpress(ctrl.getAll));
```

### 2. High-Performance WebRPC
Decouple service interactions with a type-safe, Proxy-based, sub-millisecond remote procedure call (RPC) client/server engine:
```javascript
import { DolphinRPCClient } from 'dolphin-server-modules/rpc';

const client = new DolphinRPCClient({ url: 'http://localhost:4001' });
const userService = client.getService('User');

// Call remote methods asynchronously as if they were local!
const user = await userService.getUserInfo('user_123');
```

### 3. API Gateway Router
A zero-dependency reverse proxy server that redirects HTTP and WebSocket upgrade streams dynamically:
```javascript
import { DolphinAPIGateway } from 'dolphin-server-modules/gateway';

const gateway = new DolphinAPIGateway({
  routes: {
    '/api/auth/*': 'http://localhost:3001',
    '/api/products/*': 'http://localhost:3002',
    '/realtime': 'ws://localhost:3003'
  }
});
gateway.listen(3000);
```

### 4. CCTV Camera, RTSP Puller & WebRTC Intercom
- **RtspPullerModule**: Feeds streams from IP cameras/NVRs. Features a **Pure TCP RTP buffer parser** (zero external binaries/FFmpeg!) for low-resource environments, and FFmpeg Fallbacks.
- **UniversalSignaling**: A telecom-ready WebRTC signaling server with native invite-accept-reject-end handshakes and bidirectional ACK confirmations—perfect for smart doorphones and nurse calling systems!

---

## 🗺️ Roadmap
- [x] **Agentic AI Scaffolding**: Full project generation via Gemini/Groq
- [x] **Semantic Search & Symbol Indexing**: Precision context building
- [x] **Precision Patching**: AST-style surgical code edits
- [x] **Express/Fastify Adapters**: Pluggable Dolphin Context middleware
- [x] **Independent WebRPC & API Gateway**: High-speed microservices orchestration
- [x] **IP Camera RTSP & WebRTC Intercom**: Pure TCP stream parsing and VoIP SIP signaling
- [ ] **One-Click Deployment**: Deploy to Vercel/Cloudflare from CLI
- [ ] **Visual Debugger**: Built-in web dashboard for monitoring

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
