import { EventEmitter } from 'events';
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
    devices = new Map();
    offlineTimers = new Map();
    offlineTimeout;
    checkInterval;
    debug;
    cleanupInterval;
    constructor(options = {}) {
        super();
        this.offlineTimeout = options.offlineTimeoutMs ?? 30_000;
        this.checkInterval = options.autoOfflineCheckIntervalMs ?? 10_000;
        this.debug = options.debug ?? false;
        this.startAutoOfflineChecker();
    }
    /**
     * Register a new device or update existing one.
     */
    register(id, metadata = {}) {
        const now = Date.now();
        const existing = this.devices.get(id);
        const device = {
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
            if (this.debug)
                console.log(`[DeviceManager] Registered: ${id}`);
        }
        else {
            this.emit('device:updated', device);
        }
        this.emit('device:online', device);
        return device;
    }
    /**
     * Unregister (remove) a device completely.
     */
    unregister(id) {
        const device = this.devices.get(id);
        if (!device)
            return false;
        this.clearOfflineTimer(id);
        this.devices.delete(id);
        this.emit('device:unregistered', { id, metadata: device.metadata });
        this.emit('device:offline', { id, reason: 'unregistered' });
        if (this.debug)
            console.log(`[DeviceManager] Unregistered: ${id}`);
        return true;
    }
    /**
     * Send heartbeat for a device (keeps it online).
     */
    heartbeat(id) {
        const device = this.devices.get(id);
        if (!device)
            return;
        device.lastSeen = Date.now();
        device.isOnline = true;
        this.resetOfflineTimer(id);
        this.emit('device:heartbeat', device);
    }
    /**
     * Update metadata of a device.
     */
    updateMetadata(id, metadata) {
        const device = this.devices.get(id);
        if (!device)
            return null;
        device.metadata = { ...device.metadata, ...metadata };
        this.emit('device:updated', device);
        return device;
    }
    /**
     * Get a single device.
     */
    get(id) {
        return this.devices.get(id);
    }
    /**
     * Get all devices.
     */
    list() {
        return Array.from(this.devices.values());
    }
    /**
     * Get only online devices.
     */
    getOnline() {
        return this.list().filter(d => d.isOnline);
    }
    /**
     * Check if a device is currently online.
     */
    isOnline(id) {
        return this.devices.get(id)?.isOnline ?? false;
    }
    /**
     * Subscribe a device to a topic/channel.
     */
    subscribe(id, topic) {
        const device = this.devices.get(id);
        if (!device)
            return;
        device.subscriptions.add(topic);
        this.emit('device:subscribed', { id, topic });
    }
    /**
     * Unsubscribe a device from a topic.
     */
    unsubscribe(id, topic) {
        const device = this.devices.get(id);
        if (!device)
            return;
        device.subscriptions.delete(topic);
        this.emit('device:unsubscribed', { id, topic });
    }
    /**
     * Get all subscriptions of a device.
     */
    getSubscriptions(id) {
        return Array.from(this.devices.get(id)?.subscriptions ?? []);
    }
    /**
     * Mark a device as offline manually.
     */
    markOffline(id, reason = 'manual') {
        const device = this.devices.get(id);
        if (!device || !device.isOnline)
            return;
        device.isOnline = false;
        this.clearOfflineTimer(id);
        this.emit('device:offline', { id, reason });
        if (this.debug)
            console.log(`[DeviceManager] Offline: ${id} (${reason})`);
    }
    /**
     * Destroy the manager (cleanup timers).
     */
    destroy() {
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
    resetOfflineTimer(id) {
        this.clearOfflineTimer(id);
        const timer = setTimeout(() => {
            const device = this.devices.get(id);
            if (device && device.isOnline) {
                device.isOnline = false;
                this.emit('device:offline', { id, reason: 'timeout' });
                if (this.debug)
                    console.log(`[DeviceManager] Auto-offline (timeout): ${id}`);
            }
            this.offlineTimers.delete(id);
        }, this.offlineTimeout);
        this.offlineTimers.set(id, timer);
    }
    clearOfflineTimer(id) {
        const timer = this.offlineTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.offlineTimers.delete(id);
        }
    }
    startAutoOfflineChecker() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, device] of this.devices) {
                if (device.isOnline && now - device.lastSeen > this.offlineTimeout) {
                    device.isOnline = false;
                    this.emit('device:offline', { id, reason: 'timeout' });
                    if (this.debug)
                        console.log(`[DeviceManager] Auto-offline (checker): ${id}`);
                }
            }
        }, this.checkInterval);
    }
}
//# sourceMappingURL=devicemanager.js.map