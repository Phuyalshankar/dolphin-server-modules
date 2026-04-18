"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBase64 = exports.toBuffer = exports.djson = exports.getSize = exports.decode = exports.encode = exports.TopicTrie = exports.RealtimeCore = void 0;
const events_1 = require("events");
const trie_1 = require("./trie");
const codec_1 = require("./codec");
const djson_1 = require("../djson/djson");
const fs = __importStar(require("fs"));
/**
 * RealtimeCore v2.0 - High performance unified pub/sub bus for Dolphin
 * Added Features: pubPush, subPull, pubFile, subFile, Resume, P2P Stream
 */
class RealtimeCore extends events_1.EventEmitter {
    config;
    trie = new trie_1.TopicTrie();
    retained = new Map();
    devices = new Map();
    plugins = new Map();
    pending = new Map();
    msgId = 0;
    // High-Frequency Buffers (pubPush/subPull)
    highFreqBuffers = new Map();
    MAX_BUFFER_SIZE = 100; // Lightweight: only 100 items per topic
    // File Transfer Registry (pubFile/subFile)
    fileRegistry = new Map();
    fileProgress = new Map(); // deviceId -> fileId -> lastChunk
    DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks (Lightweight)
    // P2P Peer Registry
    peerRegistry = new Map(); // fileId -> Set<deviceId>
    // JSON Cache (existing)
    jsonCache = new Map();
    CACHE_TTL = 5000;
    MAX_CACHE_SIZE = 100;
    redisPub;
    redisSub;
    // Cleanup intervals
    cleanupInterval;
    cacheCleanupInterval;
    bufferCleanupInterval;
    constructor(config = {}) {
        super();
        this.config = config;
        if (config.redisUrl) {
            this.initRedis(config.redisUrl);
        }
        this.startCleanup();
        if (config.enableJSONCache) {
            this.cacheCleanupInterval = setInterval(() => this.cleanJSONCache(), 10000);
        }
        // v2.0: Buffer cleanup
        this.bufferCleanupInterval = setInterval(() => this.cleanupBuffers(), 30000);
    }
    log(...args) {
        if (this.config.debug) {
            console.log('[RealtimeCore v2]', ...args);
        }
    }
    toJSON(data, skipCache = false) {
        if (Buffer.isBuffer(data)) {
            return JSON.stringify({ _type: 'buffer', data: data.toString('base64') });
        }
        if (!skipCache && this.config.enableJSONCache && typeof data === 'object' && data !== null) {
            const cacheKey = this.getCacheKey(data);
            const cached = this.jsonCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached.result;
            }
            const result = JSON.stringify(data);
            this.setCache(cacheKey, result);
            return result;
        }
        try {
            return JSON.stringify(data);
        }
        catch (err) {
            return JSON.stringify({ error: 'Circular structure', raw: String(data) });
        }
    }
    getCacheKey(obj) {
        if (typeof obj !== 'object')
            return String(obj);
        const keys = Object.keys(obj).slice(0, 3);
        return keys.map(k => `${k}:${String(obj[k]).substring(0, 50)}`).join('|');
    }
    setCache(key, value) {
        if (this.jsonCache.size >= this.MAX_CACHE_SIZE) {
            const oldest = Array.from(this.jsonCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
            if (oldest)
                this.jsonCache.delete(oldest[0]);
        }
        this.jsonCache.set(key, { result: value, timestamp: Date.now() });
    }
    cleanJSONCache() {
        const now = Date.now();
        for (const [key, value] of this.jsonCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.jsonCache.delete(key);
            }
        }
    }
    cleanupBuffers() {
        // Remove old buffers that haven't been accessed
        const now = Date.now();
        for (const [topic, buffer] of this.highFreqBuffers.entries()) {
            // Remove messages older than 5 minutes
            const freshBuffer = buffer.filter(msg => now - msg.ts < 300000);
            if (freshBuffer.length === 0) {
                this.highFreqBuffers.delete(topic);
            }
            else if (freshBuffer.length !== buffer.length) {
                this.highFreqBuffers.set(topic, freshBuffer);
            }
        }
    }
    async initRedis(url) {
        try {
            const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
            this.redisPub = new Redis(url);
            this.redisSub = new Redis(url);
            this.redisSub.subscribe('dolphin-rt');
            this.redisSub.on('message', (_, msg) => {
                try {
                    const { topic, payload } = JSON.parse(msg, (key, value) => {
                        if (value && value._type === 'buffer' && value.data) {
                            return Buffer.from(value.data, 'base64');
                        }
                        return value;
                    });
                    this.publishInternal(topic, payload, { skipRedis: true });
                }
                catch (err) {
                    console.error('Redis message parse error:', err);
                }
            });
        }
        catch (err) {
            console.warn('Redis initialization failed:', err);
        }
    }
    subscribe(topic, fn, deviceId) {
        if (deviceId && this.config.acl && !this.config.acl.canSubscribe(deviceId, topic)) {
            throw new Error('ACL deny');
        }
        this.trie.add(topic, fn);
        // BUG FIX #1: Use TopicTrie matching for retained messages instead of exact string compare.
        // Previously `t === topic` only matched exact topics, breaking wildcard subscriptions like
        // 'sensors/+' or 'sensors/#' which would never receive retained messages.
        for (const [t, data] of this.retained.entries()) {
            const tempTrie = new trie_1.TopicTrie();
            tempTrie.add(topic, fn);
            tempTrie.match(t, (matchedFn) => matchedFn(data.payload));
        }
    }
    publish(topic, payload, opts = {}, deviceId) {
        const size = (0, codec_1.getSize)(payload);
        if (size > (this.config.maxMessageSize || 256 * 1024)) {
            throw new Error(`Payload too large: ${size} bytes`);
        }
        if (deviceId && this.config.acl && !this.config.acl.canPublish(deviceId, topic)) {
            throw new Error('ACL deny');
        }
        this.publishInternal(topic, payload, opts);
    }
    publishInternal(topic, payload, opts = {}) {
        if (opts.retain) {
            this.retained.set(topic, { payload, ts: Date.now(), ttl: opts.ttl || 0 });
        }
        this.trie.match(topic, (fn) => fn(payload));
        this.emit('message', { topic, payload });
        if (this.redisPub && !opts.skipRedis) {
            const jsonMessage = this.toJSON({ topic, payload });
            this.redisPub.publish('dolphin-rt', jsonMessage);
        }
    }
    // ============================================
    // v2.0 NEW: High-Frequency Methods
    // ============================================
    /**
     * pubPush: अति उच्च गतिको डाटाको लागि (IoT Sensors, Live Graphs)
     * - No JSON.stringify, No Redis, No ACL चेक
     * - सिधै Trie मा भएका Subscribers लाई पठाउने
     * - Memory-efficient: सीमित मात्र बफर राख्छ
     */
    pubPush(topic, payload) {
        let buffer;
        let isBinary = false;
        if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
            buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
            isBinary = true;
        }
        else {
            buffer = Buffer.from(this.toJSON(payload, true));
        }
        // सिधै टपिक मिल्ने सबैलाई पठाउने (Zero overhead)
        this.trie.match(topic, (fn) => {
            fn(buffer);
        });
        // वैकल्पिक: पछि subPull को लागि बफरमा राख्ने
        const maxBuffer = this.config.maxBufferPerTopic || this.MAX_BUFFER_SIZE;
        if (maxBuffer > 0) {
            let topicBuffer = this.highFreqBuffers.get(topic) || [];
            topicBuffer.push({ data: isBinary ? buffer : payload, ts: Date.now(), isBinary });
            if (topicBuffer.length > maxBuffer) {
                topicBuffer.shift();
            }
            this.highFreqBuffers.set(topic, topicBuffer);
        }
    }
    /**
     * subPull: क्लाइन्टले मागेपछि मात्र डाटा दिने (Data Saving)
     * @param deviceId - कसलाई पठाउने
     * @param topic - कुन टपिकको डाटा चाहियो
     * @param count - कति वटा पछिल्ला डाटा चाहियो (default: 10)
     */
    subPull(deviceId, topic, count = 10) {
        const buffer = this.highFreqBuffers.get(topic);
        if (!buffer || buffer.length === 0) {
            this.sendTo(deviceId, {
                type: 'PULL_EMPTY',
                from: 'SERVER',
                topic,
                message: 'No data available',
                timestamp: Date.now()
            });
            return;
        }
        // पछिल्लो 'count' वटा डाटा मात्र लिने
        const lastData = buffer.slice(-Math.min(count, buffer.length));
        this.sendTo(deviceId, {
            type: 'PULL_RESPONSE',
            from: 'SERVER',
            topic,
            count: lastData.length,
            totalAvailable: buffer.length,
            payload: lastData.map(d => d.data),
            serverTime: Date.now()
        });
        this.log(`subPull: ${deviceId} pulled ${lastData.length} items from ${topic}`);
    }
    // ============================================
    // v2.0 NEW: File Transfer Methods
    // ============================================
    /**
     * pubFile: ठूलो फाइललाई टुक्रा-टुक्रा (Chunks) मा पठाउन तयार गर्ने
     * - फाइललाई पूरै मेमोरीमा नराखी 'Stream' तयार पार्ने
     * - हरेक टुक्रा 64KB (हल्का)
     */
    pubFile(fileId, filePath, chunkSize) {
        if (!fs.existsSync(filePath)) {
            this.log(`pubFile: File not found - ${filePath}`);
            return null;
        }
        const stats = fs.statSync(filePath);
        const finalChunkSize = chunkSize || this.config.defaultChunkSize || this.DEFAULT_CHUNK_SIZE;
        // FIX: Extract just the filename, not the full path (supports both Windows and Unix paths)
        const filename = filePath.split(/[/\\]/).pop() || filePath;
        const metadata = {
            path: filePath,
            size: stats.size,
            chunkSize: finalChunkSize,
            totalChunks: Math.ceil(stats.size / finalChunkSize),
            name: filename, // Use just the filename, not the full path
            createdAt: Date.now()
        };
        this.fileRegistry.set(fileId, metadata);
        // सबै अनलाइन डिभाइसलाई खबर गर्ने
        this.publish('file/announce', {
            type: 'FILE_AVAILABLE',
            fileId,
            name: metadata.name,
            size: metadata.size,
            totalChunks: metadata.totalChunks,
            chunkSize: metadata.chunkSize,
            timestamp: Date.now()
        }, { retain: true });
        this.log(`pubFile: Registered ${fileId} - ${metadata.name} (${metadata.totalChunks} chunks)`);
        return metadata;
    }
    /**
     * subFile: फाइलको निश्चित टुक्रा (Chunk) तान्ने - Resume Support सहित
     * @param deviceId - कसलाई पठाउने
     * @param fileId - कुन फाइल
     * @param startChunk - कुन Chunk बाट सुरु गर्ने (Resume को लागि)
     */
    async subFile(deviceId, fileId, startChunk = 0) {
        const file = this.fileRegistry.get(fileId);
        if (!file) {
            this.sendTo(deviceId, {
                type: 'FILE_ERROR',
                fileId,
                error: 'File not found',
                timestamp: Date.now()
            });
            return false;
        }
        if (!fs.existsSync(file.path)) {
            this.sendTo(deviceId, {
                type: 'FILE_ERROR',
                fileId,
                error: 'File no longer exists on server',
                timestamp: Date.now()
            });
            return false;
        }
        // यदि startChunk अन्तिम Chunk भन्दा बढी छ भने
        if (startChunk >= file.totalChunks) {
            this.sendTo(deviceId, {
                type: 'FILE_COMPLETE',
                fileId,
                totalChunks: file.totalChunks,
                size: file.size,
                timestamp: Date.now()
            });
            this.emit('file:complete', { fileId, deviceId });
            return true;
        }
        try {
            const fd = fs.openSync(file.path, 'r');
            const buffer = Buffer.alloc(file.chunkSize);
            // निश्चित स्थानबाट डाटा पढ्ने (Seek)
            const offset = startChunk * file.chunkSize;
            const bytesRead = fs.readSync(fd, buffer, 0, file.chunkSize, offset);
            fs.closeSync(fd);
            const isLast = startChunk === file.totalChunks - 1;
            const finalData = bytesRead < file.chunkSize ? buffer.slice(0, bytesRead) : buffer;
            this.sendTo(deviceId, {
                type: 'FILE_CHUNK',
                from: 'SERVER',
                fileId,
                name: file.name,
                chunkIndex: startChunk,
                totalChunks: file.totalChunks,
                offset: offset,
                size: bytesRead,
                data: this.config.useBinaryProtocol ? finalData : finalData.toString('base64'),
                isLast,
                nextChunk: isLast ? null : startChunk + 1,
                timestamp: Date.now()
            });
            // प्रगति सेभ गर्ने (Resume को लागि)
            this.saveFileProgress(deviceId, fileId, startChunk);
            // फाइल पूरा भयो भने event emit गर्ने
            if (isLast) {
                this.emit('file:complete', { fileId, deviceId });
                this.log(`subFile: ${deviceId} completed ${file.name}`);
            }
            return true;
        }
        catch (err) {
            this.log(`subFile error:`, err);
            this.sendTo(deviceId, {
                type: 'FILE_ERROR',
                fileId,
                error: String(err),
                timestamp: Date.now()
            });
            return false;
        }
    }
    /**
     * resumeFile: पहिले रोकिएको ठाउँबाट फाइल फेरि सुरु गर्ने
     */
    async resumeFile(deviceId, fileId) {
        const lastChunk = this.getFileProgress(deviceId, fileId);
        const nextChunk = lastChunk + 1;
        this.log(`resumeFile: ${deviceId} resuming ${fileId} from chunk ${nextChunk}`);
        return this.subFile(deviceId, fileId, nextChunk);
    }
    /**
     * saveFileProgress: डाउनलोड प्रगति सेभ गर्ने
     */
    saveFileProgress(deviceId, fileId, lastChunk) {
        if (!this.fileProgress.has(deviceId)) {
            this.fileProgress.set(deviceId, new Map());
        }
        this.fileProgress.get(deviceId).set(fileId, lastChunk);
    }
    /**
     * getFileProgress: पहिलेको प्रगति पुनः प्राप्त गर्ने (Resume को लागि)
     */
    getFileProgress(deviceId, fileId) {
        return this.fileProgress.get(deviceId)?.get(fileId) ?? -1;
    }
    /**
     * getFileInfo: फाइलको जानकारी लिने
     */
    getFileInfo(fileId) {
        return this.fileRegistry.get(fileId);
    }
    /**
     * listFiles: सबै उपलब्ध फाइलहरूको सूची
     */
    listFiles() {
        return Array.from(this.fileRegistry.entries()).map(([id, meta]) => ({
            fileId: id,
            name: meta.name,
            size: meta.size,
            totalChunks: meta.totalChunks
        }));
    }
    // ============================================
    // v2.0 NEW: P2P Stream Pass
    // ============================================
    /**
     * announceToPeers: फाइलको उपलब्धता सबै पीयरलाई जानकारी दिने
     */
    announceToPeers(fileId, availableAtDeviceId) {
        if (!this.config.enableP2P)
            return;
        if (!this.peerRegistry.has(fileId)) {
            this.peerRegistry.set(fileId, new Set());
        }
        this.peerRegistry.get(fileId).add(availableAtDeviceId);
        this.broadcast('p2p/announce', {
            type: 'PEER_AVAILABLE',
            fileId,
            source: availableAtDeviceId,
            peers: Array.from(this.peerRegistry.get(fileId) || []),
            timestamp: Date.now()
        }, { exclude: [availableAtDeviceId] });
    }
    /**
     * getPeersForFile: फाइल भएका पीयरहरूको सूची
     */
    getPeersForFile(fileId) {
        return Array.from(this.peerRegistry.get(fileId) || []);
    }
    /**
     * requestFromPeer: पीयरबाट सिधै डाटा माग गर्ने
     */
    requestFromPeer(deviceId, peerId, fileId, chunkIndex) {
        const peerSocket = this.getSocket(peerId);
        if (peerSocket && peerSocket.readyState === 1) {
            peerSocket.send(JSON.stringify({
                type: 'P2P_REQUEST',
                from: deviceId,
                fileId,
                chunkIndex,
                timestamp: Date.now()
            }));
            return true;
        }
        return false;
    }
    /**
     * sendToPeer: पीयरलाई सिधै डाटा पठाउने (Server Pass-through)
     */
    sendToPeer(fromDeviceId, toDeviceId, payload) {
        const targetSocket = this.getSocket(toDeviceId);
        if (targetSocket && targetSocket.readyState === 1) {
            const message = this.config.useBinaryProtocol
                ? (0, djson_1.toBuffer)(payload)
                : JSON.stringify({
                    type: 'P2P_DATA',
                    from: fromDeviceId,
                    data: payload,
                    timestamp: Date.now()
                });
            targetSocket.send(message);
            return true;
        }
        return false;
    }
    // ============================================
    // v2.0 NEW: Enhanced Socket Methods
    // ============================================
    /**
     * isReady: डिभाइस अनलाइन छ र मेसेज लिन तयार छ कि छैन चेक गर्ने
     */
    isReady(deviceId) {
        const device = this.devices.get(deviceId);
        return !!(device?.socket && device.socket.readyState === 1);
    }
    /**
     * isOnline: डिभाइस अनलाइन छ कि छैन (साधारण चेक)
     */
    isOnline(deviceId) {
        return this.devices.has(deviceId);
    }
    /**
     * sendTo: सिधै डिभाइसलाई मेसेज पठाउने (No Pub/Sub overhead)
     */
    sendTo(deviceId, payload) {
        if (!this.isReady(deviceId))
            return false;
        try {
            const device = this.devices.get(deviceId);
            const data = this.config.useBinaryProtocol
                ? (0, djson_1.toBuffer)(payload)
                : JSON.stringify(payload);
            device.socket.send(data);
            return true;
        }
        catch (err) {
            console.error(`[Realtime] Send failed to ${deviceId}:`, err);
            return false;
        }
    }
    /**
     * kick: खराब वा अनधिकृत डिभाइसलाई हटाउने
     */
    kick(deviceId, reason = "Disconnected by server") {
        const device = this.devices.get(deviceId);
        if (device?.socket) {
            this.sendTo(deviceId, { type: 'KICK', message: reason });
            device.socket.close();
            this.unregister(deviceId);
            this.log(`Kicked ${deviceId}: ${reason}`);
        }
    }
    /**
     * broadcastToGroup: कुनै विशेष ग्रुपलाई मात्र मेसेज पठाउने
     */
    broadcastToGroup(groupName, payload) {
        for (const [id, device] of this.devices) {
            if (device.metadata?.group === groupName && this.isReady(id)) {
                this.sendTo(id, payload);
            }
        }
    }
    /**
     * getOnlineDevices: सबै अनलाइन डिभाइसहरूको लिस्ट दिने
     */
    getOnlineDevices() {
        return Array.from(this.devices.entries()).map(([id, d]) => ({
            id,
            lastSeen: d.lastSeen,
            group: d.metadata?.group || 'default'
        }));
    }
    /**
     * ping: डिभाइसलाई Alive छ कि छैन भनेर चेक गर्न Ping पठाउने
     */
    ping(deviceId) {
        const device = this.devices.get(deviceId);
        if (device?.socket && typeof device.socket.ping === 'function') {
            device.socket.ping();
            return true;
        }
        return false;
    }
    // ============================================
    // v2.0 NEW: Private Messaging
    // ============================================
    /**
     * privateSub: केवल आफ्नो निजी च्यानलमा आउने मेसेज सुन्नको लागि
     */
    privateSub(deviceId, fn) {
        const privateTopic = `phone/signaling/${deviceId}`;
        this.subscribe(privateTopic, fn, deviceId);
        this.log(`[Private] ${deviceId} subscribed to private channel`);
    }
    /**
     * privatePub: कुनै विशेष डिभाइसको निजी च्यानलमा मात्र मेसेज पठाउन
     */
    privatePub(targetId, payload, opts = {}) {
        const privateTopic = `phone/signaling/${targetId}`;
        this.publish(privateTopic, payload, opts, 'SYSTEM');
        this.log(`[Private] Message sent to ${targetId}`);
    }
    // ============================================
    // Existing Methods (preserved for compatibility)
    // ============================================
    async handle(raw, socket, deviceId) {
        // ... (existing handle method remains the same)
        if (raw.length > (this.config.maxMessageSize || 256 * 1024))
            return;
        const ctx = {
            type: 'raw',
            raw,
            socket,
            deviceId,
            ts: Date.now(),
            publish: this.publish.bind(this)
        };
        for (const p of this.plugins.values()) {
            if (p.match(ctx)) {
                if (p.decode)
                    ctx.payload = p.decode(raw);
                p.onMessage?.(ctx);
            }
        }
        try {
            const rawStr = raw.toString('utf8');
            let topic = null;
            let payload = null;
            try {
                const parsed = JSON.parse(rawStr);
                if (parsed.type === 'pub' && parsed.topic) {
                    topic = parsed.topic;
                    payload = parsed.payload;
                }
                else if (parsed.type === 'PULL_REQUEST' && parsed.topic && deviceId) {
                    this.subPull(deviceId, parsed.topic, parsed.count);
                    return;
                }
                else if (parsed.type === 'FILE_REQUEST' && parsed.fileId && deviceId) {
                    await this.subFile(deviceId, parsed.fileId, parsed.startChunk || 0);
                    return;
                }
                else if (parsed.topic) {
                    topic = parsed.topic;
                    payload = parsed.payload;
                }
            }
            catch (e) {
                // BUG FIX #2: When raw JSON parse fails, the message may be base64 or hex encoded.
                // djson(Buffer) bypasses autoDetect for Buffer inputs and returns { raw: '...' } without
                // trying base64/hex decode. So we must manually detect and decode base64/hex here.
                let innerStr = null;
                // Try base64 decode: rawStr must match base64 char set and be length % 4 === 0
                if (/^[A-Za-z0-9+/=]+$/.test(rawStr) && rawStr.length % 4 === 0) {
                    try {
                        const b64Decoded = Buffer.from(rawStr, 'base64').toString('utf8');
                        if (b64Decoded.includes('{')) {
                            innerStr = b64Decoded;
                        }
                    }
                    catch {
                        // not base64
                    }
                }
                // Try hex decode: rawStr must be even-length hex chars only
                if (!innerStr && /^[0-9a-fA-F]+$/.test(rawStr) && rawStr.length % 2 === 0) {
                    try {
                        const hexDecoded = Buffer.from(rawStr, 'hex').toString('utf8');
                        if (hexDecoded.includes('{')) {
                            innerStr = hexDecoded;
                        }
                    }
                    catch {
                        // not hex
                    }
                }
                // If we successfully decoded, try to parse the inner JSON
                if (innerStr) {
                    try {
                        const inner = JSON.parse(innerStr);
                        if (inner.type === 'pub' && inner.topic) {
                            topic = inner.topic;
                            payload = inner.payload;
                        }
                        else if (inner.topic) {
                            topic = inner.topic;
                            payload = inner.payload;
                        }
                    }
                    catch {
                        // inner JSON parse failed
                    }
                }
                // Fallback: try djson for other custom formats
                if (!topic) {
                    const decoded = (0, djson_1.djson)(rawStr);
                    if (decoded && typeof decoded === 'object') {
                        if (decoded.type === 'pub' && decoded.topic) {
                            topic = decoded.topic;
                            payload = decoded.payload;
                        }
                        else if (decoded.topic) {
                            topic = decoded.topic;
                            payload = decoded.payload;
                        }
                    }
                }
            }
            if (topic && payload !== null) {
                this.publish(topic, payload, {}, deviceId);
            }
            else {
                if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
                    try {
                        const data = JSON.parse(rawStr);
                        this.emit('data', { deviceId, data });
                    }
                    catch {
                        this.emit('raw', { deviceId, raw });
                    }
                }
                else {
                    this.emit('raw', { deviceId, raw });
                }
            }
        }
        catch (err) {
            console.error('Handle error:', err);
            this.emit('raw', { deviceId, raw });
        }
    }
    broadcast(topic, payload, opts = {}) {
        const jsonPayload = this.toJSON(payload);
        for (const [deviceId, device] of this.devices) {
            if (opts.exclude?.includes(deviceId))
                continue;
            if (device.socket && device.socket.readyState === 1) {
                try {
                    if (this.config.useBinaryProtocol) {
                        const buffer = (0, djson_1.toBuffer)(jsonPayload);
                        device.socket.send(buffer);
                    }
                    else {
                        device.socket.send(jsonPayload);
                    }
                }
                catch (err) {
                    console.error(`Failed to broadcast to ${deviceId}:`, err);
                }
            }
        }
    }
    use(plugin) {
        this.plugins.set(plugin.name, plugin);
    }
    register(deviceId, socket, metadata) {
        let device = this.devices.get(deviceId);
        
        if (!device) {
            device = {
                lastSeen: Date.now(),
                sockets: new Set(),
                metadata,
                handler: (payload) => {
                    // Shared handler for all sockets of this device
                    for (const s of device.sockets) {
                        if (s.readyState === 1) {
                            try {
                                const message = this.config.useBinaryProtocol
                                    ? (0, djson_1.toBuffer)(payload)
                                    : JSON.stringify(payload);
                                s.send(message);
                            } catch (err) { }
                        }
                    }
                }
            };
            this.devices.set(deviceId, device);

            // Subscribe only ONCE per device lifecycle
            this.subscribe(`phone/signaling/${deviceId}`, device.handler, deviceId);
            this.subscribe(`phone/signaling/all`, device.handler, deviceId);
        }
        
        device.sockets.add(socket);
        device.lastSeen = Date.now();
        this.log(`Device ${deviceId} registered socket (Total: ${device.sockets.size})`);
    }

    unregister(deviceId, socket) {
        const device = this.devices.get(deviceId);
        if (device) {
            if (socket) {
                device.sockets.delete(socket);
                try { socket.close(); } catch (e) { }
            }
            
            if (device.sockets.size === 0) {
                // Cleanup subscriptions from TRIE to avoid memory leaks
                if (device.handler) {
                    this.trie.remove(`phone/signaling/${deviceId}`, device.handler);
                    this.trie.remove(`phone/signaling/all`, device.handler);
                }
                this.devices.delete(deviceId);
                this.log(`Device ${deviceId} fully unregistered`);
            } else {
                this.log(`Device ${deviceId} socket unregistered (Remaining: ${device.sockets.size})`);
            }
        }
    }

    sendTo(deviceId, payload) {
        const device = this.devices.get(deviceId);
        if (!device || device.sockets.size === 0) return false;

        let success = false;
        for (const s of device.sockets) {
            if (s.readyState === 1) {
                try {
                    const data = this.config.useBinaryProtocol
                        ? (0, djson_1.toBuffer)(payload)
                        : JSON.stringify(payload);
                    s.send(data);
                    success = true;
                } catch (err) { }
            }
        }
        return success;
    }

    isReady(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return false;
        for (const s of device.sockets) {
            if (s.readyState === 1) return true;
        }
        return false;
    }
    
    getSocket(deviceId) {
        // Compatibility: return the first active socket
        const device = this.devices.get(deviceId);
        if (!device) return null;
        for (const s of device.sockets) {
            if (s.readyState === 1) return s;
        }
        return null;
    }
    touch(deviceId) {
        const d = this.devices.get(deviceId);
        if (d)
            d.lastSeen = Date.now();
    }
    getStats() {
        return {
            version: '2.0',
            cacheSize: this.jsonCache.size,
            devices: this.devices.size,
            retained: this.retained.size,
            plugins: this.plugins.size,
            cacheEnabled: this.config.enableJSONCache || false,
            // v2.0 stats
            highFreqBuffers: this.highFreqBuffers.size,
            files: this.fileRegistry.size,
            activeTransfers: this.fileProgress.size,
            peers: this.peerRegistry.size
        };
    }
    /**
     * Clean up resources - Call this when shutting down
     */
    async destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        if (this.bufferCleanupInterval) {
            clearInterval(this.bufferCleanupInterval);
        }
        if (this.redisPub) {
            await this.redisPub.quit();
        }
        if (this.redisSub) {
            await this.redisSub.quit();
        }
        this.trie = new trie_1.TopicTrie();
        this.retained.clear();
        this.devices.clear();
        this.plugins.clear();
        this.pending.clear();
        this.jsonCache.clear();
        this.highFreqBuffers.clear();
        this.fileRegistry.clear();
        this.fileProgress.clear();
        this.peerRegistry.clear();
        this.removeAllListeners();
        this.log('RealtimeCore v2 destroyed');
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [k, v] of this.retained) {
                if (v.ttl && now - v.ts > v.ttl)
                    this.retained.delete(k);
            }
            for (const [id, d] of this.devices) {
                if (d.socket && typeof d.socket.ping === 'function') {
                    try {
                        d.socket.ping();
                    }
                    catch { }
                }
                if (now - d.lastSeen > 60000) {
                    console.log(`[Realtime] Device ${id} timed out. Cleanup.`);
                    this.unregister(id);
                }
            }
        }, 5000);
    }
}
exports.RealtimeCore = RealtimeCore;
// Export for use
var trie_2 = require("./trie");
Object.defineProperty(exports, "TopicTrie", { enumerable: true, get: function () { return trie_2.TopicTrie; } });
var codec_2 = require("./codec");
Object.defineProperty(exports, "encode", { enumerable: true, get: function () { return codec_2.encode; } });
Object.defineProperty(exports, "decode", { enumerable: true, get: function () { return codec_2.decode; } });
Object.defineProperty(exports, "getSize", { enumerable: true, get: function () { return codec_2.getSize; } });
var djson_2 = require("../djson/djson");
Object.defineProperty(exports, "djson", { enumerable: true, get: function () { return djson_2.djson; } });
Object.defineProperty(exports, "toBuffer", { enumerable: true, get: function () { return djson_2.toBuffer; } });
Object.defineProperty(exports, "toBase64", { enumerable: true, get: function () { return djson_2.toBase64; } });
//# sourceMappingURL=core.js.map