import { DeviceRegistry } from './registry';
import { PhoneSignaling, SignalingType } from './signaling';
import { PhoneChat } from './chat';
import { SpeedDialManager } from './speed-dial';
import { AuthUtils } from './auth-utils';

export class PhoneController {
    constructor(
        private registry: DeviceRegistry, 
        private signaling: PhoneSignaling, 
        private chat: PhoneChat, 
        private speedDial: SpeedDialManager
    ) {
        // Explicit binding for safety with Dolphin router
        this.registerDevice = this.registerDevice.bind(this);
        this.heartbeat = this.heartbeat.bind(this);
        this.listDevices = this.listDevices.bind(this);
        this.getDevice = this.getDevice.bind(this);
        this.updateStatus = this.updateStatus.bind(this);
        this.updateMetadata = this.updateMetadata.bind(this);
        this.setPushToken = this.setPushToken.bind(this);
        this.auth = this.auth.bind(this);
        this.initiateCall = this.initiateCall.bind(this);
        this.rejectCall = this.rejectCall.bind(this);
        this.broadcastAnnouncement = this.broadcastAnnouncement.bind(this);
        this.getCallLogs = this.getCallLogs.bind(this);
        this.addSpeedDial = this.addSpeedDial.bind(this);
        this.listSpeedDials = this.listSpeedDials.bind(this);
        this.removeSpeedDial = this.removeSpeedDial.bind(this);
        this.login = this.login.bind(this);
        this.refresh = this.refresh.bind(this);
    }

    registerRoutes(app: any) {
        const prefix = '/phone';
        app.post(`${prefix}/register`, this.registerDevice);
        app.post(`${prefix}/login`, this.login);
        app.post(`${prefix}/refresh`, this.refresh);
        app.get(`${prefix}/devices`, this.listDevices);
        app.get(`${prefix}/:id`, this.getDevice);
        app.post(`${prefix}/:id/heartbeat`, this.heartbeat);
        app.post(`${prefix}/:id/status`, this.auth, this.updateStatus);
        app.post(`${prefix}/:id/metadata`, this.auth, this.updateMetadata);
        app.post(`${prefix}/:id/push-token`, this.auth, this.setPushToken);
        app.post(`${prefix}/call`, this.auth, this.initiateCall);
        app.post(`${prefix}/reject`, this.auth, this.rejectCall);
        app.post(`${prefix}/broadcast`, this.auth, this.broadcastAnnouncement);
        app.get(`${prefix}/logs`, this.auth, this.getCallLogs);
        app.get(`${prefix}/:id/speed-dial`, this.auth, this.listSpeedDials);
        app.post(`${prefix}/:id/speed-dial`, this.auth, this.addSpeedDial);
        app.delete(`${prefix}/:id/speed-dial/:key`, this.auth, this.removeSpeedDial);
    }

    registerDevice = async (ctx: any): Promise<any> => {
        const { id, name, number, role = 'other' } = ctx.body;
        if (!id || !name || !number) {
            return ctx.status(400).json({ error: 'Missing registration details' });
        }

        const device = await this.registry.register({ id, name, number, role: role as any });
        return { message: 'Device registered successfully', device };
    }

    heartbeat = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const success = await this.registry.heartbeat(id);
        if (!success) return ctx.status(404).json({ error: 'Device not found' });
        return { message: 'Heartbeat received' };
    }

    listDevices = async (ctx: any): Promise<any> => {
        const devices = await this.registry.getAllDevices();
        return { devices };
    }

    getDevice = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const device = await this.registry.getDevice(id);
        if (!device) return ctx.status(404).json({ error: 'Device not found' });
        return { device };
    }

    login = async (ctx: any): Promise<any> => {
        const { id, secret } = ctx.body;
        // In production, verify secret against DB. For now, simple ID check.
        const device = await this.registry.getDevice(id);
        if (!device) return ctx.status(404).json({ error: 'Device not found' });

        const token = AuthUtils.generateToken({ 
            id: device.id, 
            role: device.role, 
            number: device.number 
        });

        const refreshToken = AuthUtils.generateRefreshToken({ id: device.id });

        return { 
            message: 'Login successful', 
            token, 
            refreshToken,
            device 
        };
    }

    refresh = async (ctx: any): Promise<any> => {
        const { refreshToken } = ctx.body;
        if (!refreshToken) return ctx.status(400).json({ error: 'Refresh token required' });

        const decoded = AuthUtils.verifyRefreshToken(refreshToken);
        if (!decoded) return ctx.status(401).json({ error: 'Invalid or expired refresh token' });

        const device = await this.registry.getDevice(decoded.id);
        if (!device) return ctx.status(404).json({ error: 'Device not found' });

        const newToken = AuthUtils.generateToken({
            id: device.id,
            role: device.role,
            number: device.number
        });

        return { token: newToken };
    }

    updateStatus = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const { status } = ctx.body;
        const validStatuses = ['online', 'offline', 'busy', 'dnd', 'calling'];
        if (!validStatuses.includes(status)) {
            return ctx.status(400).json({ error: 'Invalid status' });
        }

        const success = await this.registry.setStatus(id, status);
        if (!success) return ctx.status(404).json({ error: 'Device not found' });
        return { message: 'Status updated', status };
    }

    updateMetadata = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const { metadata } = ctx.body;
        if (!metadata || typeof metadata !== 'object') {
            return ctx.status(400).json({ error: 'Invalid metadata' });
        }

        const success = await this.registry.updateMetadata(id, metadata);
        if (!success) return ctx.status(404).json({ error: 'Device not found' });
        return { message: 'Metadata updated', metadata };
    }

    setPushToken = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const { token } = ctx.body;
        if (!token) return ctx.status(400).json({ error: 'Token is required' });

        const success = await this.registry.setPushToken(id, token);
        if (!success) return ctx.status(404).json({ error: 'Device not found' });
        return { message: 'Push token updated' };
    }

    // --- AUTH MIDDLEWARE (Internal) ---
    async auth(ctx: any, next: () => void) {
        const authHeader = ctx.getHeader('authorization');
        if (!authHeader) return ctx.status(401).json({ error: 'Unauthorized: No token' });

        const token = authHeader.replace('Bearer ', '');
        const decoded = AuthUtils.verifyToken(token);

        if (!decoded) {
            return ctx.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        ctx.state.user = decoded;
        await next();
    }

    // Signaling bridge via REST (optional, but useful for one-way triggers)
    async initiateCall(ctx: any): Promise<any> {
        const { from, toNumber } = ctx.body;
        
        // SECURITY: Device Binding Enforcement
        // Ensure the authenticated user matches the 'from' field
        if (ctx.state.user.id !== from) {
            return ctx.status(403).json({ error: 'Forbidden: You can only initiate calls on your own behalf' });
        }

        const caller = await this.registry.getDevice(from);
        if (!caller) return ctx.status(404).json({ error: 'Caller device not found' });

        const success = await this.signaling.invite(from, toNumber);
        if (!success) return ctx.status(409).json({ error: 'Call failed: Target busy or not found' });
        return { message: 'Call initiated' };
    }

    async rejectCall(ctx: any): Promise<any> {
        const { from, to, isMissed = true } = ctx.body;
        const success = await this.signaling.reject(from, to, isMissed);
        return { message: isMissed ? 'Missed call logged' : 'Call rejected', success };
    }

    async broadcastAnnouncement(ctx: any): Promise<any> {
        const { message, type = 'SYSTEM_BROADCAST', from = 'RECEPTION' } = ctx.body;
        
        // SECURITY: Device Binding Enforcement
        if (ctx.state.user.id !== from) {
            return ctx.status(403).json({ error: 'Forbidden: Impersonation detected' });
        }

        // RBAC: Check if 'from' has admin role
        const caller = await this.registry.getDevice(from);
        if (!caller || caller.role !== 'admin') {
            return ctx.status(403).json({ error: 'Forbidden: Only admins can broadcast' });
        }

        // Broadcast both chat message and signaling event
        if (this.chat) await this.chat.broadcast(message);
        if (this.signaling) await this.signaling.broadcastSignal(type as any, { message }, from);
        
        return { message: 'Announcement broadcasted system-wide' };
    }

    getCallLogs = async (ctx: any): Promise<any> => {
        // Query database if available, otherwise return empty
        if (this.registry['db'] && this.registry['db'].CallLog) {
            const logs = await this.registry['db'].CallLog.find().sort({ startTime: -1 }).limit(50);
            return { logs };
        }
        return { logs: [], message: 'Call logging not configured in this instance' };
    }

    addSpeedDial = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const { key, label, target, type = 'internal' } = ctx.body;
        
        if (!key || !target) {
            return ctx.status(400).json({ error: 'Key and target are required' });
        }

        const success = await this.speedDial.addEntry({
            deviceId: id,
            key,
            label: label || target,
            target,
            type: type as any
        });

        return { message: 'Speed dial added', success };
    }

    listSpeedDials = async (ctx: any): Promise<any> => {
        const { id } = ctx.params;
        const entries = await this.speedDial.getEntries(id);
        return { entries };
    }

    removeSpeedDial = async (ctx: any): Promise<any> => {
        const { id, key } = ctx.params;
        const success = await this.speedDial.removeEntry(id, key);
        return { message: 'Speed dial removed', success };
    }
}
