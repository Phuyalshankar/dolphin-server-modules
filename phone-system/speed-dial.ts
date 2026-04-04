// phone-system/speed-dial.ts
import { DeviceRegistry } from './registry';

export interface SpeedDialEntry {
    deviceId: string;
    key: string;
    label: string;
    target: string;
    type: 'internal' | 'whatsapp' | 'facebook' | 'external';
}

export class SpeedDialManager {
    private db: any;
    private registry: DeviceRegistry;
    private cache: Map<string, SpeedDialEntry[]> = new Map();

    constructor(registry: DeviceRegistry, db?: any) {
        this.registry = registry;
        this.db = db;
    }

    async addEntry(entry: SpeedDialEntry): Promise<boolean> {
        // Update DB
        if (this.db && this.db.SpeedDial) {
            await this.db.SpeedDial.findOneAndUpdate(
                { deviceId: entry.deviceId, key: entry.key },
                { $set: entry },
                { upsert: true, new: true }
            );
        }

        // Update Cache
        const entries = this.cache.get(entry.deviceId) || [];
        const index = entries.findIndex(e => e.key === entry.key);
        if (index > -1) entries[index] = entry;
        else entries.push(entry);
        this.cache.set(entry.deviceId, entries);

        return true;
    }

    async getEntries(deviceId: string): Promise<SpeedDialEntry[]> {
        // Check cache first
        if (this.cache.has(deviceId)) return this.cache.get(deviceId)!;

        // Fetch from DB
        if (this.db && this.db.SpeedDial) {
            const dbEntries = await this.db.SpeedDial.find({ 
                $or: [{ deviceId }, { deviceId: 'GLOBAL' }] 
            });
            this.cache.set(deviceId, dbEntries);
            return dbEntries;
        }

        return this.cache.get(deviceId) || [];
    }

    async removeEntry(deviceId: string, key: string): Promise<boolean> {
        if (this.db && this.db.SpeedDial) {
            await this.db.SpeedDial.deleteOne({ deviceId, key });
        }

        const entries = this.cache.get(deviceId) || [];
        this.cache.set(deviceId, entries.filter(e => e.key !== key));
        return true;
    }

    async resolve(deviceId: string, key: string): Promise<SpeedDialEntry | undefined> {
        const entries = await this.getEntries(deviceId);
        return entries.find(e => e.key === key);
    }
}
