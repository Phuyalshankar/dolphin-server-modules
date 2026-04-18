"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalSignaling = exports.SignalType = void 0;
exports.createSignaling = createSignaling;
var SignalType;
(function (SignalType) {
    // Connection / WebRTC
    SignalType["INVITE"] = "INVITE";
    SignalType["ACCEPT"] = "ACCEPT";
    SignalType["REJECT"] = "REJECT";
    SignalType["END"] = "END";
    SignalType["ICE_CANDIDATE"] = "ICE_CANDIDATE";
    // Custom Data / Control
    SignalType["COMMAND"] = "COMMAND";
    SignalType["COMMAND_ACK"] = "COMMAND_ACK";
    SignalType["TELEMETRY"] = "TELEMETRY";
    SignalType["MIRROR"] = "MIRROR";
    // General Acknowledgements
    SignalType["ACK"] = "ACK";
})(SignalType || (exports.SignalType = SignalType = {}));
class UniversalSignaling {
    rt;
    pendingAcks = new Map();
    constructor(rt) {
        this.rt = rt;
    }
    /**
     * Internal mechanism to send a signal directly to the device.
     */
    async sendRaw(to, type, data, from, requireAck = false, timeoutMs = 3000) {
        const msgId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const payload = {
            msgId,
            from,
            to,
            type,
            data,
            timestamp: Date.now()
        };
        if (requireAck) {
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    this.pendingAcks.delete(msgId);
                    resolve(false);
                }, timeoutMs);
                this.pendingAcks.set(msgId, { resolve, timer });
                // Use RealtimeCore's privatePub channel
                this.rt.privatePub(to, payload);
            });
        }
        else {
            this.rt.privatePub(to, payload);
            return true;
        }
    }
    /**
     * Used to acknowledge a signal natively
     */
    handleAck(msgId) {
        const pending = this.pendingAcks.get(msgId);
        if (pending) {
            clearTimeout(pending.timer);
            pending.resolve(true);
            this.pendingAcks.delete(msgId);
        }
    }
    ack(from, to, msgIdToAck) {
        this.rt.privatePub(to, {
            msgId: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: SignalType.ACK,
            from,
            to,
            data: { ackId: msgIdToAck },
            timestamp: Date.now()
        });
    }
    // --- WebRTC / Session Methods ---
    async invite(from, to, data) {
        return this.sendRaw(to, SignalType.INVITE, data, from, true);
    }
    async accept(from, to, sdp) {
        return this.sendRaw(to, SignalType.ACCEPT, sdp, from);
    }
    async reject(from, to, reason) {
        return this.sendRaw(to, SignalType.REJECT, { reason }, from);
    }
    async end(from, to, reason) {
        return this.sendRaw(to, SignalType.END, { reason }, from);
    }
    async iceCandidate(from, to, candidate) {
        return this.sendRaw(to, SignalType.ICE_CANDIDATE, candidate, from);
    }
    // --- Industrial / Medical Control Methods ---
    async sendCommand(from, to, commandData, requireAck = true) {
        return this.sendRaw(to, SignalType.COMMAND, commandData, from, requireAck);
    }
    async sendTelemetry(from, to, telemetryData) {
        const payload = {
            msgId: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            from,
            to,
            type: SignalType.TELEMETRY,
            data: telemetryData,
            timestamp: Date.now()
        };
        if (to === 'all') {
            this.rt.publish(`telemetry/broadcast`, payload);
        }
        else {
            this.rt.privatePub(to, payload);
        }
    }
    /**
     * Mirror a URL to a specific device's pane
     */
    async mirror(from, to, url, options = {}) {
        return this.sendRaw(to, SignalType.MIRROR, { url, ...options }, from);
    }
    /**
     * Listen to any incoming signals for a particular topic or private channel
     */
    onSignalFor(deviceId, handler) {
        this.rt.subscribe(`phone/signaling/${deviceId}`, (payload) => {
            // Auto-handle native ACK processing
            if (payload.type === SignalType.ACK && payload.data?.ackId) {
                this.handleAck(payload.data.ackId);
            }
            handler(payload);
        }, deviceId);
    }
}
exports.UniversalSignaling = UniversalSignaling;
function createSignaling(rt) {
    return new UniversalSignaling(rt);
}
//# sourceMappingURL=index.js.map