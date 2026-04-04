// phone-system/chat.ts
import { RealtimeCore } from '../realtime/core';
import { DeviceRegistry } from './registry';

export interface ChatMessage {
    from: string;
    to: string;
    text: string;
    timestamp: number;
}

export class PhoneChat {
    private rt: RealtimeCore;
    private registry: DeviceRegistry;

    constructor(rt: RealtimeCore, registry: DeviceRegistry) {
        this.rt = rt;
        this.registry = registry;
    }

    async sendMessage(from: string, to: string, text: string): Promise<boolean> {
        const message: ChatMessage = {
            from,
            to,
            text,
            timestamp: Date.now()
        };

        const targetDevice = this.registry.getDevice(to);
        if (!targetDevice) return false;

        // Publish to device-specific chat topic
        this.rt.publish(`phone/chat/${to}`, message);
        return true;
    }

    async broadcast(message: string): Promise<boolean> {
        this.rt.publish('phone/broadcast', { message, timestamp: Date.now() });
        return true;
    }
}
