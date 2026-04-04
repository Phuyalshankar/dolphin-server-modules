# Dolphin Framework (dolphin-server-modules)

## Overview

A modular, lightweight, high-performance backend ecosystem built on native Node.js. Designed as a "2026-ready" universal toolkit for web services, microservices, and Industrial IoT (IIoT).

- **Version:** 1.5.5
- **Author:** Shankar Phuyal
- **Performance:** 45,000+ RPS benchmarked
- **Language:** TypeScript (targeting ES2022)
- **Runtime:** Node.js 20
- **Package Manager:** npm

## Architecture

### Core Philosophy
- Zero-dependency core (native `http` and `events`)
- Express-compatible unified context (`ctx`) API
- Modular — each subdirectory is a standalone-capable module

### Key Modules
| Directory | Purpose |
|-----------|---------|
| `server/` | Native HTTP server with unified `ctx` API |
| `router/` | Standalone router with middleware chain support |
| `auth/` | JWT auth + Argon2 hashing + TOTP 2FA |
| `authController/` | Controller wrappers for auth routes |
| `controller/` | General controller patterns |
| `curd/` | CRUD utility modules |
| `middleware/` | Zod validation middleware |
| `realtime/` | Pub/Sub engine with topic trie + binary codecs |
| `adapters/mongoose/` | Mongoose database adapter |
| `swagger/` | Auto OpenAPI 3.0 documentation generation |
| `djson/` | Specialized JSON serialization utility |
| `phone-system/` | IIoT phone/communication system demo |

### Dependencies
- `zod` — Type-safe schema validation
- `argon2` — Password hashing
- `jsonwebtoken` — JWT authentication
- `ws` — WebSocket support
- `ioredis` — Redis integration (realtime module)

## Running the Project

### Development
```bash
npm run dev    # builds TypeScript then starts demo server on port 5000
```

### Build Only
```bash
npm run build  # compiles TypeScript to dist/
```

### Production
```bash
node dist/demo-server.js   # runs the demo server directly
```

## Demo Server

`demo-server.ts` is the entry point for the running demo. It creates a Dolphin server on **port 5000** serving:
- `GET /` — HTML landing page showcasing framework features
- `GET /api/info` — Framework info as JSON
- `GET /api/health` — Health check (uptime, memory)
- `POST /api/echo` — Echoes request body

## Workflow
- **Name:** `Start application`
- **Command:** `npm run dev`
- **Port:** 5000 (webview)

## Deployment
- **Target:** autoscale
- **Build:** `npm run build`
- **Run:** `node dist/demo-server.js`
