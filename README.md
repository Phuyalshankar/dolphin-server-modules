# 🐬 Dolphin Framework (v2.9.5)

![NPM Version](https://img.shields.io/npm/v/dolphin-server-modules?color=blue&style=flat-square)
![License](https://img.shields.io/npm/l/dolphin-server-modules?style=flat-square)
![Downloads](https://img.shields.io/npm/dm/dolphin-server-modules?style=flat-square&color=green)

**Dolphin** is a 2026-ready, ultra-lightweight, and 100% modular backend ecosystem built on native Node.js. Now featuring **Advanced Agentic AI (Cursor-Level)**—Dolphin doesn't just run your code; it understands your entire project, tracks symbols, and performs precision edits using semantic search.

> "Native performance. Agentic AI integration. Multi-model support."

---

### 📘 Official Master Guide (Nepal)
Dolphin Framework को विस्तृत र आधिकारिक गाइड उपलब्ध छ। यसमा **Auth, CRUD, Models, र Controllers** को १००% ट्युटोरियल समावेश छ।

👉 **[Dolphin Master Guide (Markdown)](https://github.com/Phuyalshankar/dolphin-server-modules/blob/main/DOLPHIN_MASTER_GUIDE_NEPALI.md)** *(Most Up-to-Date)*

---

## 🤖 Cursor-Level AI Features (New in v2.9.5)

Dolphin v2.9.5 introduces a complete overhaul of the AI Agent, bringing it closer to professional AI editors like Cursor.

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

## 🚀 Quick Start (Modern ESM Only)

Dolphin strictly uses **ES Modules (import/export)**. The use of `require()` is discouraged as it causes compatibility issues in modern Node.js environments.

```javascript
import { createDolphinServer } from 'dolphin-server-modules/server';

const app = createDolphinServer();

app.get('/ping', (ctx) => {
  return { message: 'pong', status: 'swimming' };
});

app.listen(3000, () => console.log("🐬 Dolphin v2.9.5 swimming on 3000"));
```

---

## 📊 2026 Performance Benchmarks

| Framework | RPS (Req/sec) | Cold Start | Realtime Throughput |
| :--- | :--- | :--- | :--- |
| Express.js | ~15,000 | 180ms | N/A |
| **Dolphin V2.9** | **45,000+** | **< 10ms** | **35,000+ msgs/sec** |

---

## 🗺️ Roadmap
- [x] **Agentic AI Scaffolding**: Full project generation via Gemini/Groq
- [x] **Semantic Search & Symbol Indexing**: Precision context building
- [x] **Multi-Model Support**: Gemini, Groq, and Local Ollama
- [x] **Precision Patching**: AST-style surgical code edits
- [ ] **One-Click Deployment**: Deploy to Vercel/Cloudflare from CLI
- [ ] **Visual Debugger**: Built-in web dashboard for monitoring

---

## 📄 License
ISC © 2026 Shankar Phuyal & Dolphin Team.
