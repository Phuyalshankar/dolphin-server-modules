/**
 * Realtime Plugins for Dolphin.
 * Allows handling custom protocols (e.g. Modbus, HL7) seamlessly.
 */
export type RealtimeContext = {
    id?: number;
    type: string;
    topic?: string;
    payload?: any;
    raw?: Buffer;
    socket?: any;
    deviceId?: string;
    ts: number;
    publish: (topic: string, payload: any, opts?: any) => void;
};
export type RealtimePlugin = {
    name: string;
    match: (ctx: RealtimeContext) => boolean;
    decode?: (buf: Buffer) => any;
    encode?: (data: any) => Buffer;
    onMessage?: (ctx: RealtimeContext) => void;
};
/**
 * Complete Modbus Plugin
 * अब 8 bytes मात्र होइन, सबै Modbus frames ह्यान्डल गर्छ
 */
export declare const ModbusPlugin: RealtimePlugin;
/**
 * Sample HL7 Plugin
 */
export declare const HL7Plugin: RealtimePlugin;
/**
 * Standard JSON Plugin for Web
 */
export declare const JSONPlugin: RealtimePlugin;
/**
 * Modbus Frame Builder (Write operations को लागि)
 */
export declare function buildModbusFrame(slaveId: number, functionCode: number, data: Buffer): Buffer;
/**
 * Read Holding Registers frame बनाउने
 */
export declare function buildReadRegistersFrame(slaveId: number, startAddress: number, quantity: number): Buffer;
/**
 * Write Single Register frame बनाउने
 */
export declare function buildWriteRegisterFrame(slaveId: number, address: number, value: number): Buffer;
