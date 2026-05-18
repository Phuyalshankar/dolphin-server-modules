/// <reference types="jest" />

import { RealtimeCore } from './core';
import { CameraFrameModule, createCameraModule, CameraFrame } from './camera';

// ============================================
// Helper: MJPEG frame बनाउने (FF D8 FF signature)
// ============================================
function makeMjpegFrame(width = 640, height = 480): Buffer {
  // Minimal MJPEG: SOI + SOF0 marker with resolution
  const buf = Buffer.alloc(64, 0x00);
  // SOI marker
  buf[0] = 0xFF; buf[1] = 0xD8;
  // APP0 marker
  buf[2] = 0xFF; buf[3] = 0xE0;
  // SOF0 marker at offset 20
  buf[20] = 0xFF; buf[21] = 0xC0;
  buf[22] = 0x00; buf[23] = 0x11; // length
  buf[24] = 0x08; // precision
  buf.writeUInt16BE(height, 25);
  buf.writeUInt16BE(width, 27);
  return buf;
}

// ============================================
// Helper: H.264 IDR keyframe बनाउने
// ============================================
function makeH264KeyFrame(): Buffer {
  const buf = Buffer.alloc(16, 0x00);
  // NAL start code
  buf[0] = 0x00; buf[1] = 0x00; buf[2] = 0x00; buf[3] = 0x01;
  // NAL type = 5 (IDR = keyframe)
  buf[4] = 0x65;
  return buf;
}

// ============================================
// Helper: H.264 P-frame (non-keyframe) बनाउने
// ============================================
function makeH264PFrame(): Buffer {
  const buf = Buffer.alloc(16, 0x00);
  buf[0] = 0x00; buf[1] = 0x00; buf[2] = 0x00; buf[3] = 0x01;
  // NAL type = 1 (non-IDR = P-frame)
  buf[4] = 0x41;
  return buf;
}

// ============================================
// Helper: Unknown/raw frame
// ============================================
function makeRawFrame(size = 2048): Buffer {
  return Buffer.alloc(size, 0xAB);
}

describe('CameraFrameModule', () => {
  let rt: RealtimeCore;
  let cam: CameraFrameModule;
  let instances: RealtimeCore[] = [];

  beforeEach(() => {
    rt = new RealtimeCore({ debug: false, maxBufferPerTopic: 200 });
    cam = createCameraModule(rt);
    instances.push(rt);
  });

  afterEach(async () => {
    cam.destroy();
    for (const instance of instances) {
      await instance.destroy();
    }
    instances = [];
  });

  // ============================================
  // Camera Registration Tests
  // ============================================
  describe('Camera Registration', () => {
    it('should register a camera', () => {
      cam.registerCamera({ cameraId: 'cam1', codec: 'MJPEG' });
      expect(cam.listCameras()).toContain('cam1');
    });

    it('should auto-register camera on first frame', () => {
      const frame = makeMjpegFrame();
      cam.ingestFrame('cam-auto', frame);
      expect(cam.listCameras()).toContain('cam-auto');
    });

    it('should not duplicate register same camera', () => {
      cam.registerCamera({ cameraId: 'cam1' });
      cam.registerCamera({ cameraId: 'cam1' });
      expect(cam.listCameras().filter(id => id === 'cam1').length).toBe(1);
    });

    it('should remove a camera', () => {
      cam.registerCamera({ cameraId: 'cam1' });
      cam.removeCamera('cam1');
      expect(cam.listCameras()).not.toContain('cam1');
    });
  });

  // ============================================
  // Codec Detection Tests
  // ============================================
  describe('Codec Detection', () => {
    it('should detect MJPEG codec from FF D8 FF signature', () => {
      const frame = makeMjpegFrame();
      const result = cam.ingestFrame('cam-mjpeg', frame);
      expect(result).not.toBeNull();
      expect(result?.codec).toBe('MJPEG');
    });

    it('should detect H.264 codec from NAL start code 00 00 00 01', () => {
      const frame = makeH264KeyFrame();
      const result = cam.ingestFrame('cam-h264', frame);
      expect(result?.codec).toBe('H264');
    });

    it('should detect H.264 P-frame', () => {
      const frame = makeH264PFrame();
      const result = cam.ingestFrame('cam-h264-p', frame);
      expect(result?.codec).toBe('H264');
    });

    it('should return UNKNOWN for unrecognized binary', () => {
      const buf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const result = cam.ingestFrame('cam-unknown', buf);
      expect(result?.codec).toBe('UNKNOWN');
    });
  });

  // ============================================
  // Keyframe Detection Tests
  // ============================================
  describe('Keyframe Detection', () => {
    it('should mark MJPEG as keyframe (every frame)', () => {
      const frame = makeMjpegFrame();
      const result = cam.ingestFrame('cam1', frame);
      expect(result?.isKeyFrame).toBe(true);
    });

    it('should mark H.264 IDR (NAL type 5) as keyframe', () => {
      const frame = makeH264KeyFrame();
      const result = cam.ingestFrame('cam1', frame);
      expect(result?.isKeyFrame).toBe(true);
    });

    it('should mark H.264 P-frame (NAL type 1) as non-keyframe', () => {
      const frame = makeH264PFrame();
      const result = cam.ingestFrame('cam1', frame);
      expect(result?.isKeyFrame).toBe(false);
    });
  });

  // ============================================
  // Resolution Detection Tests
  // ============================================
  describe('Resolution Detection', () => {
    it('should extract resolution from MJPEG SOF0 header', () => {
      const frame = makeMjpegFrame(1280, 720);
      const result = cam.ingestFrame('cam-res', frame);
      expect(result?.width).toBe(1280);
      expect(result?.height).toBe(720);
    });

    it('should use expectedWidth/Height if provided', () => {
      cam.registerCamera({ cameraId: 'cam-preset', expectedWidth: 1920, expectedHeight: 1080 });
      const frame = makeRawFrame();
      const result = cam.ingestFrame('cam-preset', frame);
      expect(result?.width).toBe(1920);
      expect(result?.height).toBe(1080);
    });
  });

  // ============================================
  // Frame Ingestion Tests
  // ============================================
  describe('Frame Ingestion', () => {
    it('should return null for empty buffer', () => {
      const result = cam.ingestFrame('cam1', Buffer.alloc(0));
      expect(result).toBeNull();
    });

    it('should return null for non-buffer input', () => {
      const result = cam.ingestFrame('cam1', null as any);
      expect(result).toBeNull();
    });

    it('should increment frame index on each ingest', () => {
      const frame = makeMjpegFrame();
      const r1 = cam.ingestFrame('cam1', frame);
      const r2 = cam.ingestFrame('cam1', frame);
      const r3 = cam.ingestFrame('cam1', frame);
      expect(r1?.frameIndex).toBe(1);
      expect(r2?.frameIndex).toBe(2);
      expect(r3?.frameIndex).toBe(3);
    });

    it('should include correct timestamp', () => {
      const before = Date.now();
      const result = cam.ingestFrame('cam1', makeMjpegFrame());
      const after = Date.now();
      expect(result?.timestamp).toBeGreaterThanOrEqual(before);
      expect(result?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should include correct sizeBytes', () => {
      const frame = makeMjpegFrame();
      const result = cam.ingestFrame('cam1', frame);
      expect(result?.sizeBytes).toBe(frame.length);
    });
  });

  // ============================================
  // Subscription Tests
  // ============================================
  describe('Subscriptions', () => {
    it('should receive frame via subscribe()', (done) => {
      cam.subscribe('cam1', (frame: CameraFrame) => {
        expect(frame.cameraId).toBe('cam1');
        expect(frame.codec).toBe('MJPEG');
        done();
      });
      cam.ingestFrame('cam1', makeMjpegFrame());
    });

    it('should receive ALL camera frames via subscribeAll()', (done) => {
      const received: string[] = [];
      cam.subscribeAll((frame: CameraFrame) => {
        received.push(frame.cameraId);
        if (received.length === 2) {
          expect(received).toContain('cam1');
          expect(received).toContain('cam2');
          done();
        }
      });
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam2', makeH264KeyFrame());
    });

    it('should unsubscribe correctly', () => {
      const fn = jest.fn();
      cam.subscribe('cam1', fn);
      cam.unsubscribe('cam1', fn);
      cam.ingestFrame('cam1', makeMjpegFrame());
      expect(fn).not.toHaveBeenCalled();
    });

    it('should publish frame to RealtimeCore topic camera/<id>/frame', () => {
      const rtFn = jest.fn();
      rt.subscribe('camera/cam1/frame', rtFn);
      cam.ingestFrame('cam1', makeMjpegFrame());
      expect(rtFn).toHaveBeenCalledTimes(1);
    });

    it('should publish metadata to camera/<id>/meta topic', (done) => {
      rt.subscribe('camera/cam1/meta', (meta: any) => {
        expect(meta.cameraId).toBe('cam1');
        expect(meta.codec).toBe('MJPEG');
        expect(meta.frameIndex).toBe(1);
        expect(meta).toHaveProperty('fps');
        done();
      });
      cam.ingestFrame('cam1', makeMjpegFrame());
    });

    it('should support wildcard subscription for all cameras via RealtimeCore', () => {
      const fn = jest.fn();
      rt.subscribe('camera/+/meta', fn);
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam2', makeH264KeyFrame());
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // Stats Tests
  // ============================================
  describe('Camera Stats', () => {
    it('should track framesReceived count', () => {
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam1', makeMjpegFrame());
      const stats = cam.getStats('cam1');
      expect(stats?.framesReceived).toBe(3);
    });

    it('should track bytesReceived', () => {
      const frame = makeMjpegFrame();
      cam.ingestFrame('cam1', frame);
      cam.ingestFrame('cam1', frame);
      const stats = cam.getStats('cam1');
      expect(stats?.bytesReceived).toBe(frame.length * 2);
    });

    it('should mark camera as online after frame', () => {
      cam.ingestFrame('cam1', makeMjpegFrame());
      expect(cam.getStats('cam1')?.isOnline).toBe(true);
    });

    it('should return undefined stats for unknown camera', () => {
      expect(cam.getStats('non-existent')).toBeUndefined();
    });

    it('should return all cameras stats', () => {
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam2', makeH264KeyFrame());
      const allStats = cam.getAllStats();
      expect(allStats.length).toBe(2);
      expect(allStats.map(s => s.cameraId)).toContain('cam1');
      expect(allStats.map(s => s.cameraId)).toContain('cam2');
    });
  });

  // ============================================
  // Offline Detection Tests
  // ============================================
  describe('Offline Detection', () => {
    it('should emit camera:offline when markOffline() called', (done) => {
      cam.registerCamera({ cameraId: 'cam1' });
      cam.on('camera:offline', ({ cameraId }) => {
        expect(cameraId).toBe('cam1');
        done();
      });
      cam.markOffline('cam1');
    });

    it('should set isOnline=false after markOffline()', () => {
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.markOffline('cam1');
      expect(cam.getStats('cam1')?.isOnline).toBe(false);
    });
  });

  // ============================================
  // Multi-Camera Tests
  // ============================================
  describe('Multi-Camera Handling', () => {
    it('should handle 10 cameras simultaneously', () => {
      const results: (CameraFrame | null)[] = [];
      for (let i = 1; i <= 10; i++) {
        const frame = i % 2 === 0 ? makeMjpegFrame() : makeH264KeyFrame();
        results.push(cam.ingestFrame(`cam${i}`, frame));
      }
      expect(cam.listCameras().length).toBe(10);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should keep frame counters independent per camera', () => {
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.ingestFrame('cam2', makeH264KeyFrame());

      expect(cam.getStats('cam1')?.framesReceived).toBe(2);
      expect(cam.getStats('cam2')?.framesReceived).toBe(1);
    });

    it('should emit camera:registered event', (done) => {
      cam.on('camera:registered', ({ cameraId }) => {
        expect(cameraId).toBe('cam-new');
        done();
      });
      cam.registerCamera({ cameraId: 'cam-new' });
    });
  });

  // ============================================
  // Destroy / Cleanup Tests
  // ============================================
  describe('Cleanup', () => {
    it('should clear all state on destroy()', () => {
      cam.registerCamera({ cameraId: 'cam1' });
      cam.ingestFrame('cam1', makeMjpegFrame());
      cam.destroy();
      expect(cam.listCameras().length).toBe(0);
    });
  });
});
