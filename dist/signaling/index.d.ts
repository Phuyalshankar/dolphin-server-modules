import { RealtimeCore } from '../realtime/core';
export declare enum SignalType {
    INVITE = "INVITE",
    ACCEPT = "ACCEPT",
    REJECT = "REJECT",
    END = "END",
    ICE_CANDIDATE = "ICE_CANDIDATE",
    COMMAND = "COMMAND",
    COMMAND_ACK = "COMMAND_ACK",
    TELEMETRY = "TELEMETRY",
    MIRROR = "MIRROR",
    ACK = "ACK"
}
export interface SignalingPayload {
    msgId: string;
    from: string;
    to: string;
    type: SignalType | string;
    data?: any;
    timestamp: number;
}
export type SignalHandler = (payload: SignalingPayload) => void;
export declare class UniversalSignaling {
    private rt;
    private pendingAcks;
    constructor(rt: RealtimeCore);
    /**
     * Internal mechanism to send a signal directly to the device.
     */
    private sendRaw;
    /**
     * Used to acknowledge a signal natively
     */
    handleAck(msgId: string): void;
    ack(from: string, to: string, msgIdToAck: string): void;
    invite(from: string, to: string, data?: any): Promise<boolean>;
    accept(from: string, to: string, sdp?: any): Promise<boolean>;
    reject(from: string, to: string, reason?: string): Promise<boolean>;
    end(from: string, to: string, reason?: string): Promise<boolean>;
    iceCandidate(from: string, to: string, candidate: any): Promise<boolean>;
    sendCommand(from: string, to: string, commandData: any, requireAck?: boolean): Promise<boolean>;
    sendTelemetry(from: string, to: string | 'all', telemetryData: any): Promise<void>;
    /**
     * Mirror a URL to a specific device's pane
     */
    mirror(from: string, to: string, url: string, options?: any): Promise<boolean>;
    /**
     * Listen to any incoming signals for a particular topic or private channel
     */
    onSignalFor(deviceId: string, handler: SignalHandler): void;
}
export declare function createSignaling(rt: RealtimeCore): UniversalSignaling;
