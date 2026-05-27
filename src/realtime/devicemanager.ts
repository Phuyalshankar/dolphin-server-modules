import { EventEmitter } from 'events';

/**
 * Device - represents a connected client/device (IoT, Camera, Mobile, Browser, etc.)
 * Fully framework-agnostic. Can be used with any realtime transport.
 */
export interface Device {
  id: string;
  metadata: Record<string, any>;
  lastSeen: number;
  isOnline: boolean;
  subscriptions: Set<string>;
}

/**
 * Configuration options for DeviceManager
 */
export interface DeviceManagerOptions {
  /** Time after which a device without heartbeat is considered offline (default: 30 seconds) */
  offlineTimeoutMs?: number;

  /** How often to check for offline devices (default: 10 seconds) */
  autoOfflineCheckIntervalMs?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * DeviceManager
 *
 * Independent, framework-agnostic device/connection manager.
 * Designed to work with ANY realtime framework (Dolphin, Socket.io, raw WebSocket, MQTT, etc.).
 *
 * Features:
 * - Register/unregister devices
 * - Heartbeat tracking + automatic offline detection
 * - Per-device metadata
 * - Subscription tracking per device
 * - Rich events
 *
 * Dolphin ko style: clean, typed, lightweight, EventEmitter based.
 */
export class DeviceManager extends EventEmitter {
  private devices = new Map<string, Device>();
  private offlineTimers = new Map<string, NodeJS.Timeout>();

  private readonly offlineTimeout: number;
  private readonly checkInterval: number;
  private readonly debug: boolean;

  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: DeviceManagerOptions = {}) {
    super();

    this.offlineTimeout = options.offlineTimeoutMs ?? 30_000;
    this.checkInterval = options.autoOfflineCheckIntervalMs ?? 10_000;
    this.debug = options.debug ?? false;

    this.startAutoOfflineChecker();
  }

  /**
   * Register a new device or update existing one.
   */
  register(id: string, metadata: Record<string, any> = {}): Device {
    const now = Date.now();

    const existing = this.devices.get(id);

    const device: Device = {
      id,
      metadata: { ...existing?.metadata, ...metadata },
      lastSeen: now,
      isOnline: true,
      subscriptions: existing?.subscriptions ?? new Set(),
    };

    this.devices.set(id, device);
    this.resetOfflineTimer(id);

    if (!existing) {
      this.emit('device:registered', device);
      if (this.debug) console.log(`[DeviceManager] Registered: ${id}`);
    } else {
      this.emit('device:updated', device);
    }

    this.emit('device:online', device);
    return device;
  }

  /**
   * Unregister (remove) a device completely.
   */
  unregister(id: string): boolean {
    const device = this.devices.get(id);
    if (!device) return false;

    this.clearOfflineTimer(id);
    this.devices.delete(id);

    this.emit('device:unregistered', { id, metadata: device.metadata });
    this.emit('device:offline', { id, reason: 'unregistered' });

    if (this.debug) console.log(`[DeviceManager] Unregistered: ${id}`);
    return true;
  }

  /**
   * Send heartbeat for a device (keeps it online).
   */
  heartbeat(id: string): void {
    const device = this.devices.get(id);
    if (!device) return;

    device.lastSeen = Date.now();
    device.isOnline = true;

    this.resetOfflineTimer(id);
    this.emit('device:heartbeat', device);
  }

  /**
   * Update metadata of a device.
   */
  updateMetadata(id: string, metadata: Record<string, any>): Device | null {
    const device = this.devices.get(id);
    if (!device) return null;

    device.metadata = { ...device.metadata, ...metadata };
    this.emit('device:updated', device);
    return device;
  }

  /**
   * Get a single device.
   */
  get(id: string): Device | undefined {
    return this.devices.get(id);
  }

  /**
   * Get all devices.
   */
  list(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get only online devices.
   */
  getOnline(): Device[] {
    return this.list().filter(d => d.isOnline);
  }

  /**
   * Check if a device is currently online.
   */
  isOnline(id: string): boolean {
    return this.devices.get(id)?.isOnline ?? false;
  }

  /**
   * Subscribe a device to a topic/channel.
   */
  subscribe(id: string, topic: string): void {
    const device = this.devices.get(id);
    if (!device) return;

    device.subscriptions.add(topic);
    this.emit('device:subscribed', { id, topic });
  }

  /**
   * Unsubscribe a device from a topic.
   */
  unsubscribe(id: string, topic: string): void {
    const device = this.devices.get(id);
    if (!device) return;

    device.subscriptions.delete(topic);
    this.emit('device:unsubscribed', { id, topic });
  }

  /**
   * Get all subscriptions of a device.
   */
  getSubscriptions(id: string): string[] {
    return Array.from(this.devices.get(id)?.subscriptions ?? []);
  }

  /**
   * Mark a device as offline manually.
   */
  markOffline(id: string, reason = 'manual'): void {
    const device = this.devices.get(id);
    if (!device || !device.isOnline) return;

    device.isOnline = false;
    this.clearOfflineTimer(id);

    this.emit('device:offline', { id, reason });
    if (this.debug) console.log(`[DeviceManager] Offline: ${id} (${reason})`);
  }

  /**
   * Destroy the manager (cleanup timers).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    for (const timer of this.offlineTimers.values()) {
      clearTimeout(timer);
    }
    this.offlineTimers.clear();
    this.devices.clear();
    this.removeAllListeners();
  }

  // ─────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────

  private resetOfflineTimer(id: string): void {
    this.clearOfflineTimer(id);

    const timer = setTimeout(() => {
      const device = this.devices.get(id);
      if (device && device.isOnline) {
        device.isOnline = false;
        this.emit('device:offline', { id, reason: 'timeout' });
        if (this.debug) console.log(`[DeviceManager] Auto-offline (timeout): ${id}`);
      }
      this.offlineTimers.delete(id);
    }, this.offlineTimeout);

    this.offlineTimers.set(id, timer);
  }

  private clearOfflineTimer(id: string): void {
    const timer = this.offlineTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.offlineTimers.delete(id);
    }
  }

  private startAutoOfflineChecker(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, device] of this.devices) {
        if (device.isOnline && now - device.lastSeen > this.offlineTimeout) {
          device.isOnline = false;
          this.emit('device:offline', { id, reason: 'timeout' });
          if (this.debug) console.log(`[DeviceManager] Auto-offline (checker): ${id}`);
        }
      }
    }, this.checkInterval);
  }
}
