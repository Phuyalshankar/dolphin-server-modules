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
export declare class DeviceManager extends EventEmitter {
    private devices;
    private offlineTimers;
    private readonly offlineTimeout;
    private readonly checkInterval;
    private readonly debug;
    private cleanupInterval?;
    constructor(options?: DeviceManagerOptions);
    /**
     * Register a new device or update existing one.
     */
    register(id: string, metadata?: Record<string, any>): Device;
    /**
     * Unregister (remove) a device completely.
     */
    unregister(id: string): boolean;
    /**
     * Send heartbeat for a device (keeps it online).
     */
    heartbeat(id: string): void;
    /**
     * Update metadata of a device.
     */
    updateMetadata(id: string, metadata: Record<string, any>): Device | null;
    /**
     * Get a single device.
     */
    get(id: string): Device | undefined;
    /**
     * Get all devices.
     */
    list(): Device[];
    /**
     * Get only online devices.
     */
    getOnline(): Device[];
    /**
     * Check if a device is currently online.
     */
    isOnline(id: string): boolean;
    /**
     * Subscribe a device to a topic/channel.
     */
    subscribe(id: string, topic: string): void;
    /**
     * Unsubscribe a device from a topic.
     */
    unsubscribe(id: string, topic: string): void;
    /**
     * Get all subscriptions of a device.
     */
    getSubscriptions(id: string): string[];
    /**
     * Mark a device as offline manually.
     */
    markOffline(id: string, reason?: string): void;
    /**
     * Destroy the manager (cleanup timers).
     */
    destroy(): void;
    private resetOfflineTimer;
    private clearOfflineTimer;
    private startAutoOfflineChecker;
}
