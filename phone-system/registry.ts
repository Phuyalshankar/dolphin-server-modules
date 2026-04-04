// phone-system/registry.ts

export interface Device {
  id: string;
  name: string;
  number: string;
  status: 'online' | 'offline' | 'busy' | 'dnd' | 'calling';
  role: 'admin' | 'nurse' | 'ward' | 'other';
  ip?: string;
  lastSeen?: number;
  metadata?: Record<string, any>;
}

export class DeviceRegistry {
  private devices: Map<string, Device> = new Map();
  private db: any;
  private redis: any;
  private prefix = 'dolphin:phone:device:';

  constructor(options: { db?: any, redis?: any } = {}) {
    this.db = options.db;
    this.redis = options.redis;
    
    if (!this.redis) {
        this.startCleanup();
    }
  }

  private startCleanup() {
    setInterval(async () => {
        const now = Date.now();
        for (const [id, device] of this.devices) {
            if (device.status !== 'offline' && device.lastSeen && now - device.lastSeen > 60000) {
                console.log(`[Registry] Device ${id} timed out. Marking offline.`);
                await this.setStatus(id, 'offline');
            }
        }
    }, 10000); // Check every 10 seconds
  }

  async register(deviceData: Omit<Device, 'status' | 'lastSeen'>): Promise<Device> {
    const device: Device = {
      ...deviceData,
      status: 'online',
      lastSeen: Date.now()
    };
    
    if (this.redis) {
        await this.redis.hset(`${this.prefix}${device.id}`, 'payload', JSON.stringify(device));
        await this.redis.expire(`${this.prefix}${device.id}`, 90); // 90s TTL
    } else {
        this.devices.set(device.id, device);
    }
    
    // Save to DB if available
    if (this.db && this.db.Device) {
        await this.db.Device.findOneAndUpdate(
            { id: device.id },
            { $set: device },
            { upsert: true, new: true }
        );
    }
    
    return device;
  }

  async setStatus(id: string, status: Device['status']): Promise<boolean> {
    const device = await this.getDevice(id);
    if (!device) return false;
    
    device.status = status;
    device.lastSeen = Date.now();
    
    if (this.redis) {
        await this.redis.hset(`${this.prefix}${id}`, 'payload', JSON.stringify(device));
        await this.redis.expire(`${this.prefix}${id}`, 90);
    } else {
        this.devices.set(id, device);
    }
    
    if (this.db && this.db.Device) {
        await this.db.Device.updateOne({ id }, { $set: { status, lastSeen: device.lastSeen } });
    }
    
    return true;
  }

  async getDevice(id: string): Promise<Device | undefined> {
    if (this.redis) {
       const raw = await this.redis.hget(`${this.prefix}${id}`, 'payload');
       return raw ? JSON.parse(raw) : undefined;
    }
    return this.devices.get(id);
  }

  async getDeviceByNumber(number: string): Promise<Device | undefined> {
    if (this.redis) {
        const keys = await this.redis.keys(`${this.prefix}*`);
        for (const key of keys) {
            const raw = await this.redis.hget(key, 'payload');
            if (raw) {
                const device = JSON.parse(raw);
                if (device.number === number) return device;
            }
        }
        return undefined;
    }
    return Array.from(this.devices.values()).find(d => d.number === number);
  }

  async getAllDevices(): Promise<Device[]> {
    if (this.redis) {
        const devices: Device[] = [];
        const keys = await this.redis.keys(`${this.prefix}*`);
        for (const key of keys) {
            const raw = await this.redis.hget(key, 'payload');
            if (raw) devices.push(JSON.parse(raw));
        }
        return devices;
    }
    return Array.from(this.devices.values());
  }

  async heartbeat(id: string): Promise<boolean> {
    const device = await this.getDevice(id);
    if (!device) return false;
    
    device.lastSeen = Date.now();
    device.status = 'online';

    if (this.redis) {
        await this.redis.hset(`${this.prefix}${id}`, 'payload', JSON.stringify(device));
        await this.redis.expire(`${this.prefix}${id}`, 90);
    } else {
        this.devices.set(id, device);
    }
    
    return true;
  }

  async updateMetadata(id: string, metadata: Record<string, any>): Promise<boolean> {
    const device = await this.getDevice(id);
    if (!device) return false;
    
    device.metadata = { ...device.metadata, ...metadata };
    
    if (this.redis) {
        await this.redis.hset(`${this.prefix}${id}`, 'payload', JSON.stringify(device));
    } else {
        this.devices.set(id, device);
    }
    
    if (this.db && this.db.Device) {
        await this.db.Device.updateOne({ id }, { $set: { metadata: device.metadata } });
    }
    
    return true;
  }

  async setPushToken(id: string, token: string): Promise<boolean> {
    return this.updateMetadata(id, { pushToken: token });
  }
}
