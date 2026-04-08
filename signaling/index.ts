import { RealtimeCore } from '../realtime/core';

export enum SignalType {
  // Connection / WebRTC
  INVITE = 'INVITE',
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  END = 'END',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
  
  // Custom Data / Control
  COMMAND = 'COMMAND',
  COMMAND_ACK = 'COMMAND_ACK',
  TELEMETRY = 'TELEMETRY',
  
  // General Acknowledgements
  ACK = 'ACK'
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

export class UniversalSignaling {
  private rt: RealtimeCore;
  private pendingAcks = new Map<string, { resolve: (v: boolean) => void, timer: NodeJS.Timeout }>();
  
  constructor(rt: RealtimeCore) {
    this.rt = rt;
  }
  
  /**
   * Internal mechanism to send a signal directly to the device.
   */
  private async sendRaw(to: string, type: string, data: any, from: string, requireAck: boolean = false, timeoutMs: number = 3000): Promise<boolean> {
    const msgId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payload: SignalingPayload = {
      msgId,
      from,
      to,
      type,
      data,
      timestamp: Date.now()
    };
    
    if (requireAck) {
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          this.pendingAcks.delete(msgId);
          resolve(false);
        }, timeoutMs);
        
        this.pendingAcks.set(msgId, { resolve, timer });
        
        // Use RealtimeCore's privatePub channel
        this.rt.privatePub(to, payload);
      });
    } else {
      this.rt.privatePub(to, payload);
      return true;
    }
  }

  /**
   * Used to acknowledge a signal natively
   */
  public handleAck(msgId: string) {
    const pending = this.pendingAcks.get(msgId);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(true);
      this.pendingAcks.delete(msgId);
    }
  }

  public ack(from: string, to: string, msgIdToAck: string) {
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
  
  public async invite(from: string, to: string, data?: any): Promise<boolean> {
    return this.sendRaw(to, SignalType.INVITE, data, from, true);
  }

  public async accept(from: string, to: string, sdp?: any): Promise<boolean> {
    return this.sendRaw(to, SignalType.ACCEPT, sdp, from);
  }

  public async reject(from: string, to: string, reason?: string): Promise<boolean> {
    return this.sendRaw(to, SignalType.REJECT, { reason }, from);
  }

  public async end(from: string, to: string, reason?: string): Promise<boolean> {
    return this.sendRaw(to, SignalType.END, { reason }, from);
  }

  public async iceCandidate(from: string, to: string, candidate: any): Promise<boolean> {
    return this.sendRaw(to, SignalType.ICE_CANDIDATE, candidate, from);
  }

  // --- Industrial / Medical Control Methods ---
  
  public async sendCommand(from: string, to: string, commandData: any, requireAck: boolean = true): Promise<boolean> {
    return this.sendRaw(to, SignalType.COMMAND, commandData, from, requireAck);
  }
  
  public async sendTelemetry(from: string, to: string | 'all', telemetryData: any): Promise<void> {
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
    } else {
      this.rt.privatePub(to, payload);
    }
  }

  /**
   * Listen to any incoming signals for a particular topic or private channel
   */
  public onSignalFor(deviceId: string, handler: SignalHandler) {
    this.rt.subscribe(`phone/signaling/${deviceId}`, (payload: any) => {
      // Auto-handle native ACK processing
      if (payload.type === SignalType.ACK && payload.data?.ackId) {
        this.handleAck(payload.data.ackId);
      }
      handler(payload as SignalingPayload);
    }, deviceId);
  }
}

export function createSignaling(rt: RealtimeCore) {
  return new UniversalSignaling(rt);
}
