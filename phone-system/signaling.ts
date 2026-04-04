// phone-system/signaling.ts
import { RealtimeCore } from '../realtime/core';
import { DeviceRegistry } from './registry';

export enum SignalingType {
    CALL_INVITE = 'CALL_INVITE',
    CALL_RING = 'CALL_RING',
    CALL_ANSWER = 'CALL_ANSWER',
    CALL_REJECT = 'CALL_REJECT',
    CALL_HOLD = 'CALL_HOLD',
    CALL_RESUME = 'CALL_RESUME',
    CALL_TRANSFER = 'CALL_TRANSFER',
    CALL_HANGUP = 'CALL_HANGUP',
    WEBRTC_OFFER = 'WEBRTC_OFFER',
    WEBRTC_ANSWER = 'WEBRTC_ANSWER',
    ICE_CANDIDATE = 'ICE_CANDIDATE',
    EMERGENCY_OVERRIDE = 'EMERGENCY_OVERRIDE',
    SIGNAL_ACK = 'SIGNAL_ACK'
}

export interface SignalingPayload {
    from: string;
    to: string;
    type: SignalingType;
    data?: any;
    msgId: string;
    timestamp: number;
}

import { NotificationManager } from './notification';
import { CallManager, CallStatus } from './call-manager';

export class PhoneSignaling {
    private rt: RealtimeCore;
    private registry: DeviceRegistry;
    private notifications?: NotificationManager;
    private callManager: CallManager;
    private db?: any;
    private pendingSignals = new Map<string, { payload: any, attempts: number, resolve: (v: boolean) => void }>();

    constructor(rt: RealtimeCore, registry: DeviceRegistry, notifications?: NotificationManager, db?: any, callManager?: CallManager) {
        this.rt = rt;
        this.registry = registry;
        this.notifications = notifications;
        this.db = db;
        this.callManager = callManager || new CallManager();

        // Global listener for ACKs (can be improved with a specific handler)
        this.rt.subscribe('phone/signaling/all', (data) => this.handleIncomingSignal(data.payload));
    }

    private handleIncomingSignal(payload: SignalingPayload) {
        if (payload.type === SignalingType.SIGNAL_ACK) {
            const pending = this.pendingSignals.get(payload.msgId);
            if (pending) {
                pending.resolve(true);
                this.pendingSignals.delete(payload.msgId);
            }
        }
    }

    async sendSignal(payload: Omit<SignalingPayload, 'timestamp' | 'msgId'>): Promise<boolean> {
        const msgId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullPayload: SignalingPayload = {
            ...payload,
            msgId,
            timestamp: Date.now()
        };

        const targetDevice = await this.registry.getDevice(payload.to);
        if (!targetDevice) {
            console.error(`Signaling Error: Device ${payload.to} not found`);
            return false;
        }

        // Retry loop implementation
        let success = false;
        for (let i = 0; i < 3; i++) { // Max 3 attempts
            this.rt.publish(`phone/signaling/${payload.to}`, fullPayload);
            
            // Wait for ACK
            try {
                success = await Promise.race([
                    new Promise<boolean>((resolve) => {
                        this.pendingSignals.set(msgId, { payload: fullPayload, attempts: i + 1, resolve });
                    }),
                    new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
                if (success) break;
            } catch (err) {
                console.warn(`[Signaling] Retry ${i + 1} for ${msgId} to ${payload.to}`);
            }
        }

        this.pendingSignals.delete(msgId);
        return success;
    }

    async sendAck(to: string, msgId: string): Promise<void> {
        const payload: SignalingPayload = {
            from: 'SYSTEM',
            to,
            type: SignalingType.SIGNAL_ACK,
            msgId,
            timestamp: Date.now()
        };
        this.rt.publish(`phone/signaling/${to}`, payload);
    }

    private getIceServers() {
        return [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Add custom TURN server here if configured
        ];
    }

    async broadcastSignal(type: SignalingType, data?: any, from: string = 'SYSTEM'): Promise<boolean> {
        const payload: SignalingPayload = {
            from,
            to: 'ALL',
            type,
            data,
            msgId: `brd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };

        this.rt.publish('phone/signaling/all', payload);
        return true;
    }

    async invite(from: string, toNumber: string, data?: any): Promise<boolean> {
        const fromDevice = await this.registry.getDevice(from);
        const target = await this.registry.getDeviceByNumber(toNumber);
        
        if (!target) {
            console.error(`Call Error: Target number ${toNumber} not found`);
            return false;
        }

        // 1. Central State Check (Race condition prevention)
        const session = await this.callManager.createSession(from, target.id, data);
        if (!session) {
            console.error(`Call Error: One or more devices are busy (From: ${from}, To: ${target.id})`);
            return false;
        }

        // 2. Log the call attempt in DB
        if (this.db && this.db.CallLog) {
            await this.db.CallLog.create({
                callId: session.callId,
                from,
                fromNumber: fromDevice?.number,
                to: target.id,
                toNumber: target.number,
                startTime: session.startedAt,
                status: 'completed', 
                type: data?.type || 'audio'
            });
        }

        // 3. Send Invite Signal with callId and ICE Servers
        await this.sendSignal({
            from,
            to: target.id,
            type: SignalingType.CALL_INVITE,
            data: { 
                ...data, 
                callId: session.callId,
                iceServers: this.getIceServers()
            }
        });

        // Auto-set status
        await this.registry.setStatus(from, 'calling');
        await this.registry.setStatus(target.id, 'busy');
        
        return true;
    }

    async ring(from: string, to: string): Promise<boolean> {
        const session = await this.callManager.getDeviceSession(to);
        if (session) await this.callManager.updateStatus(session.callId, CallStatus.RINGING);

        return await this.sendSignal({
            from,
            to,
            type: SignalingType.CALL_RING
        });
    }

    async answer(from: string, to: string): Promise<boolean> {
        const session = await this.callManager.getDeviceSession(from);
        if (session) {
            await this.callManager.updateStatus(session.callId, CallStatus.ACTIVE);
            await this.registry.setStatus(from, 'busy');
            await this.registry.setStatus(to, 'busy');
        }

        return await this.sendSignal({
            from,
            to,
            type: SignalingType.CALL_ANSWER,
            data: { iceServers: this.getIceServers() }
        });
    }

    async reject(from: string, to: string, isMissed: boolean = true): Promise<boolean> {
        const fromDevice = await this.registry.getDevice(from);
        
        // 1. Update Central State
        await this.callManager.endDeviceCall(from);
        await this.registry.setStatus(from, 'online');
        await this.registry.setStatus(to, 'online');

        // 2. Send Reject Signal
        await this.sendSignal({
            from,
            to,
            type: isMissed ? SignalingType.CALL_REJECT : SignalingType.CALL_HANGUP
        });

        // 3. Send Notification if missed
        if (isMissed && this.notifications) {
            await this.notifications.sendMissedCallAlert(from, to, fromDevice?.number || 'Unknown');
        }

        return true;
    }

    async hangup(from: string, to: string): Promise<boolean> {
        await this.callManager.endDeviceCall(from);
        await this.registry.setStatus(from, 'online');
        await this.registry.setStatus(to, 'online');

        return await this.sendSignal({
            from,
            to,
            type: SignalingType.CALL_HANGUP
        });
    }

    async transfer(from: string, originalTo: string, newToNumber: string): Promise<boolean> {
        const target = await this.registry.getDeviceByNumber(newToNumber);
        if (!target) return false;

        return await this.sendSignal({
            from,
            to: originalTo,
            type: SignalingType.CALL_TRANSFER,
            data: { transferTo: target.id, transferToNumber: newToNumber }
        });
    }

    async sendWebRTCData(from: string, to: string, type: SignalingType, rtcData: any): Promise<boolean> {
        return this.sendSignal({
            from,
            to,
            type,
            data: rtcData
        });
    }
}
