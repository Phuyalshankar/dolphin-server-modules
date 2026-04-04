// phone-system/call-manager.ts

export enum CallStatus {
    IDLE = 'IDLE',
    RINGING = 'RINGING',
    ACTIVE = 'ACTIVE',
    HOLD = 'HOLD',
    ENDED = 'ENDED'
}

export interface CallSession {
    callId: string;
    from: string;
    to: string;
    status: CallStatus;
    startedAt: number;
    endedAt?: number;
    metadata?: any;
}

export class CallManager {
    private sessions = new Map<string, CallSession>();
    private deviceCallMap = new Map<string, string>(); // deviceId -> callId
    private redis: any;
    private prefix = 'dolphin:phone:call:';
    private mapPrefix = 'dolphin:phone:device_call:';

    constructor(redis?: any) {
        this.redis = redis;
    }

    async createSession(from: string, to: string, metadata?: any): Promise<CallSession | null> {
        // Prevent race condition: Check if either device is already in a call
        if (await this.isDeviceBusy(from) || await this.isDeviceBusy(to)) {
            return null;
        }

        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session: CallSession = {
            callId,
            from,
            to,
            status: CallStatus.RINGING,
            startedAt: Date.now(),
            metadata
        };

        if (this.redis) {
            await this.redis.set(`${this.prefix}${callId}`, JSON.stringify(session), 'EX', 3600);
            await this.redis.set(`${this.mapPrefix}${from}`, callId, 'EX', 3600);
            await this.redis.set(`${this.mapPrefix}${to}`, callId, 'EX', 3600);
        } else {
            this.sessions.set(callId, session);
            this.deviceCallMap.set(from, callId);
            this.deviceCallMap.set(to, callId);
        }

        return session;
    }

    async getSession(callId: string): Promise<CallSession | undefined> {
        if (this.redis) {
            const raw = await this.redis.get(`${this.prefix}${callId}`);
            return raw ? JSON.parse(raw) : undefined;
        }
        return this.sessions.get(callId);
    }

    async getDeviceSession(deviceId: string): Promise<CallSession | undefined> {
        const callId = this.redis 
            ? await this.redis.get(`${this.mapPrefix}${deviceId}`)
            : this.deviceCallMap.get(deviceId);
            
        return callId ? await this.getSession(callId) : undefined;
    }

    async updateStatus(callId: string, status: CallStatus): Promise<boolean> {
        const session = await this.getSession(callId);
        if (!session) return false;

        // Basic state machine validation
        if (session.status === CallStatus.ENDED) return false;

        session.status = status;
        if (status === CallStatus.ENDED) {
            session.endedAt = Date.now();
            if (this.redis) {
                await this.redis.del(`${this.mapPrefix}${session.from}`);
                await this.redis.del(`${this.mapPrefix}${session.to}`);
                await this.redis.set(`${this.prefix}${callId}`, JSON.stringify(session), 'EX', 300); // Keep ended session for 5 mins
            } else {
                this.deviceCallMap.delete(session.from);
                this.deviceCallMap.delete(session.to);
            }
        } else if (this.redis) {
            await this.redis.set(`${this.prefix}${callId}`, JSON.stringify(session), 'EX', 3600);
        }

        return true;
    }

    async isDeviceBusy(deviceId: string): Promise<boolean> {
        const callId = this.redis
            ? await this.redis.get(`${this.mapPrefix}${deviceId}`)
            : this.deviceCallMap.get(deviceId);
            
        if (!callId) return false;
        
        const session = await this.getSession(callId);
        return session ? session.status !== CallStatus.ENDED : false;
    }

    async endDeviceCall(deviceId: string): Promise<boolean> {
        const callId = this.redis
            ? await this.redis.get(`${this.mapPrefix}${deviceId}`)
            : this.deviceCallMap.get(deviceId);
            
        if (!callId) return false;
        return await this.updateStatus(callId, CallStatus.ENDED);
    }
}
