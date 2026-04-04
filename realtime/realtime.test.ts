/// <reference types="jest" />

import { TopicTrie } from './trie';
import { RealtimeCore } from './core';

class MockWebSocket {
  public readyState = 1;
  public messages: any[] = [];
  public closed = false;
  
  send(data: any): void {
    this.messages.push(data);
  }
  
  ping(): void {}
  
  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
}

describe('Realtime Module - Tests', () => {
  let trie: TopicTrie;
  let realtime: RealtimeCore;
  let createdInstances: RealtimeCore[] = [];

  beforeEach(() => {
    trie = new TopicTrie();
    realtime = new RealtimeCore({
      maxMessageSize: 1024 * 1024,
      enableJSONCache: true,
      useBinaryProtocol: false,
      debug: false
    });
    createdInstances.push(realtime);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Clean up all created instances to prevent worker process leaks
    for (const instance of createdInstances) {
      if (instance && typeof instance.destroy === 'function') {
        await instance.destroy();
      }
    }
    createdInstances = [];
  });

  afterAll(async () => {
    // Final cleanup and wait for any pending intervals
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  describe('TopicTrie', () => {
    it('should match exact topics', () => {
      const fn = jest.fn();
      trie.add('sensors/temp', fn);
      trie.match('sensors/temp', (f: Function) => f());
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should match single level wildcard (+)', () => {
      const fn = jest.fn();
      trie.add('sensors/+', fn);
      trie.match('sensors/temp', (f: Function) => f());
      trie.match('sensors/hum', (f: Function) => f());
      trie.match('actuators/led', (f: Function) => f());
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should match multi-level wildcard (#)', () => {
      const fn = jest.fn();
      trie.add('sensors/#', fn);
      trie.match('sensors/temp', (f: Function) => f());
      trie.match('sensors/temp/value', (f: Function) => f());
      trie.match('sensors/hum/status', (f: Function) => f());
      trie.match('actuators/led', (f: Function) => f());
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple subscribers on same topic', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      trie.add('device/status', fn1);
      trie.add('device/status', fn2);
      trie.match('device/status', (f: Function) => f());
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Publish/Subscribe', () => {
    it('should publish and receive messages', (done) => {
      const testTopic = 'test/topic';
      const testPayload = { message: 'hello world' };
      
      realtime.subscribe(testTopic, (payload: any) => {
        expect(payload).toEqual(testPayload);
        done();
      });
      
      realtime.publish(testTopic, testPayload);
    });

    it('should handle retained messages', () => {
      const fn = jest.fn();
      const testTopic = 'retained/topic';
      const testPayload = { data: 'retained message' };
      
      realtime.publish(testTopic, testPayload, { retain: true, ttl: 10000 });
      realtime.subscribe(testTopic, fn);
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(testPayload);
    });
  });

  describe('Direct Publish via Handle', () => {
    it('should handle pub format JSON payload', async () => {
      const fn = jest.fn();
      const topic = 'direct/test';
      const testPayload = { sensor: 'temp', value: 25 };
      
      realtime.subscribe(topic, fn);
      
      const message = Buffer.from(JSON.stringify({
        type: 'pub',
        topic: topic,
        payload: testPayload
      }));
      
      await realtime.handle(message, null, 'device-001');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(testPayload);
    });

    it('should handle base64 encoded pub message', async () => {
      const fn = jest.fn();
      const topic = 'base64/test';
      const testPayload = { command: 'start', value: 100 };
      
      realtime.subscribe(topic, fn);
      
      const originalMessage = {
        type: 'pub',
        topic: topic,
        payload: testPayload
      };
      const jsonStr = JSON.stringify(originalMessage);
      const base64Message = Buffer.from(jsonStr).toString('base64');
      
      await realtime.handle(Buffer.from(base64Message), null, 'device-002');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(testPayload);
    });

    it('should handle hex encoded pub message', async () => {
      const fn = jest.fn();
      const topic = 'hex/test';
      const testPayload = { command: 'toggle', state: true };
      
      realtime.subscribe(topic, fn);
      
      const originalMessage = {
        type: 'pub',
        topic: topic,
        payload: testPayload
      };
      const jsonStr = JSON.stringify(originalMessage);
      const hexMessage = Buffer.from(jsonStr).toString('hex');
      
      await realtime.handle(Buffer.from(hexMessage), null, 'device-003');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(testPayload);
    });
  });

  describe('Device Management', () => {
    it('should register and track devices', () => {
      const deviceId = 'device-001';
      const mockSocket = new MockWebSocket();
      
      realtime.register(deviceId, mockSocket, { type: 'sensor' });
      const socket = realtime.getSocket(deviceId);
      expect(socket).toBe(mockSocket);
    });

    it('should handle device heartbeat', () => {
      const deviceId = 'device-002';
      realtime.register(deviceId);
      realtime.touch(deviceId);
      
      const stats = realtime.getStats();
      expect(stats.devices).toBe(1);
    });

    it('should unregister devices', () => {
      const deviceId = 'device-003';
      const mockSocket = new MockWebSocket();
      
      realtime.register(deviceId, mockSocket);
      expect(realtime.getSocket(deviceId)).toBe(mockSocket);
      
      realtime.unregister(deviceId);
      expect(realtime.getSocket(deviceId)).toBeUndefined();
      expect(mockSocket.closed).toBe(true);
    });
  });

  describe('Broadcast', () => {
    it('should broadcast to all devices', () => {
      const device1 = new MockWebSocket();
      const device2 = new MockWebSocket();
      
      realtime.register('device-1', device1);
      realtime.register('device-2', device2);
      
      realtime.broadcast('test', { data: 'test' });
      
      expect(device1.messages.length).toBeGreaterThan(0);
      expect(device2.messages.length).toBeGreaterThan(0);
    });

    it('should exclude specific devices from broadcast', () => {
      const device1 = new MockWebSocket();
      const device2 = new MockWebSocket();
      
      realtime.register('device-1', device1);
      realtime.register('device-2', device2);
      
      realtime.broadcast('test', { data: 'test' }, { exclude: ['device-1'] });
      
      expect(device1.messages.length).toBe(0);
      expect(device2.messages.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should respect max message size', () => {
      const largePayload = { data: 'x'.repeat(1024 * 1024 + 1) };
      
      expect(() => {
        realtime.publish('test/large', largePayload);
      }).toThrow('Payload too large');
    });

    it('should cache JSON serialization results', () => {
      const payload = { repeated: 'data', value: 123 };
      const cachedRealtime = new RealtimeCore({ enableJSONCache: true, debug: false });
      createdInstances.push(cachedRealtime);
      
      cachedRealtime.publish('test', payload);
      
      const start1 = Date.now();
      cachedRealtime.publish('test', payload);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      cachedRealtime.publish('test', payload);
      const time2 = Date.now() - start2;
      
      expect(time2).toBeLessThanOrEqual(time1 + 10);
      
      const stats = cachedRealtime.getStats();
      expect(stats.cacheEnabled).toBe(true);
    });
  });

  describe('ACL', () => {
    it('should enforce subscribe ACL', () => {
      const aclRealtime = new RealtimeCore({
        acl: {
          canSubscribe: (deviceId: string, topic: string) => 
            deviceId === 'allowed-device' && topic === 'allowed/topic',
          canPublish: () => true
        },
        debug: false
      });
      createdInstances.push(aclRealtime);
      
      const fn = jest.fn();
      
      expect(() => {
        aclRealtime.subscribe('allowed/topic', fn, 'allowed-device');
      }).not.toThrow();
      
      expect(() => {
        aclRealtime.subscribe('forbidden/topic', fn, 'bad-device');
      }).toThrow('ACL deny');
    });

    it('should enforce publish ACL', () => {
      const aclRealtime = new RealtimeCore({
        acl: {
          canSubscribe: () => true,
          canPublish: (deviceId: string, topic: string) => 
            deviceId === 'allowed-device' && topic === 'allowed/topic'
        },
        debug: false
      });
      createdInstances.push(aclRealtime);
      
      expect(() => {
        aclRealtime.publish('allowed/topic', { data: 'test' }, {}, 'allowed-device');
      }).not.toThrow();
      
      expect(() => {
        aclRealtime.publish('forbidden/topic', { data: 'test' }, {}, 'bad-device');
      }).toThrow('ACL deny');
    });
  });

  describe('Error Handling', () => {
    it('should handle socket send errors', () => {
      const faultySocket = new MockWebSocket();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      faultySocket.send = jest.fn(() => { throw new Error('Send failed'); });
      
      realtime.register('faulty-device', faultySocket);
      
      expect(() => {
        realtime.broadcast('test', { data: 'test' });
      }).not.toThrow();
      
      expect(faultySocket.send).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});