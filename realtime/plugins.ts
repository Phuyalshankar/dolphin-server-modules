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
 * Sample HL7 Plugin
 */
export const HL7Plugin: RealtimePlugin = {
  name: 'hl7',
  match: (ctx) => ctx.raw?.includes?.(0x0b) ?? false,
  decode: (buf) => ({ msg: buf.toString().split('\r') })
};

/**
 * Sample Modbus Plugin
 */
export const ModbusPlugin: RealtimePlugin = {
  name: 'modbus',
  match: (ctx) => ctx.raw?.length === 8,
  decode: (buf) => ({
    addr: buf[0],
    func: buf[1],
    value: buf.readUInt16BE(2)
  })
};

/**
 * Standard JSON Plugin for Web
 */
export const JSONPlugin: RealtimePlugin = {
  name: 'json',
  match: (ctx) => {
    try {
      if (ctx.raw) {
        JSON.parse(ctx.raw.toString());
        return true;
      }
    } catch {
      return false;
    }
    return false;
  },
  decode: (buf) => JSON.parse(buf.toString())
};
