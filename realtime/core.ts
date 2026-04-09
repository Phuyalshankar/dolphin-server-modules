import { EventEmitter } from 'events';
import { TopicTrie } from './trie';
import { encode, decode, getSize } from './codec';
import { RealtimePlugin, RealtimeContext } from './plugins';
import { djson, toBuffer, toBase64 } from '../djson/djson';
import * as fs from 'fs';

/**
 * File Metadata Interface
 */
interface FileMetadata {
  path: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  name: string;
  hash?: string;
  createdAt: number;
}

/**
 * Buffered Message Interface
 */
interface BufferedMessage {
  data: any;
  ts: number;
  isBinary?: boolean;
}

/**
 * RealtimeCore v2.0 - High performance unified pub/sub bus for Dolphin
 * Added Features: pubPush, subPull, pubFile, subFile, Resume, P2P Stream
 */
export class RealtimeCore extends EventEmitter {
  private trie = new TopicTrie();
  private retained = new Map<string, { payload: any, ts: number, ttl: number, encoded?: string }>();
  private devices = new Map<string, { lastSeen: number, socket?: any, metadata?: any }>();
  private plugins = new Map<string, RealtimePlugin>();
  private pending = new Map<number, any>();
  private msgId = 0;
  
  // High-Frequency Buffers (pubPush/subPull)
  private highFreqBuffers = new Map<string, BufferedMessage[]>();
  private readonly MAX_BUFFER_SIZE = 100;  // Lightweight: only 100 items per topic
  
  // File Transfer Registry (pubFile/subFile)
  private fileRegistry = new Map<string, FileMetadata>();
  private fileProgress = new Map<string, Map<string, number>>(); // deviceId -> fileId -> lastChunk
  private readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks (Lightweight)
  
  // P2P Peer Registry
  private peerRegistry = new Map<string, Set<string>>(); // fileId -> Set<deviceId>
  
  // JSON Cache (existing)
  private jsonCache = new Map<string, { result: string, timestamp: number }>();
  private readonly CACHE_TTL = 5000;
  private readonly MAX_CACHE_SIZE = 100;

  private redisPub?: any;
  private redisSub?: any;
  
  // Cleanup intervals
  private cleanupInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;
  private bufferCleanupInterval?: NodeJS.Timeout;

  constructor(private config: { 
    maxMessageSize?: number, 
    redisUrl?: string,
    acl?: { 
      canSubscribe: (deviceId: string, topic: string) => boolean,
      canPublish: (deviceId: string, topic: string) => boolean
    },
    enableJSONCache?: boolean,
    useBinaryProtocol?: boolean,
    debug?: boolean,
    // v2.0 new options
    maxBufferPerTopic?: number,
    defaultChunkSize?: number,
    enableP2P?: boolean
  } = {}) {
    super();

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

  private log(...args: any[]) {
    if (this.config.debug) {
      console.log('[RealtimeCore v2]', ...args);
    }
  }

  private toJSON(data: any, skipCache = false): string {
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
    } catch (err) {
      return JSON.stringify({ error: 'Circular structure', raw: String(data) });
    }
  }
  
  private getCacheKey(obj: any): string {
    if (typeof obj !== 'object') return String(obj);
    const keys = Object.keys(obj).slice(0, 3);
    return keys.map(k => `${k}:${String(obj[k]).substring(0, 50)}`).join('|');
  }
  
  private setCache(key: string, value: string) {
    if (this.jsonCache.size >= this.MAX_CACHE_SIZE) {
      const oldest = Array.from(this.jsonCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.jsonCache.delete(oldest[0]);
    }
    this.jsonCache.set(key, { result: value, timestamp: Date.now() });
  }
  
  private cleanJSONCache() {
    const now = Date.now();
    for (const [key, value] of this.jsonCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.jsonCache.delete(key);
      }
    }
  }
  
  private cleanupBuffers() {
    // Remove old buffers that haven't been accessed
    const now = Date.now();
    for (const [topic, buffer] of this.highFreqBuffers.entries()) {
      // Remove messages older than 5 minutes
      const freshBuffer = buffer.filter(msg => now - msg.ts < 300000);
      if (freshBuffer.length === 0) {
        this.highFreqBuffers.delete(topic);
      } else if (freshBuffer.length !== buffer.length) {
        this.highFreqBuffers.set(topic, freshBuffer);
      }
    }
  }

  private async initRedis(url: string) {
    try {
      const Redis = (await import('ioredis')).default;
      this.redisPub = new Redis(url);
      this.redisSub = new Redis(url);

      this.redisSub.subscribe('dolphin-rt');
      this.redisSub.on('message', (_: string, msg: string) => {
        try {
          const { topic, payload } = JSON.parse(msg, (key, value) => {
            if (value && value._type === 'buffer' && value.data) {
              return Buffer.from(value.data, 'base64');
            }
            return value;
          });
          this.publishInternal(topic, payload, { skipRedis: true });
        } catch (err) {
          console.error('Redis message parse error:', err);
        }
      });
    } catch (err) {
      console.warn('Redis initialization failed:', err);
    }
  }

  subscribe(topic: string, fn: (data: any) => void, deviceId?: string) {
    if (deviceId && this.config.acl && !this.config.acl.canSubscribe(deviceId, topic)) {
      throw new Error('ACL deny');
    }

    this.trie.add(topic, fn);

    // BUG FIX #1: Use TopicTrie matching for retained messages instead of exact string compare.
    // Previously `t === topic` only matched exact topics, breaking wildcard subscriptions like
    // 'sensors/+' or 'sensors/#' which would never receive retained messages.
    for (const [t, data] of this.retained.entries()) {
      const tempTrie = new TopicTrie();
      tempTrie.add(topic, fn);
      tempTrie.match(t, (matchedFn: Function) => matchedFn(data.payload));
    }
  }

  publish(topic: string, payload: any, opts: { retain?: boolean, ttl?: number } = {}, deviceId?: string) {
    const size = getSize(payload);
    if (size > (this.config.maxMessageSize || 256 * 1024)) {
      throw new Error(`Payload too large: ${size} bytes`);
    }

    if (deviceId && this.config.acl && !this.config.acl.canPublish(deviceId, topic)) {
      throw new Error('ACL deny');
    }

    this.publishInternal(topic, payload, opts);
  }

  private publishInternal(topic: string, payload: any, opts: any = {}) {
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
  pubPush(topic: string, payload: Buffer | Uint8Array | any) {
    let buffer: Buffer;
    let isBinary = false;
    
    if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
      buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      isBinary = true;
    } else {
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
  subPull(deviceId: string, topic: string, count: number = 10) {
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
  pubFile(fileId: string, filePath: string, chunkSize?: number): FileMetadata | null {
    
    if (!fs.existsSync(filePath)) {
      this.log(`pubFile: File not found - ${filePath}`);
      return null;
    }
    
    const stats = fs.statSync(filePath);
    const finalChunkSize = chunkSize || this.config.defaultChunkSize || this.DEFAULT_CHUNK_SIZE;
    
    // FIX: Extract just the filename, not the full path (supports both Windows and Unix paths)
    const filename = filePath.split(/[/\\]/).pop() || filePath;
    
    const metadata: FileMetadata = {
      path: filePath,
      size: stats.size,
      chunkSize: finalChunkSize,
      totalChunks: Math.ceil(stats.size / finalChunkSize),
      name: filename,  // Use just the filename, not the full path
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
  async subFile(deviceId: string, fileId: string, startChunk: number = 0): Promise<boolean> {
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
    } catch (err) {
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
  async resumeFile(deviceId: string, fileId: string): Promise<boolean> {
    const lastChunk = this.getFileProgress(deviceId, fileId);
    const nextChunk = lastChunk + 1;
    
    this.log(`resumeFile: ${deviceId} resuming ${fileId} from chunk ${nextChunk}`);
    
    return this.subFile(deviceId, fileId, nextChunk);
  }
  
  /**
   * saveFileProgress: डाउनलोड प्रगति सेभ गर्ने
   */
  private saveFileProgress(deviceId: string, fileId: string, lastChunk: number) {
    if (!this.fileProgress.has(deviceId)) {
      this.fileProgress.set(deviceId, new Map());
    }
    this.fileProgress.get(deviceId)!.set(fileId, lastChunk);
  }
  
  /**
   * getFileProgress: पहिलेको प्रगति पुनः प्राप्त गर्ने (Resume को लागि)
   */
  getFileProgress(deviceId: string, fileId: string): number {
    return this.fileProgress.get(deviceId)?.get(fileId) ?? -1;
  }
  
  /**
   * getFileInfo: फाइलको जानकारी लिने
   */
  getFileInfo(fileId: string): FileMetadata | undefined {
    return this.fileRegistry.get(fileId);
  }
  
  /**
   * listFiles: सबै उपलब्ध फाइलहरूको सूची
   */
  listFiles(): Array<{ fileId: string, name: string, size: number, totalChunks: number }> {
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
  announceToPeers(fileId: string, availableAtDeviceId: string) {
    if (!this.config.enableP2P) return;
    
    if (!this.peerRegistry.has(fileId)) {
      this.peerRegistry.set(fileId, new Set());
    }
    this.peerRegistry.get(fileId)!.add(availableAtDeviceId);
    
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
  getPeersForFile(fileId: string): string[] {
    return Array.from(this.peerRegistry.get(fileId) || []);
  }
  
  /**
   * requestFromPeer: पीयरबाट सिधै डाटा माग गर्ने
   */
  requestFromPeer(deviceId: string, peerId: string, fileId: string, chunkIndex: number) {
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
  sendToPeer(fromDeviceId: string, toDeviceId: string, payload: any): boolean {
    const targetSocket = this.getSocket(toDeviceId);
    
    if (targetSocket && targetSocket.readyState === 1) {
      const message = this.config.useBinaryProtocol 
        ? toBuffer(payload)
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
  isReady(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    return !!(device?.socket && device.socket.readyState === 1);
  }
  
  /**
   * isOnline: डिभाइस अनलाइन छ कि छैन (साधारण चेक)
   */
  isOnline(deviceId: string): boolean {
    return this.devices.has(deviceId);
  }
  
  /**
   * sendTo: सिधै डिभाइसलाई मेसेज पठाउने (No Pub/Sub overhead)
   */
  sendTo(deviceId: string, payload: any): boolean {
    if (!this.isReady(deviceId)) return false;
    
    try {
      const device = this.devices.get(deviceId)!;
      const data = this.config.useBinaryProtocol 
        ? toBuffer(payload) 
        : JSON.stringify(payload);
        
      device.socket.send(data);
      return true;
    } catch (err) {
      console.error(`[Realtime] Send failed to ${deviceId}:`, err);
      return false;
    }
  }
  
  /**
   * kick: खराब वा अनधिकृत डिभाइसलाई हटाउने
   */
  kick(deviceId: string, reason: string = "Disconnected by server") {
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
  broadcastToGroup(groupName: string, payload: any) {
    for (const [id, device] of this.devices) {
      if (device.metadata?.group === groupName && this.isReady(id)) {
        this.sendTo(id, payload);
      }
    }
  }
  
  /**
   * getOnlineDevices: सबै अनलाइन डिभाइसहरूको लिस्ट दिने
   */
  getOnlineDevices(): Array<{ id: string, lastSeen: number, group?: string }> {
    return Array.from(this.devices.entries()).map(([id, d]) => ({
      id,
      lastSeen: d.lastSeen,
      group: d.metadata?.group || 'default'
    }));
  }
  
  /**
   * ping: डिभाइसलाई Alive छ कि छैन भनेर चेक गर्न Ping पठाउने
   */
  ping(deviceId: string): boolean {
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
  privateSub(deviceId: string, fn: (data: any) => void) {
    const privateTopic = `phone/signaling/${deviceId}`;
    this.subscribe(privateTopic, fn, deviceId);
    this.log(`[Private] ${deviceId} subscribed to private channel`);
  }
  
  /**
   * privatePub: कुनै विशेष डिभाइसको निजी च्यानलमा मात्र मेसेज पठाउन
   */
  privatePub(targetId: string, payload: any, opts: { retain?: boolean, ttl?: number } = {}) {
    const privateTopic = `phone/signaling/${targetId}`;
    this.publish(privateTopic, payload, opts, 'SYSTEM');
    this.log(`[Private] Message sent to ${targetId}`);
  }
  
  // ============================================
  // Existing Methods (preserved for compatibility)
  // ============================================
  
  async handle(raw: Buffer, socket?: any, deviceId?: string) {
    // ... (existing handle method remains the same)
    if (raw.length > (this.config.maxMessageSize || 256 * 1024)) return;

    const ctx: RealtimeContext = {
      type: 'raw',
      raw,
      socket,
      deviceId,
      ts: Date.now(),
      publish: this.publish.bind(this)
    };

    for (const p of this.plugins.values()) {
      if (p.match(ctx)) {
        if (p.decode) ctx.payload = p.decode(raw);
        p.onMessage?.(ctx);
      }
    }

    try {
      const rawStr = raw.toString('utf8');
      
      let topic: string | null = null;
      let payload: any = null;
      
      try {
        const parsed = JSON.parse(rawStr);
        if (parsed.type === 'pub' && parsed.topic) {
          topic = parsed.topic;
          payload = parsed.payload;
        } else if (parsed.type === 'PULL_REQUEST' && parsed.topic && deviceId) {
          this.subPull(deviceId, parsed.topic, parsed.count);
          return;
        } else if (parsed.type === 'FILE_REQUEST' && parsed.fileId && deviceId) {
          await this.subFile(deviceId, parsed.fileId, parsed.startChunk || 0);
          return;
        } else if (parsed.topic) {
          topic = parsed.topic;
          payload = parsed.payload;
        }
      } catch (e) {
        // BUG FIX #2: When raw JSON parse fails, the message may be base64 or hex encoded.
        // djson(Buffer) bypasses autoDetect for Buffer inputs and returns { raw: '...' } without
        // trying base64/hex decode. So we must manually detect and decode base64/hex here.
        let innerStr: string | null = null;

        // Try base64 decode: rawStr must match base64 char set and be length % 4 === 0
        if (/^[A-Za-z0-9+/=]+$/.test(rawStr) && rawStr.length % 4 === 0) {
          try {
            const b64Decoded = Buffer.from(rawStr, 'base64').toString('utf8');
            if (b64Decoded.includes('{')) {
              innerStr = b64Decoded;
            }
          } catch {
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
          } catch {
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
            } else if (inner.topic) {
              topic = inner.topic;
              payload = inner.payload;
            }
          } catch {
            // inner JSON parse failed
          }
        }

        // Fallback: try djson for other custom formats
        if (!topic) {
          const decoded = djson(rawStr);
          if (decoded && typeof decoded === 'object') {
            if (decoded.type === 'pub' && decoded.topic) {
              topic = decoded.topic;
              payload = decoded.payload;
            } else if (decoded.topic) {
              topic = decoded.topic;
              payload = decoded.payload;
            }
          }
        }
      }
      
      if (topic && payload !== null) {
        this.publish(topic, payload, {}, deviceId);
      } else {
        if (rawStr.trim().startsWith('{') || rawStr.trim().startsWith('[')) {
          try {
            const data = JSON.parse(rawStr);
            this.emit('data', { deviceId, data });
          } catch {
            this.emit('raw', { deviceId, raw });
          }
        } else {
          this.emit('raw', { deviceId, raw });
        }
      }
    } catch (err) {
      console.error('Handle error:', err);
      this.emit('raw', { deviceId, raw });
    }
  }

  broadcast(topic: string, payload: any, opts: { exclude?: string[] } = {}) {
    const jsonPayload = this.toJSON(payload);
    
    for (const [deviceId, device] of this.devices) {
      if (opts.exclude?.includes(deviceId)) continue;
      
      if (device.socket && device.socket.readyState === 1) {
        try {
          if (this.config.useBinaryProtocol) {
            const buffer = toBuffer(jsonPayload);
            device.socket.send(buffer);
          } else {
            device.socket.send(jsonPayload);
          }
        } catch (err) {
          console.error(`Failed to broadcast to ${deviceId}:`, err);
        }
      }
    }
  }

  use(plugin: RealtimePlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  register(deviceId: string, socket?: any, metadata?: any) {
    // Handle reconnection: remove old ghost connection
    if (this.devices.has(deviceId)) {
      this.log(`[Reconnect] Device ${deviceId} reconnecting, cleaning up old...`);
      const oldDevice = this.devices.get(deviceId);
      if (oldDevice?.socket && oldDevice.socket !== socket) {
        try { oldDevice.socket.close(); } catch {}
      }
    }
    
    this.devices.set(deviceId, { 
      lastSeen: Date.now(), 
      socket,
      metadata
    });

    if (socket) {
        this.subscribe(`phone/signaling/${deviceId}`, (payload) => {
            if (socket.readyState === 1) {
                try {
                    const message = this.config.useBinaryProtocol 
                      ? toBuffer(payload)
                      : JSON.stringify(payload);
                    socket.send(message);
                } catch (err) {
                    console.error(`[Realtime] Failed to send to device ${deviceId}:`, err);
                }
            }
        }, deviceId);
        
        this.subscribe(`phone/signaling/all`, (payload) => {
             if (socket.readyState === 1) {
                 try { 
                     const message = this.config.useBinaryProtocol 
                       ? toBuffer(payload)
                       : JSON.stringify(payload);
                     socket.send(message); 
                 } catch {}
             }
        }, deviceId);
    }
  }

  unregister(deviceId: string) {
    const device = this.devices.get(deviceId);
    if (device?.socket) {
      try { device.socket.close(); } catch {}
    }
    this.devices.delete(deviceId);
  }

  getSocket(deviceId: string) {
    return this.devices.get(deviceId)?.socket;
  }

  touch(deviceId: string) {
    const d = this.devices.get(deviceId);
    if (d) d.lastSeen = Date.now();
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
    
    this.trie = new TopicTrie();
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

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [k, v] of this.retained) {
        if (v.ttl && now - v.ts > v.ttl) this.retained.delete(k);
      }

      for (const [id, d] of this.devices) {
        if (d.socket && typeof d.socket.ping === 'function') {
           try { d.socket.ping(); } catch {}
        }
        
        if (now - d.lastSeen > 60000) {
          console.log(`[Realtime] Device ${id} timed out. Cleanup.`);
          this.unregister(id);
        }
      }
    }, 5000);
  }
}

// Export for use
export { TopicTrie } from './trie';
export { encode, decode, getSize } from './codec';
export { RealtimePlugin, RealtimeContext } from './plugins';
export { djson, toBuffer, toBase64 } from '../djson/djson';