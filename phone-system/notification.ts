// phone-system/notification.ts
import { RealtimeCore } from '../realtime/core';
import { DeviceRegistry } from './registry';

export enum NotificationType {
    MISSED_CALL = 'MISSED_CALL',
    CHAT_ALERT = 'CHAT_ALERT',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    body: string;
    icon?: string;
    data?: any;
    timestamp: number;
}

export class NotificationManager {
    private rt: RealtimeCore;
    private registry: DeviceRegistry;

    constructor(rt: RealtimeCore, registry: DeviceRegistry) {
        this.rt = rt;
        this.registry = registry;
    }

    async sendNotification(toDeviceId: string, notification: Omit<NotificationPayload, 'timestamp'>): Promise<void> {
        const fullPayload: NotificationPayload = {
            ...notification,
            timestamp: Date.now()
        };

        const device = await this.registry.getDevice(toDeviceId);
        if (!device) return;

        // 1. Send via Realtime (In-app alert)
        this.rt.publish(`phone/notification/${toDeviceId}`, fullPayload);

        // 2. Trigger Push Notification Hook (FCM/OneSignal)
        if (device.metadata?.pushToken) {
            await this.triggerPushNotification(device.metadata.pushToken, fullPayload);
        }
    }

    private async triggerPushNotification(token: string, payload: NotificationPayload): Promise<void> {
        // Placeholder for real Push Notification integration (e.g., Firebase FCM / OneSignal REST API)
        // console.log(`[Push Notification] Sending to token ${token.substring(0, 10)}...: ${payload.title}`);
        
        // In a real implementation:
        // await fetch('https://fcm.googleapis.com/fcm/send', { ...headers, body: JSON.stringify({ to: token, data: payload }) });
    }

    async sendMissedCallAlert(fromDeviceId: string, toDeviceId: string, fromNumber: string): Promise<void> {
        await this.sendNotification(toDeviceId, {
            type: NotificationType.MISSED_CALL,
            title: 'Missed Call',
            body: `You have a missed call from ${fromNumber}`,
            data: { from: fromDeviceId, fromNumber }
        });
    }
}
