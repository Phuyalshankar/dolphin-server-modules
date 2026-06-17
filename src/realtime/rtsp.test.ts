/// <reference types="jest" />

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { Socket } from 'net';

// ─────────────────────────────────────────────────────────────
// Mock CameraFrameModule
// ─────────────────────────────────────────────────────────────
class MockCameraModule extends EventEmitter {
  registered: string[] = [];
  ingested: { cameraId: string; frame: Buffer }[] = [];
  offline: string[] = [];

  registerCamera({ cameraId, expectedWidth, expectedHeight }: any) {
    if (!this.registered.includes(cameraId)) this.registered.push(cameraId);
  }

  ingestFrame(cameraId: string, frame: Buffer) {
    this.ingested.push({ cameraId, frame });
    return { cameraId, codec: 'MJPEG', frameIndex: this.ingested.length, timestamp: Date.now(), sizeBytes: frame.length, isKeyFrame: true };
  }

  markOffline(cameraId: string) {
    this.offline.push(cameraId);
    this.emit('camera:offline', { cameraId });
  }
}

// ─────────────────────────────────────────────────────────────
// Mock child_process.spawn
// ─────────────────────────────────────────────────────────────
let mockSpawn: jest.Mock;
let mockProc: any;

jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// ─────────────────────────────────────────────────────────────
// Mock net.Socket
// ─────────────────────────────────────────────────────────────
let mockSocket: any;

jest.mock('net', () => ({
  Socket: jest.fn(() => mockSocket),
}));

// ─────────────────────────────────────────────────────────────
// Import after mocks
// ─────────────────────────────────────────────────────────────
import { RtspPullerModule, createRtspPuller } from './rtsp';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function makeMjpegFrame(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0x00);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF;
  buf[size - 2] = 0xFF; buf[size - 1] = 0xD9;
  return buf;
}

function makeRtpInterleaved(payload: Buffer, channel = 0): Buffer {
  // Interleaved RTP: $ <channel> <len 2B> <12B RTP header> <payload>
  const rtpHeader = Buffer.alloc(12, 0x00);
  const frame = Buffer.concat([rtpHeader, payload]);
  const out = Buffer.alloc(4 + frame.length);
  out[0] = 0x24; // '$'
  out[1] = channel;
  out.writeUInt16BE(frame.length, 2);
  frame.copy(out, 4);
  return out;
}

function resetMocks() {
  mockProc = new EventEmitter() as any;
  mockProc.stdout = new EventEmitter();
  mockProc.stderr = new EventEmitter();
  mockProc.kill = jest.fn();
  mockSpawn = jest.fn(() => mockProc);

  mockSocket = new EventEmitter() as any;
  mockSocket.connect = jest.fn((port: number, host: string, cb: () => void) => cb());
  mockSocket.write = jest.fn();
  mockSocket.destroy = jest.fn();
  mockSocket.destroyed = false;
  mockSocket.setTimeout = jest.fn();
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────
describe('RtspPullerModule', () => {
  let cam: MockCameraModule;
  let puller: RtspPullerModule;

  beforeEach(() => {
    resetMocks();
    cam = new MockCameraModule();
    puller = new RtspPullerModule(cam as any);
  });

  afterEach(() => {
    puller.destroy();
    jest.clearAllTimers();
  });

  // ─────────────────────────────────────────
  // Camera Registration
  // ─────────────────────────────────────────
  describe('Camera Management', () => {
    it('should add a camera and list it', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      expect(puller.listCameras()).toContain('cam1');
    });

    it('should register camera with CameraFrameModule on add', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      expect(cam.registered).toContain('cam1');
    });

    it('should remove a camera', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.removeCamera('cam1');
      expect(puller.listCameras()).not.toContain('cam1');
    });

    it('should call markOffline when camera removed', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.removeCamera('cam1');
      expect(cam.offline).toContain('cam1');
    });

    it('should emit camera:added event', (done) => {
      puller.on('camera:added', ({ cameraId }) => {
        expect(cameraId).toBe('cam1');
        done();
      });
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
    });

    it('should emit camera:removed event', (done) => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.on('camera:removed', ({ cameraId }) => {
        expect(cameraId).toBe('cam1');
        done();
      });
      puller.removeCamera('cam1');
    });

    it('should replace camera if same id added twice', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.20/stream', backend: 'ffmpeg' });
      expect(puller.listCameras().filter(id => id === 'cam1').length).toBe(1);
    });

    it('should handle listCameras with no cameras', () => {
      expect(puller.listCameras()).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────
  // FFmpeg Backend
  // ─────────────────────────────────────────
  describe('FFmpeg Backend', () => {
    it('should spawn ffmpeg with correct args', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
        '-rtsp_transport', 'tcp',
        '-i', 'rtsp://192.168.1.10/stream',
      ]), expect.any(Object));
    });

    it('should forward MJPEG frame to CameraFrameModule on stdout data', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      const frame = makeMjpegFrame(64);
      mockProc.stdout.emit('data', frame);
      expect(cam.ingested.length).toBe(1);
      expect(cam.ingested[0].cameraId).toBe('cam1');
    });

    it('should forward a newly allocated/copied buffer instead of a slice of the parent stream buffer to avoid memory leaks', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      
      const frameData = makeMjpegFrame(64);
      
      // Feed a larger stream chunk containing the frame
      const largerStreamChunk = Buffer.concat([
        Buffer.from([0x00, 0x11, 0x22]), // prefix garbage
        frameData,
        Buffer.from([0x33, 0x44, 0x55])  // suffix garbage
      ]);
      
      mockProc.stdout.emit('data', largerStreamChunk);
      
      expect(cam.ingested.length).toBe(1);
      const ingestedFrame = cam.ingested[0].frame;
      
      // The ingested frame should be exactly the frameData we expect
      expect(ingestedFrame.length).toBe(frameData.length);
      expect(ingestedFrame[0]).toBe(0xFF);
      expect(ingestedFrame[frameData.length - 1]).toBe(0xD9);
      
      // Crucially, it MUST NOT share the same memory slice (its buffer should be isolated).
      // Since Node.js Buffers have .buffer (the underlying ArrayBuffer), if it was sliced,
      // ingestedFrame.buffer.byteLength would equal largerStreamChunk.buffer.byteLength.
      // If it is copied, its underlying ArrayBuffer byteLength will be exactly 64 bytes!
      expect(ingestedFrame.buffer.byteLength).toBe(frameData.length);
    });

    it('should handle partial frames across multiple chunks', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      const frame = makeMjpegFrame(64);
      // Split frame into two chunks
      mockProc.stdout.emit('data', frame.slice(0, 32));
      expect(cam.ingested.length).toBe(0);
      mockProc.stdout.emit('data', frame.slice(32));
      expect(cam.ingested.length).toBe(1);
    });

    it('should handle multiple frames in single chunk', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      const frame1 = makeMjpegFrame(64);
      const frame2 = makeMjpegFrame(80);
      mockProc.stdout.emit('data', Buffer.concat([frame1, frame2]));
      expect(cam.ingested.length).toBe(2);
    });

    it('should set state to streaming after first frame', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      const frame = makeMjpegFrame(64);
      mockProc.stdout.emit('data', frame);
      expect(puller.getStats('cam1')?.state).toBe('streaming');
    });

    it('should increment framesForwarded per frame', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      mockProc.stdout.emit('data', makeMjpegFrame(64));
      mockProc.stdout.emit('data', makeMjpegFrame(64));
      mockProc.stdout.emit('data', makeMjpegFrame(64));
      expect(puller.getStats('cam1')?.framesForwarded).toBe(3);
    });

    it('should schedule reconnect on process close', () => {
      jest.useFakeTimers();
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      mockProc.emit('close', 1);
      expect(puller.getStats('cam1')?.state).toBe('reconnecting');
      jest.useRealTimers();
    });

    it('should schedule reconnect on process error', () => {
      jest.useFakeTimers();
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      mockProc.emit('error', new Error('ffmpeg crashed'));
      expect(puller.getStats('cam1')?.state).toBe('reconnecting');
      jest.useRealTimers();
    });

    it('should pass extra ffmpegArgs to spawn', () => {
      puller.addCamera({
        cameraId: 'cam1',
        url: 'rtsp://192.168.1.10/stream',
        backend: 'ffmpeg',
        ffmpegArgs: ['-vf', 'scale=640:480'],
      });
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
        '-vf', 'scale=640:480',
      ]), expect.any(Object));
    });

    it('should kill ffmpeg process on removeCamera', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.removeCamera('cam1');
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  // ─────────────────────────────────────────
  // TCP Backend (Pure RTSP)
  // ─────────────────────────────────────────
  describe('TCP Backend', () => {
    it('should connect socket to correct host/port', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10:554/stream', backend: 'tcp' });
      expect(mockSocket.connect).toHaveBeenCalledWith(554, '192.168.1.10', expect.any(Function));
    });

    it('should send OPTIONS on connect', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('OPTIONS'));
    });

    it('should send DESCRIBE after OPTIONS 200 OK', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      mockSocket.emit('data', Buffer.from(
        'RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY\r\n\r\n'
      ));
      expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('DESCRIBE'));
    });

    it('should send SETUP after DESCRIBE 200 OK with SDP', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      // OPTIONS response
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS\r\n\r\n'));
      // DESCRIBE response
      mockSocket.emit('data', Buffer.from(
        'RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\nContent-Base: rtsp://192.168.1.10/stream\r\n\r\n'
      ));
      expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('SETUP'));
    });

    it('should send PLAY after SETUP 200 OK with Transport', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS\r\n\r\n'));
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\n\r\n'));
      mockSocket.emit('data', Buffer.from(
        'RTSP/1.0 200 OK\r\nCSeq: 3\r\nSession: 12345678\r\nTransport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n\r\n'
      ));
      expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('PLAY'));
    });

    it('should forward MJPEG frame from interleaved RTP', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      // Bring to PLAY state
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS\r\n\r\n'));
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\n\r\n'));
      mockSocket.emit('data', Buffer.from('RTSP/1.0 200 OK\r\nCSeq: 3\r\nSession: 12345678\r\nTransport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n\r\n'));

      // Send MJPEG frame as interleaved RTP
      const mjpeg = makeMjpegFrame(64);
      const rtp = makeRtpInterleaved(mjpeg, 0);
      mockSocket.emit('data', rtp);
      expect(cam.ingested.length).toBe(1);
    });

    it('should set state=error on 401 Unauthorized', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://admin:wrong@192.168.1.10/stream', backend: 'tcp' });
      mockSocket.emit('data', Buffer.from('RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\n\r\n'));
      expect(puller.getStats('cam1')?.state).toBe('error');
    });

    it('should set state=error on 404 Not Found', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/badpath', backend: 'tcp' });
      mockSocket.emit('data', Buffer.from('RTSP/1.0 404 Not Found\r\nCSeq: 1\r\n\r\n'));
      expect(puller.getStats('cam1')?.state).toBe('error');
    });

    it('should schedule reconnect on socket close', () => {
      jest.useFakeTimers();
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      mockSocket.emit('close');
      expect(puller.getStats('cam1')?.state).toBe('reconnecting');
      jest.useRealTimers();
    });

    it('should schedule reconnect on socket error', () => {
      jest.useFakeTimers();
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      mockSocket.emit('error', new Error('ECONNREFUSED'));
      expect(puller.getStats('cam1')?.state).toBe('reconnecting');
      jest.useRealTimers();
    });

    it('should destroy socket on removeCamera', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'tcp' });
      puller.removeCamera('cam1');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should handle invalid RTSP URL gracefully', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'not-a-url', backend: 'tcp' });
      expect(puller.getStats('cam1')?.state).toBe('error');
    });
  });

  // ─────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────
  describe('Stats', () => {
    it('should return undefined stats for unknown camera', () => {
      expect(puller.getStats('unknown')).toBeUndefined();
    });

    it('should return all camera stats', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.addCamera({ cameraId: 'cam2', url: 'rtsp://192.168.1.11/stream', backend: 'ffmpeg' });
      expect(puller.getAllStats().length).toBe(2);
    });

    it('should track lastFrameAt on frame received', () => {
      const before = Date.now();
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      mockProc.stdout.emit('data', makeMjpegFrame(64));
      expect(puller.getStats('cam1')?.lastFrameAt).toBeGreaterThanOrEqual(before);
    });

    it('should track reconnectCount', () => {
      jest.useFakeTimers();
      puller.addCamera({
        cameraId: 'cam1',
        url: 'rtsp://192.168.1.10/stream',
        backend: 'ffmpeg',
        reconnectDelay: 100,
      });
      mockProc.emit('close', 1);
      expect(puller.getStats('cam1')?.reconnectCount).toBe(1);
      jest.useRealTimers();
    });

    it('should set state=error when maxReconnects reached', () => {
      jest.useFakeTimers();
      puller.addCamera({
        cameraId: 'cam1',
        url: 'rtsp://192.168.1.10/stream',
        backend: 'ffmpeg',
        maxReconnects: 1,
        reconnectDelay: 100,
      });
      // First disconnect triggers reconnect
      mockProc.emit('close', 1);
      // Simulate reconnected proc also failing
      resetMocks();
      jest.advanceTimersByTime(100);
      mockProc.emit('close', 1);
      expect(puller.getStats('cam1')?.state).toBe('error');
      jest.useRealTimers();
    });
  });

  // ─────────────────────────────────────────
  // Factory & Destroy
  // ─────────────────────────────────────────
  describe('Factory and Cleanup', () => {
    it('createRtspPuller should return RtspPullerModule', () => {
      const p = createRtspPuller(cam as any);
      expect(p).toBeInstanceOf(RtspPullerModule);
      p.destroy();
    });

    it('should clear all cameras on destroy()', () => {
      puller.addCamera({ cameraId: 'cam1', url: 'rtsp://192.168.1.10/stream', backend: 'ffmpeg' });
      puller.addCamera({ cameraId: 'cam2', url: 'rtsp://192.168.1.11/stream', backend: 'ffmpeg' });
      puller.destroy();
      expect(puller.listCameras()).toHaveLength(0);
    });
  });
});
