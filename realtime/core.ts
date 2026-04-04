import { EventEmitter } from 'events';
import { TopicTrie } from './trie';
import { encode, decode, getSize } from './codec';
import { RealtimePlugin, RealtimeContext } from './plugins';
import { djson, toBuffer, toBase64 } from '../djson/djson';

/**
 * RealtimeCore - High performance unified pub/sub bus for Dolphin.
 */
export class RealtimeCore extends EventEmitter {
  private trie = new TopicTrie();
  private retained = new Map<string, { payload: any, ts: number, ttl: number, encoded?: string }>();
  private devices = new Map<string, { lastSeen: number, socket?: any, metadata?: any }>();
  private plugins = new Map<string, RealtimePlugin>();
  private pending = new Map<number, any>();
  private msgId = 0;
  
  private jsonCache = new Map<string, { result: string, timestamp: number }>();
  private readonly CACHE_TTL = 5000;
  private readonly MAX_CACHE_SIZE = 100;

  private redisPub?: any;
  private redisSub?: any;
  
  // Cleanup intervals
  private cleanupInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(private config: { 
    maxMessageSize?: number, 
    redisUrl?: string,
    acl?: { 
      canSubscribe: (deviceId: string, topic: string) => boolean,
      canPublish: (deviceId: string, topic: string) => boolean
    },
    enableJSONCache?: boolean,
    useBinaryProtocol?: boolean,
    debug?: boolean
  } = {}) {
    super();

    if (config.redisUrl) {
      this.initRedis(config.redisUrl);
    }

    this.startCleanup();
    
    if (config.enableJSONCache) {
      this.cacheCleanupInterval = setInterval(() => this.cleanJSONCache(), 10000);
    }
  }

  private log(...args: any[]) {
    if (this.config.debug) {
      console.log('[RealtimeCore]', ...args);
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

    for (const [t, data] of this.retained.entries()) {
      if (t === topic) fn(data.payload);
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

  /**
   * Handle raw data from a socket with DJSON integration
   */
  async handle(raw: Buffer, socket?: any, deviceId?: string) {
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
      this.log('Raw string:', rawStr);
      
      let topic: string | null = null;
      let payload: any = null;
      
      // First try: Direct JSON parse
      try {
        const parsed = JSON.parse(rawStr);
        this.log('Direct JSON parse result:', JSON.stringify(parsed));
        
        if (parsed.type === 'pub' && parsed.topic) {
          topic = parsed.topic;
          payload = parsed.payload;
        } else if (parsed.topic) {
          topic = parsed.topic;
          payload = parsed.payload;
        }
      } catch (e) {
        this.log('Direct JSON parse failed, trying DJSON');
        
        // Second try: DJSON
        const decoded = djson(raw);
        this.log('DJSON decoded:', JSON.stringify(decoded, null, 2));
        
        if (decoded && typeof decoded === 'object') {
          // Check for raw field (base64 or hex encoded data)
          if (decoded.raw && typeof decoded.raw === 'string') {
            this.log('Found raw field, attempting to decode');
            
            let decodedBuffer: Buffer | null = null;
            let decodedString: string | null = null;
            
            // Try to decode as base64 first
            try {
              decodedBuffer = Buffer.from(decoded.raw, 'base64');
              decodedString = decodedBuffer.toString('utf8');
              this.log('Decoded as base64');
            } catch (err) {
              this.log('Failed to decode as base64');
            }
            
            // If base64 decoding produced a valid JSON string, parse it
            if (decodedString && (decodedString.trim().startsWith('{') || decodedString.trim().startsWith('['))) {
              try {
                const parsed = JSON.parse(decodedString);
                if (parsed.type === 'pub' && parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                } else if (parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                }
              } catch (err) {
                this.log('Failed to parse base64 decoded string as JSON');
              }
            }
            
            // If not handled yet, try hex decoding
            if (!topic && /^[0-9a-fA-F]+$/.test(decoded.raw)) {
              try {
                decodedBuffer = Buffer.from(decoded.raw, 'hex');
                decodedString = decodedBuffer.toString('utf8');
                this.log('Decoded as hex');
                
                if (decodedString && (decodedString.trim().startsWith('{') || decodedString.trim().startsWith('['))) {
                  const parsed = JSON.parse(decodedString);
                  if (parsed.type === 'pub' && parsed.topic) {
                    topic = parsed.topic;
                    payload = parsed.payload;
                  } else if (parsed.topic) {
                    topic = parsed.topic;
                    payload = parsed.payload;
                  }
                }
              } catch (err) {
                this.log('Failed to decode as hex or parse result');
              }
            }
          }
          
          // Check for _type field (hex/base64 from DJSON)
          if (!topic && (decoded._type === 'hex' || decoded._type === 'base64')) {
            // Try to get from buffer
            if (decoded.buffer && Buffer.isBuffer(decoded.buffer)) {
              const bufferStr = decoded.buffer.toString('utf8');
              try {
                const parsed = JSON.parse(bufferStr);
                if (parsed.type === 'pub' && parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                } else if (parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                }
              } catch (err) {
                this.log('Failed to parse buffer as JSON');
              }
            }
            
            // Try utf8 field
            if (!topic && decoded.utf8) {
              try {
                const parsed = JSON.parse(decoded.utf8);
                if (parsed.type === 'pub' && parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                } else if (parsed.topic) {
                  topic = parsed.topic;
                  payload = parsed.payload;
                }
              } catch (err) {
                this.log('Failed to parse utf8 field as JSON');
              }
            }
          }
          
          // Check for direct pub format in DJSON output
          if (!topic && decoded.type === 'pub' && decoded.topic) {
            topic = decoded.topic;
            payload = decoded.payload;
          } else if (!topic && decoded.topic) {
            topic = decoded.topic;
            payload = decoded.payload;
          }
        }
      }
      
      if (topic && payload !== null) {
        this.log('PUBLISHING - Topic:', topic);
        this.publish(topic, payload, {}, deviceId);
      } else {
        this.log('No topic found, emitting as data/raw');
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
      cacheSize: this.jsonCache.size,
      devices: this.devices.size,
      retained: this.retained.size,
      plugins: this.plugins.size,
      cacheEnabled: this.config.enableJSONCache || false
    };
  }

  /**
   * Clean up resources - Call this when shutting down
   */
  async destroy() {
    // Clear all intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    // Close Redis connections
    if (this.redisPub) {
      await this.redisPub.quit();
    }
    if (this.redisSub) {
      await this.redisSub.quit();
    }
    
    // Clear all maps
    this.trie = new TopicTrie();
    this.retained.clear();
    this.devices.clear();
    this.plugins.clear();
    this.pending.clear();
    this.jsonCache.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    this.log('RealtimeCore destroyed');
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