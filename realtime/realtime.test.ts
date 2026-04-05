/// <reference types="jest" />

import { TopicTrie } from './trie';
import { RealtimeCore } from './core';
import * as fs from 'fs';
import * as path from 'path';

class MockWebSocket {
  public readyState = 1;
  public messages: any[] = [];
  public closed = false;
  public pingCalled = false;
  
  send(data: any): void {
    this.messages.push(data);
  }
  
  ping(): void {
    this.pingCalled = true;
  }
  
  close(): void {
    this.closed = true;
    this.readyState = 3;
  }
}

describe('Realtime Module v2 - Tests', () => {
  let trie: TopicTrie;
  let realtime: RealtimeCore;
  let createdInstances: RealtimeCore[] = [];
  let testFileId: string;
  let testFilePath: string;

  beforeAll(() => {
    // Create a test file for file transfer tests
    testFileId = 'test-file-001';
    testFilePath = path.join(__dirname, 'test-temp-file.bin');
    const testData = Buffer.alloc(1024 * 100, 'A'); // 100KB test file
    fs.writeFileSync(testFilePath, testData);
  });

  afterAll(() => {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  beforeEach(() => {
    trie = new TopicTrie();
    realtime = new RealtimeCore({
      maxMessageSize: 1024 * 1024,
      enableJSONCache: true,
      useBinaryProtocol: false,
      debug: false,
      enableP2P: true,
      maxBufferPerTopic: 100,
      defaultChunkSize: 64 * 1024
    });
    createdInstances.push(realtime);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Clean up all created instances
    for (const instance of createdInstances) {
      if (instance && typeof instance.destroy === 'function') {
        await instance.destroy();
      }
    }
    createdInstances = [];
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  // ============================================
  // TopicTrie Tests (Existing)
  // ============================================
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

  // ============================================
  // Pub/Sub Tests (Existing)
  // ============================================
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

  // ============================================
  // v2 NEW: pubPush / subPull Tests
  // ============================================
  describe('High-Frequency: pubPush / subPull', () => {
    it('should push binary data with pubPush', () => {
      const fn = jest.fn();
      const topic = 'sensor/live';
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      
      realtime.subscribe(topic, fn);
      realtime.pubPush(topic, binaryData);
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(binaryData);
    });

    it('should pull buffered data with subPull', async () => {
      const deviceId = 'test-device-001';
      const mockSocket = new MockWebSocket();
      const topic = 'sensor/history';
      
      realtime.register(deviceId, mockSocket);
      
      // Push multiple data points
      for (let i = 1; i <= 25; i++) {
        realtime.pubPush(topic, Buffer.from([i]));
      }
      
      // Pull last 10 items
      realtime.subPull(deviceId, topic, 10);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockSocket.messages.length).toBeGreaterThan(0);
      const lastMessage = JSON.parse(mockSocket.messages[mockSocket.messages.length - 1]);
      expect(lastMessage.type).toBe('PULL_RESPONSE');
      expect(lastMessage.topic).toBe(topic);
      expect(lastMessage.count).toBeLessThanOrEqual(10);
    });

    it('should handle empty buffer in subPull', () => {
      const deviceId = 'test-device-002';
      const mockSocket = new MockWebSocket();
      const topic = 'empty/topic';
      
      realtime.register(deviceId, mockSocket);
      realtime.subPull(deviceId, topic, 10);
      
      const lastMessage = JSON.parse(mockSocket.messages[0]);
      expect(lastMessage.type).toBe('PULL_EMPTY');
      expect(lastMessage.message).toBe('No data available');
    });
  });

  // ============================================
  // v2 NEW: File Transfer Tests
  // ============================================
  describe('File Transfer: pubFile / subFile', () => {
    it('should publish a file with pubFile', () => {
      const fileId = 'test-pub-file';
      const metadata = realtime.pubFile(fileId, testFilePath);
      
      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe('test-temp-file.bin');
      expect(metadata?.size).toBe(1024 * 100);
      expect(metadata?.totalChunks).toBeGreaterThan(0);
    });

    it('should return null for non-existent file', () => {
      const result = realtime.pubFile('missing-file', '/path/to/nonexistent.bin');
      expect(result).toBeNull();
    });

    it('should get file info', () => {
      const fileId = 'test-info-file';
      realtime.pubFile(fileId, testFilePath);
      
      const info = realtime.getFileInfo(fileId);
      expect(info).toBeDefined();
      expect(info?.size).toBe(1024 * 100);
    });

    it('should list all available files', () => {
      realtime.pubFile('file-1', testFilePath);
      realtime.pubFile('file-2', testFilePath);
      
      const files = realtime.listFiles();
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files[0]).toHaveProperty('fileId');
      expect(files[0]).toHaveProperty('name');
      expect(files[0]).toHaveProperty('size');
    });

    it('should download file chunks with subFile', async () => {
      const deviceId = 'download-device';
      const mockSocket = new MockWebSocket();
      const fileId = 'test-download-file';
      
      realtime.register(deviceId, mockSocket);
      realtime.pubFile(fileId, testFilePath);
      
      // Download first chunk
      const result = await realtime.subFile(deviceId, fileId, 0);
      
      expect(result).toBe(true);
      expect(mockSocket.messages.length).toBeGreaterThan(0);
      
      const message = JSON.parse(mockSocket.messages[0]);
      expect(message.type).toBe('FILE_CHUNK');
      expect(message.fileId).toBe(fileId);
      expect(message.chunkIndex).toBe(0);
      expect(message.totalChunks).toBeDefined();
    });

    it('should handle file not found in subFile', async () => {
      const deviceId = 'error-device';
      const mockSocket = new MockWebSocket();
      
      realtime.register(deviceId, mockSocket);
      const result = await realtime.subFile(deviceId, 'non-existent-file', 0);
      
      expect(result).toBe(false);
      const message = JSON.parse(mockSocket.messages[0]);
      expect(message.type).toBe('FILE_ERROR');
      expect(message.error).toBe('File not found');
    });
  });

  // ============================================
  // v2 NEW: Resume Feature Tests
  // ============================================
  describe('Resume Feature', () => {
    it('should save and get file progress', () => {
      const deviceId = 'resume-device';
      const fileId = 'resume-file';
      
      // Save progress at chunk 5
      (realtime as any).saveFileProgress(deviceId, fileId, 5);
      
      const progress = realtime.getFileProgress(deviceId, fileId);
      expect(progress).toBe(5);
    });

    it('should return -1 for no progress', () => {
      const progress = realtime.getFileProgress('unknown-device', 'unknown-file');
      expect(progress).toBe(-1);
    });

    it('should resume file from last chunk', async () => {
      const deviceId = 'resume-device-2';
      const mockSocket = new MockWebSocket();
      const fileId = 'test-resume-file';
      
      realtime.register(deviceId, mockSocket);
      realtime.pubFile(fileId, testFilePath);
      
      // Simulate partial download (chunk 5 completed)
      (realtime as any).saveFileProgress(deviceId, fileId, 5);
      
      // Resume from chunk 6
      const result = await realtime.resumeFile(deviceId, fileId);
      
      expect(result).toBe(true);
      const message = JSON.parse(mockSocket.messages[0]);
      expect(message.type).toBe('FILE_CHUNK');
      expect(message.chunkIndex).toBe(6); // Should start from chunk 6
    });

    it('should handle complete file in resume', async () => {
      const deviceId = 'complete-device';
      const mockSocket = new MockWebSocket();
      const fileId = 'test-complete-file';
      
      realtime.register(deviceId, mockSocket);
      const metadata = realtime.pubFile(fileId, testFilePath);
      
      if (metadata) {
        // Save progress at last chunk
        (realtime as any).saveFileProgress(deviceId, fileId, metadata.totalChunks);
        
        const result = await realtime.resumeFile(deviceId, fileId);
        
        expect(result).toBe(true);
        const message = JSON.parse(mockSocket.messages[0]);
        expect(message.type).toBe('FILE_COMPLETE');
      }
    });
  });

  // ============================================
  // v2 NEW: Private Messaging Tests
  // ============================================
  describe('Private Messaging', () => {
    it('should send private message to specific device', (done) => {
      const deviceId = 'private-device-001';
      
      realtime.privateSub(deviceId, (payload: any) => {
        expect(payload).toEqual({ secret: 'OTP: 123456' });
        done();
      });
      
      realtime.privatePub(deviceId, { secret: 'OTP: 123456' });
    });

    it('should not deliver private message to wrong device', () => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();
      const deviceId1 = 'user-001';
      const deviceId2 = 'user-002';
      
      realtime.privateSub(deviceId1, fn1);
      realtime.privateSub(deviceId2, fn2);
      
      realtime.privatePub(deviceId1, { message: 'for user 1 only' });
      
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(0);
    });
  });

  // ============================================
  // v2 NEW: Socket Helper Tests
  // ============================================
  describe('Socket Helpers', () => {
    it('should check if device is ready', () => {
      const deviceId = 'ready-device';
      const mockSocket = new MockWebSocket();
      
      expect(realtime.isReady(deviceId)).toBe(false);
      
      realtime.register(deviceId, mockSocket);
      expect(realtime.isReady(deviceId)).toBe(true);
    });

    it('should check if device is online', () => {
      const deviceId = 'online-device';
      
      expect(realtime.isOnline(deviceId)).toBe(false);
      
      realtime.register(deviceId);
      expect(realtime.isOnline(deviceId)).toBe(true);
    });

    it('should send direct message with sendTo', () => {
      const deviceId = 'direct-device';
      const mockSocket = new MockWebSocket();
      const testPayload = { direct: 'message' };
      
      realtime.register(deviceId, mockSocket);
      const result = realtime.sendTo(deviceId, testPayload);
      
      expect(result).toBe(true);
      expect(mockSocket.messages.length).toBeGreaterThan(0);
    });

    it('should return false for sendTo when device not ready', () => {
      const result = realtime.sendTo('non-existent-device', { data: 'test' });
      expect(result).toBe(false);
    });

    it('should kick device', () => {
      const deviceId = 'kick-device';
      const mockSocket = new MockWebSocket();
      
      realtime.register(deviceId, mockSocket);
      expect(realtime.isOnline(deviceId)).toBe(true);
      
      realtime.kick(deviceId, 'Test kick');
      
      expect(mockSocket.closed).toBe(true);
      expect(realtime.isOnline(deviceId)).toBe(false);
    });

    it('should broadcast to group', () => {
      const device1 = new MockWebSocket();
      const device2 = new MockWebSocket();
      const device3 = new MockWebSocket();
      
      realtime.register('admin-1', device1, { group: 'admin' });
      realtime.register('admin-2', device2, { group: 'admin' });
      realtime.register('user-1', device3, { group: 'user' });
      
      realtime.broadcastToGroup('admin', { alert: 'Server update' });
      
      expect(device1.messages.length).toBeGreaterThan(0);
      expect(device2.messages.length).toBeGreaterThan(0);
      expect(device3.messages.length).toBe(0);
    });

    it('should get online devices list', () => {
      realtime.register('device-a', new MockWebSocket(), { group: 'group1' });
      realtime.register('device-b', new MockWebSocket(), { group: 'group2' });
      
      const devices = realtime.getOnlineDevices();
      
      expect(devices.length).toBe(2);
      expect(devices[0]).toHaveProperty('id');
      expect(devices[0]).toHaveProperty('lastSeen');
      expect(devices[0]).toHaveProperty('group');
    });

    it('should ping device', () => {
      const deviceId = 'ping-device';
      const mockSocket = new MockWebSocket();
      
      realtime.register(deviceId, mockSocket);
      const result = realtime.ping(deviceId);
      
      expect(result).toBe(true);
      expect(mockSocket.pingCalled).toBe(true);
    });
  });

  // ============================================
  // v2 NEW: P2P Tests
  // ============================================
  describe('P2P Features', () => {
    it('should announce file to peers', () => {
      const fileId = 'p2p-file';
      const sourceDevice = 'source-device';
      const peerDevice = new MockWebSocket();
      
      realtime.register('peer-device', peerDevice);
      realtime.announceToPeers(fileId, sourceDevice);
      
      const peers = realtime.getPeersForFile(fileId);
      expect(peers).toContain(sourceDevice);
    });

    it('should request chunk from peer', () => {
      const peerDevice = new MockWebSocket();
      const requestingDevice = 'requesting-device';
      const fileId = 'p2p-file';
      
      realtime.register('peer-001', peerDevice);
      
      const result = realtime.requestFromPeer(requestingDevice, 'peer-001', fileId, 5);
      
      expect(result).toBe(true);
      const message = JSON.parse(peerDevice.messages[0]);
      expect(message.type).toBe('P2P_REQUEST');
      expect(message.fileId).toBe(fileId);
      expect(message.chunkIndex).toBe(5);
    });

    it('should send data to peer', () => {
      const targetDevice = new MockWebSocket();
      const fromDevice = 'sender-device';
      const testData = { chunk: 'data' };
      
      realtime.register('target-peer', targetDevice);
      
      const result = realtime.sendToPeer(fromDevice, 'target-peer', testData);
      
      expect(result).toBe(true);
      const message = JSON.parse(targetDevice.messages[0]);
      expect(message.type).toBe('P2P_DATA');
      expect(message.from).toBe(fromDevice);
    });
  });

  // ============================================
  // Device Management Tests (Enhanced)
  // ============================================
  describe('Device Management', () => {
    it('should handle reconnection (remove old ghost connection)', () => {
      const deviceId = 'reconnect-device';
      const oldSocket = new MockWebSocket();
      const newSocket = new MockWebSocket();
      
      realtime.register(deviceId, oldSocket);
      expect(realtime.getSocket(deviceId)).toBe(oldSocket);
      
      // Reconnect with new socket
      realtime.register(deviceId, newSocket);
      
      expect(oldSocket.closed).toBe(true); // Old socket should be closed
      expect(realtime.getSocket(deviceId)).toBe(newSocket);
    });

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

  // ============================================
  // Broadcast Tests (Existing + Enhanced)
  // ============================================
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

  // ============================================
  // Performance Tests
  // ============================================
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

    it('should provide accurate stats', () => {
      realtime.register('stat-device-1', new MockWebSocket());
      realtime.register('stat-device-2', new MockWebSocket());
      realtime.pubFile('stat-file', testFilePath);
      
      const stats = realtime.getStats();
      
      expect(stats.version).toBe('2.0');
      expect(stats.devices).toBe(2);
      expect(stats.files).toBeGreaterThan(0);
      expect(stats).toHaveProperty('highFreqBuffers');
      expect(stats).toHaveProperty('activeTransfers');
      expect(stats).toHaveProperty('peers');
    });
  });

  // ============================================
  // ACL Tests (Existing)
  // ============================================
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

  // ============================================
  // Error Handling Tests (Existing + Enhanced)
  // ============================================
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

    it('should handle destroy cleanup', async () => {
      const testRealtime = new RealtimeCore({ debug: false });
      createdInstances.push(testRealtime);
      
      testRealtime.register('cleanup-device', new MockWebSocket());
      
      await testRealtime.destroy();
      
      const stats = testRealtime.getStats();
      expect(stats.devices).toBe(0);
    });
  });

  // ============================================
  // Direct Publish via Handle Tests (Existing)
  // ============================================
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
});