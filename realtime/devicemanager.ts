// dolphin-server-modules/device-manager/index.ts
// ============================================
// DEVICE MANAGER - Corrected for Dolphin APIs
// ============================================

import { createMongooseAdapter } from '../adapters/mongoose';
import { createCrudController } from '../curd/crud';
import { RealtimeCore } from '../realtime';
import { EventEmitter } from 'events';

export type DeviceType = 'intercom' | 'phone' | 'medical' | 'sensor' | 'gateway' | 'camera';
export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'error' | 'sleeping';

export interface Device {
  deviceId: string;
  deviceType: DeviceType;
  name: string;
  ipAddress: string;
  port?: number;
  macAddress?: string;
  status: DeviceStatus;
  lastSeen: Date;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  metadata?: Record<string, any>;
  firmware?: string;
  battery?: number;
  controls?: {
    power: boolean;
    volume?: number;
    brightness?: number;
    lock?: boolean;
    door?: 'open' | 'closed' | 'locked';
  };
  group?: string;
  ownerId?: string;
  alerts?: Array<{
    type: 'warning' | 'critical' | 'info';
    code: string;
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
}

// ============================================
// DEVICE MANAGER
// ============================================

export class DeviceManager extends EventEmitter {
  private adapter: any;
  private crud: any;
  private rt?: RealtimeCore;
  private deviceStatus = new Map<string, DeviceStatus>();
  private pendingCommands = new Map<string, { resolve: Function; reject: Function }>();
  private heartbeatInterval?: NodeJS.Timeout;
  
  constructor(deviceModel: any, options?: {
    rt?: RealtimeCore;
    heartbeatInterval?: number;
  }) {
    super();
    
    // Fix 1: createMongooseAdapter expects (model, collectionName)
    // Or check your actual adapter API
    this.adapter = createMongooseAdapter({ Device: deviceModel });
    
    // Fix 2: createCrudController expects (adapter, collection)
    // Collection name should match your model
    this.crud = createCrudController(this.adapter, 'Device');
    
    if (options?.rt) {
      this.rt = options.rt;
      this.setupRealtimeListeners();
    }
    
    if (options?.heartbeatInterval) {
      this.startHeartbeatChecker(options.heartbeatInterval);
    }
  }
  
  // ============================================
  // DOLPHIN CRUD PASSTHROUGH
  // ============================================
  
  getCRUD() {
    return this.crud;
  }
  
  // ============================================
  // DEVICE LIFECYCLE
  // ============================================
  
  async registerDevice(deviceData: Partial<Device>): Promise<Device> {
    const existing = await this.adapter.findOne({ deviceId: deviceData.deviceId });
    
    if (existing) {
      const updated = await this.adapter.update(existing._id, {
        ...deviceData,
        status: 'online',
        lastSeen: new Date()
      });
      this.emit('device:updated', updated);
      return updated;
    }
    
    const newDevice = await this.adapter.create({
      ...deviceData,
      status: 'online',
      lastSeen: new Date(),
      controls: deviceData.controls || { power: false },
      alerts: []
    });
    
    this.emit('device:registered', newDevice);
    
    if (this.rt) {
      this.rt.publish(`device/${newDevice.deviceId}/registered`, newDevice);
    }
    
    return newDevice;
  }
  
  async updateStatus(deviceId: string, status: DeviceStatus, metadata?: any): Promise<Device | null> {
    const device = await this.adapter.findOne({ deviceId });
    if (!device) return null;
    
    const updated = await this.adapter.update(device._id, {
      status,
      lastSeen: new Date(),
      metadata: { ...device.metadata, ...metadata }
    });
    
    this.deviceStatus.set(deviceId, status);
    this.emit('status:change', { deviceId, status, group: device.group });
    
    if (this.rt) {
      this.rt.publish(`device/${deviceId}/status`, { status, timestamp: Date.now() });
      if (device.group) {
        this.rt.publish(`group/${device.group}/status`, { deviceId, status });
      }
    }
    
    return updated;
  }
  
  // ============================================
  // COMMAND SYSTEM
  // ============================================
  
  async sendCommand(deviceId: string, command: string, value?: any, timeout: number = 30000): Promise<any> {
    if (!this.rt) {
      throw new Error('RealtimeCore not configured');
    }
    
    const device = await this.adapter.findOne({ deviceId });
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    // Fix 3: Check if function exists before calling
    const isOnline = typeof this.rt.isOnline === 'function' ? this.rt.isOnline(deviceId) : false;
    
    if (!isOnline) {
      throw new Error(`Device ${deviceId} is offline`);
    }
    
    const requestId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout);
      
      this.pendingCommands.set(requestId, {
        resolve: (result: any) => {
          clearTimeout(timer);
          this.pendingCommands.delete(requestId);
          resolve(result);
        },
        reject: (err: any) => {
          clearTimeout(timer);
          this.pendingCommands.delete(requestId);
          reject(err);
        }
      });
      
      const sendResult = this.rt!.sendTo(deviceId, {
        type: 'COMMAND',
        command,
        value,
        requestId,
        timestamp: Date.now()
      });
      
      if (!sendResult) {
        clearTimeout(timer);
        this.pendingCommands.delete(requestId);
        reject(new Error('Failed to send command'));
      }
    });
  }
  
  async broadcastToGroup(group: string, command: string, value?: any): Promise<Map<string, any>> {
    const devices = await this.adapter.find({ group, status: 'online' });
    const results = new Map();
    
    const promises = devices.map(async (device: any) => {
      try {
        const result = await this.sendCommand(device.deviceId, command, value, 5000);
        results.set(device.deviceId, { success: true, result });
      } catch (err) {
        results.set(device.deviceId, { success: false, error: String(err) });
      }
    });
    
    await Promise.allSettled(promises);
    return results;
  }
  
  // ============================================
  // ALERT SYSTEM
  // ============================================
  
  async addAlert(deviceId: string, alert: { type: 'warning' | 'critical' | 'info'; code: string; message: string }): Promise<Device | null> {
    const device = await this.adapter.findOne({ deviceId });
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    const newAlert = {
      ...alert,
      timestamp: new Date(),
      resolved: false
    };
    
    const alerts = device.alerts || [];
    const updated = await this.adapter.update(device._id, {
      alerts: [...alerts, newAlert]
    });
    
    this.emit('alert:added', { deviceId, alert: newAlert });
    
    if (alert.type === 'critical' && this.rt) {
      this.rt.publish('alerts/critical', {
        deviceId,
        deviceName: device.name,
        alert: newAlert,
        timestamp: Date.now()
      });
    }
    
    return updated;
  }
  
  // ============================================
  // QUERY METHODS
  // ============================================
  
  async getDevice(deviceId: string): Promise<Device | null> {
    return this.adapter.findOne({ deviceId });
  }
  
  async getAllDevices(filter?: any): Promise<Device[]> {
    return this.adapter.find(filter || {});
  }
  
  async getOnlineDevices(group?: string): Promise<Device[]> {
    const filter: any = { status: 'online' };
    if (group) filter.group = group;
    return this.adapter.find(filter);
  }
  
  async getDevicesByType(deviceType: DeviceType): Promise<Device[]> {
    return this.adapter.find({ deviceType });
  }
  
  async getDevicesByGroup(group: string): Promise<Device[]> {
    return this.adapter.find({ group });
  }
  
  async getStats(): Promise<any> {
    const total = await this.adapter.count();
    const online = await this.adapter.count({ status: 'online' });
    const byType = {
      intercom: await this.adapter.count({ deviceType: 'intercom' }),
      phone: await this.adapter.count({ deviceType: 'phone' }),
      medical: await this.adapter.count({ deviceType: 'medical' }),
      sensor: await this.adapter.count({ deviceType: 'sensor' }),
      gateway: await this.adapter.count({ deviceType: 'gateway' }),
      camera: await this.adapter.count({ deviceType: 'camera' })
    };
    
    return { total, online, offline: total - online, byType };
  }
  
  async deleteDevice(deviceId: string): Promise<boolean> {
    const device = await this.adapter.findOne({ deviceId });
    if (!device) return false;
    
    await this.adapter.delete(device._id);
    this.emit('device:deleted', { deviceId });
    
    if (this.rt) {
      this.rt.publish(`device/${deviceId}/deleted`, { timestamp: Date.now() });
    }
    
    return true;
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  private setupRealtimeListeners() {
    if (!this.rt) return;
    
    // Fix 4: Subscribe handlers should accept single argument
    this.rt.subscribe('device/command/response', (data: any) => {
      const { requestId, success, response, error } = data;
      const pending = this.pendingCommands.get(requestId);
      
      if (pending) {
        if (success) {
          pending.resolve(response);
        } else {
          pending.reject(new Error(error));
        }
      }
    });
    
    this.rt.subscribe('device/heartbeat', async (data: any) => {
      await this.updateStatus(data.deviceId, 'online', data.metadata);
      this.emit('heartbeat', { deviceId: data.deviceId, timestamp: Date.now() });
    });
    
    this.rt.subscribe('device/telemetry', (data: any) => {
      this.emit('telemetry', { deviceId: data.deviceId, data: data.payload, timestamp: Date.now() });
    });
    
    this.rt.subscribe('device/alert', async (data: any) => {
      await this.addAlert(data.deviceId, data.alert);
    });
    
    // Handle device disconnection if RealtimeCore supports it
    if (typeof this.rt.on === 'function') {
      this.rt.on('device:disconnect', (deviceId: string) => {
        this.updateStatus(deviceId, 'offline').catch(console.error);
      });
    }
  }
  
  private startHeartbeatChecker(intervalMs: number) {
    this.heartbeatInterval = setInterval(async () => {
      const timeout = Date.now() - (intervalMs * 2);
      const devices = await this.adapter.find({ status: 'online' });
      
      for (const device of devices) {
        if (device.lastSeen && new Date(device.lastSeen).getTime() < timeout) {
          await this.updateStatus(device.deviceId, 'offline');
          this.emit('device:timeout', { deviceId: device.deviceId, lastSeen: device.lastSeen });
        }
      }
    }, intervalMs);
  }
  
  async destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.removeAllListeners();
    this.emit('destroyed');
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createDeviceManager(deviceModel: any, options?: {
  rt?: RealtimeCore;
  heartbeatInterval?: number;
}) {
  return new DeviceManager(deviceModel, options);
}