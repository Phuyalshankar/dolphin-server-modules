/// <reference types="jest" />

import { RealtimeCore } from '../realtime/core';
import { createSignaling, SignalType } from './index';

class MockWebSocket {
  public readyState = 1;
  public messages: any[] = [];
  public closed = false;
  
  send(data: any): void {
    if (this.closed) return;
    this.messages.push(data);
  }
  
  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
}

describe('Signaling Module - Final Tests', () => {
  let rt: RealtimeCore;
  let signaling: any;

  beforeEach(() => {
    rt = new RealtimeCore({ debug: false, useBinaryProtocol: false });
    signaling = createSignaling(rt);
  });

  afterEach(async () => {
    await rt.destroy();
  });

  it('should register a device and listen for signals', (done) => {
    const deviceId = 'test-device-1';
    const mockSocket = new MockWebSocket();
    
    rt.register(deviceId, mockSocket);
    
    signaling.onSignalFor(deviceId, (payload: any) => {
      expect(payload.type).toBe(SignalType.INVITE);
      expect(payload.from).toBe('caller');
      done();
    });
    
    // Simulate incoming signal
    rt.privatePub(deviceId, {
      msgId: 'msg-123',
      type: SignalType.INVITE,
      from: 'caller',
      to: deviceId,
      timestamp: Date.now()
    });
  });

  it('should successfully send an invite and handle ACK', async () => {
    const callerId = 'caller-device';
    const receiverId = 'receiver-device';
    const receiverSocket = new MockWebSocket();
    const callerSocket = new MockWebSocket();
    
    rt.register(receiverId, receiverSocket);
    rt.register(callerId, callerSocket);
    
    // Important: Both sides must be listening to their signaling channels
    // Caller needs to listen to receive the ACK
    signaling.onSignalFor(callerId, () => {});
    
    // Receiver auto-ACKs
    signaling.onSignalFor(receiverId, (payload: any) => {
        if (payload.type === SignalType.INVITE) {
            signaling.ack(receiverId, callerId, payload.msgId);
        }
    });

    // Caller sends invite and waits for ACK
    const ackReceived = await signaling.invite(callerId, receiverId, { sdp: 'test-sdp' });
    
    expect(ackReceived).toBe(true);
  });

  it('should time out if no ACK is received', async () => {
    const callerId = 'caller-device';
    const receiverId = 'receiver-device';
    
    // Caller is listening but receiver never sends ACK
    signaling.onSignalFor(callerId, () => {});

    // Caller sends invite (timeout set to 100ms for faster test)
    const ackReceived = await (signaling as any).sendRaw(receiverId, SignalType.INVITE, {}, callerId, true, 100);
    
    expect(ackReceived).toBe(false); 
  });

  it('should handle call acceptance', (done) => {
    const callerId = 'caller';
    const receiverId = 'receiver';
    const callerSocket = new MockWebSocket();
    rt.register(callerId, callerSocket);

    signaling.onSignalFor(callerId, (payload: any) => {
      if (payload.type === SignalType.ACCEPT) {
        expect(payload.data.sdp).toBe('answer-sdp');
        done();
      }
    });

    signaling.accept(receiverId, callerId, { sdp: 'answer-sdp' });
  });

  it('should exchange ICE candidates', (done) => {
    const deviceId = 'target';
    const socket = new MockWebSocket();
    rt.register(deviceId, socket);

    signaling.onSignalFor(deviceId, (payload: any) => {
      if (payload.type === SignalType.ICE_CANDIDATE) {
        expect(payload.data.candidate).toBe('cand-01');
        done();
      }
    });

    signaling.iceCandidate('source', deviceId, { candidate: 'cand-01' });
  });

  it('should handle telemetry broadcasting', (done) => {
    const deviceId = 'sensor';
    const rt2 = new RealtimeCore();
    const sig2 = createSignaling(rt2);

    rt2.subscribe('telemetry/broadcast', (payload) => {
       expect(payload.type).toBe(SignalType.TELEMETRY);
       expect(payload.data.v).toBe(100);
       rt2.destroy().then(() => done());
    });

    sig2.sendTelemetry(deviceId, 'all', { v: 100 });
  });
});
