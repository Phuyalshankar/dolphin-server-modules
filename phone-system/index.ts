// Re-export Phone System components
export * from './call-manager';
export * from './chat';
export * from './controller';
export * from './notification';
export * from './registry';
export * from './schema';
export * from './signaling';
export * from './speed-dial';
export * from './auth-utils';

import { RealtimeCore } from '../realtime/core';
import { DeviceRegistry } from './registry';
import { PhoneSignaling } from './signaling';
import { PhoneChat } from './chat';
import { SpeedDialManager } from './speed-dial';
import { NotificationManager } from './notification';
import { PhoneController } from './controller';
import { createPhoneSchemas } from './schema';
import { CallManager } from './call-manager';

export function createPhoneSystem(options: { rt?: RealtimeCore, db?: any, redis?: any } = {}) {
    const rt = options.rt || new RealtimeCore();
    const registry = new DeviceRegistry({ db: options.db, redis: options.redis });
    const callManager = new CallManager(options.redis);
    const notifications = new NotificationManager(rt, registry);
    const signaling = new PhoneSignaling(rt, registry, notifications, options.db, callManager);
    const chat = new PhoneChat(rt, registry);
    const speedDial = new SpeedDialManager(registry, options.db);
    const controller = new PhoneController(registry, signaling, chat, speedDial);

    // If DB is provided, ensure schemas are registered
    if (options.db) {
        createPhoneSchemas(options.db.connection);
    }

    return {
        rt,
        registry,
        signaling,
        chat,
        speedDial,
        controller,
        notifications,
        callManager,
        registerRoutes: controller.registerRoutes.bind(controller)
    };
}