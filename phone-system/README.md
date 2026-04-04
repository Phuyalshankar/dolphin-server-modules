# Dolphin Phone System v3.0 🏛️💎
### **"The Enterprise-Grade Communication Hub"**

Version 3.0 scales the Dolphin Phone System to a fully distributed, ultra-reliable, and highly secure platform ready for real-world hospital/hotel intercom deployments.

## 🌟 Enterprise Highlights (v3.0)

- **🛰️ Distributed Routing**: Fully supports horizontal scaling. Signaling messages are routed via **Redis Pub/Sub** and delivered to the specific server instance where a device is connected.
- **🛡️ Signal Reliability (ACKs)**: Every signal includes a `msgId`. The system enforces a **Signaling -> ACK** handshake with automatic retries (up to 3 times) to guarantee delivery over unstable connections.
- **🧱 NAT/Firewall Traversal**: Native **STUN/TURN** (ICE) configuration is injected into all WebRTC signaling packets to ensure connectivity behind complex enterprise networks.
- **🔒 Hardened Identity**: Implements **Device-Bound JWTs**. Stolen tokens are useless on other hardware. Includes a complete **Refresh Token** flow for session persistence.
- **🔄 Sticky Session Compatible**: Optimized for Nginx load balancing.

---

## 🏗️ Production Deployment

### 1. Load Balancing (Nginx Example)
To support persistent WebSocket connections in a cluster, use `ip_hash` or sticky cookies:

```nginx
upstream dolphin_cluster {
    ip_hash;
    server 10.0.0.1:3000;
    server 10.0.0.2:3000;
}

server {
    location /phone {
        proxy_pass http://dolphin_cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 2. Infrastructure Setup
```typescript
const phone = createPhoneSystem({
    redis: new Redis(process.env.REDIS_URL),
    db: mongoose.connection.models
});
```

---

## 🚥 Pro Signaling Protocol

### Reliable Signal Handshake
1. **Server A** publishes `CALL_INVITE` with `msgId: "sig_123"`.
2. **Server B** (where device is connected) relays to Client.
3. **Client** receives and sends `SIGNAL_ACK` for `"sig_123"`.
4. **Server A** receives ACK and clears the retry queue.

### WebRTC ICE Injected Signals
Signals like `CALL_INVITE` and `CALL_ANSWER` now contain:
```json
{
  "type": "CALL_INVITE",
  "data": {
    "callId": "...",
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
}
```

---

## 🔐 Security Standards
- **Access Token**: Expires in 1 hour (Device-Bound).
- **Refresh Token**: Expires in 30 days (Session-Bound).
- **Endpoint Protection**: `ctx.state.user.id` is strictly compared against `ctx.body.from` to prevent spoofing.

---

## ✅ Final Verification
Run the enterprise test suite to verify distributed reliability:
```bash
npx ts-node demo-enterprise.ts
```

---

**Dolphin Server v3.0: Distributed, Reliable, Secure.** 🐬🚀
