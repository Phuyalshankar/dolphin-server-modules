import { EventEmitter } from 'events';
import { TopicTrie } from './trie';
import { encode, decode, getSize } from './codec';
import { RealtimePlugin, RealtimeContext } from './plugins';

/**
 * RealtimeCore - High performance unified pub/sub bus for Dolphin.
 * Supports:
 * - Local event emitter (in-process)
 * - Distributed bus via Redis (optional)
 * - Retained messages with TTL
 * - Device/Client tracking
 * - Plugin-based protocol handling
 */
export class RealtimeCore extends EventEmitter {
  private trie = new TopicTrie();
  private retained = new Map<string, { payload: any, ts: number, ttl: number }>();
  private devices = new Map<string, { lastSeen: number, socket?: any }>();
  private plugins = new Map<string, RealtimePlugin>();
  private pending = new Map<number, any>();
  private msgId = 0;

  private redisPub?: any;
  private redisSub?: any;

  constructor(private config: { 
    maxMessageSize?: number, 
    redisUrl?: string,
    acl?: { 
      canSubscribe: (deviceId: string, topic: string) => boolean,
      canPublish: (deviceId: string, topic: string) => boolean
    }
  } = {}) {
    super();

    if (config.redisUrl) {
      this.initRedis(config.redisUrl);
    }

    this.startCleanup();
  }

  /**
   * Initialize Redis for distributed pub/sub.
   */
  private async initRedis(url: string) {
    try {
      // @ts-ignore
      const Redis = (await import('ioredis')).default;
      this.redisPub = new Redis(url);
      this.redisSub = new Redis(url);

      this.redisSub.subscribe('dolphin-rt');
      this.redisSub.on('message', (_: string, msg: string) => {
        const { topic, payload } = JSON.parse(msg);
        this.publishInternal(topic, payload, { skipRedis: true });
      });
    } catch (err) {
      console.warn('Redis initialization failed (ioredis not found or connection error):', err);
    }
  }

  /**
   * Subscribe to a topic pattern.
   */
  subscribe(topic: string, fn: (data: any) => void, deviceId?: string) {
    if (deviceId && this.config.acl && !this.config.acl.canSubscribe(deviceId, topic)) {
      throw new Error('ACL deny');
    }

    this.trie.add(topic, fn);

    // Replay retained messages
    for (const [t, data] of this.retained.entries()) {
      // Small hack: if we match the new subscription, replay
      // We can improve this by matching the pattern against the topic
      // For now, only exact match for simplicity or improve TopicTrie
      if (t === topic) fn(data.payload);
    }
  }

  /**
   * Publish a message to a topic.
   */
  publish(topic: string, payload: any, opts: { retain?: boolean, ttl?: number } = {}, deviceId?: string) {
    if (getSize(payload) > (this.config.maxMessageSize || 256 * 1024)) {
      throw new Error('Payload too large');
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

    // Match and emit locally
    this.trie.match(topic, (fn) => fn({ topic, payload }));
    this.emit('message', { topic, payload });

    // Publish to Redis if available
    if (this.redisPub && !opts.skipRedis) {
      this.redisPub.publish('dolphin-rt', JSON.stringify({ topic, payload }));
    }
  }

  /**
   * Handle raw data from a socket.
   */
  async handle(raw: Buffer, socket?: any, deviceId?: string) {
    if (raw.length > (this.config.maxMessageSize || 256 * 1024)) return;

    // Create initial context
    const ctx: RealtimeContext = {
      type: 'raw',
      raw,
      socket,
      deviceId,
      ts: Date.now(),
      publish: this.publish.bind(this)
    };

    // Plugin matching and decoding
    for (const p of this.plugins.values()) {
      if (p.match(ctx)) {
        if (p.decode) ctx.payload = p.decode(raw);
        p.onMessage?.(ctx);
        // If plugin handled it, we might want to stop or continue.
        // For now, let's continue to allow multiple plugins or default handling.
      }
    }

    // Default handling for 'pub' style packets if no plugin decoded it or just generic
    try {
      const decoded = decode(raw);
      if (decoded && typeof decoded === 'object' && decoded.type === 'pub') {
        this.publish(decoded.topic, decoded.payload, {}, deviceId);
      }
    } catch {
      // Ignore decode errors for raw data
    }
  }

  /**
   * Register a plugin.
   */
  use(plugin: RealtimePlugin) {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Register a device/client.
   */
  register(deviceId: string, socket?: any) {
    this.devices.set(deviceId, { lastSeen: Date.now(), socket });
  }

  /**
   * Heartbeat for a device.
   */
  touch(deviceId: string) {
    const d = this.devices.get(deviceId);
    if (d) d.lastSeen = Date.now();
  }

  private startCleanup() {
    setInterval(() => {
      const now = Date.now();

      // Clean retained messages
      for (const [k, v] of this.retained) {
        if (v.ttl && now - v.ts > v.ttl) this.retained.delete(k);
      }

      // Clean inactive devices (1 minute timeout)
      for (const [id, d] of this.devices) {
        if (now - d.lastSeen > 60000) this.devices.delete(id);
      }
    }, 5000);
  }
}
