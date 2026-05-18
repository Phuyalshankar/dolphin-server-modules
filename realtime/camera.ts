import { EventEmitter } from 'events';
import { RealtimeCore } from './core';

/**
 * Supported camera frame codec types
 */
export type CameraCodec = 'MJPEG' | 'H264' | 'H265' | 'RAW_RGB' | 'RAW_YUV' | 'UNKNOWN';

/**
 * Parsed camera frame metadata
 */
export interface CameraFrame {
  cameraId: string;
  codec: CameraCodec;
  width: number;
  height: number;
  timestamp: number;
  frameIndex: number;
  isKeyFrame: boolean;
  data: Buffer;
  sizeBytes: number;
}

/**
 * Camera registration options
 */
export interface CameraOptions {
  cameraId: string;
  codec?: CameraCodec;
  expectedWidth?: number;
  expectedHeight?: number;
  maxFps?: number;
  recordingEnabled?: boolean;
}

/**
 * Camera stats per camera
 */
interface CameraStats {
  cameraId: string;
  framesReceived: number;
  bytesReceived: number;
  fps: number;
  lastFrameAt: number;
  codec: CameraCodec;
  width: number;
  height: number;
  isOnline: boolean;
}

/**
 * Detect codec from raw binary frame buffer
 */
function detectCodec(buf: Buffer): CameraCodec {
  if (buf.length < 4) return 'UNKNOWN';

  // MJPEG: starts with FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'MJPEG';
  }

  // H.264 NAL unit: starts with 00 00 00 01 or 00 00 01
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x01) {
    return 'H264';
  }
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01) {
    return 'H264';
  }

  // H.265 / HEVC: NAL unit type in byte 0 bits [1-6]
  // HEVC starts with 00 00 00 01 as well but NAL type >= 32
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x01) {
    const nalType = (buf[4] >> 1) & 0x3F;
    if (nalType >= 32) return 'H265';
    return 'H264';
  }

  // Raw RGB: heuristic — divisible by 3 (RGB triplets) and large enough
  if (buf.length % 3 === 0 && buf.length > 1000) {
    return 'RAW_RGB';
  }

  // Raw YUV: heuristic — divisible by 2 (YUV 4:2:2)
  if (buf.length % 2 === 0 && buf.length > 1000) {
    return 'RAW_YUV';
  }

  return 'UNKNOWN';
}

/**
 * Detect if H.264 NAL unit is a keyframe (IDR frame)
 */
function isH264KeyFrame(buf: Buffer): boolean {
  // Find NAL start code
  let offset = 0;
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x01) {
    offset = 4;
  } else if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01) {
    offset = 3;
  }
  if (offset >= buf.length) return false;
  const nalType = buf[offset] & 0x1F;
  return nalType === 5; // IDR = keyframe
}

/**
 * Try to extract MJPEG resolution from JFIF/EXIF header
 */
function getMjpegResolution(buf: Buffer): { width: number; height: number } {
  // Scan for SOF0 (FF C0) or SOF2 (FF C2) markers
  for (let i = 0; i < Math.min(buf.length - 9, 512); i++) {
    if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      if (width > 0 && height > 0) return { width, height };
    }
  }
  return { width: 0, height: 0 };
}

/**
 * CameraFrameModule — Direct binary camera frame handler for RealtimeCore
 *
 * Handles raw binary frames from IP cameras without needing FFmpeg.
 * Supports MJPEG, H.264, H.265, RAW_RGB, RAW_YUV formats.
 *
 * Usage:
 *   const cam = new CameraFrameModule(rt);
 *   cam.registerCamera({ cameraId: 'cam1', codec: 'MJPEG' });
 *   cam.ingestFrame('cam1', frameBuffer);
 *   cam.subscribe('cam1', (frame) => { ... });
 */
export class CameraFrameModule extends EventEmitter {
  private rt: RealtimeCore;
  private cameras = new Map<string, CameraOptions & CameraStats>();
  private frameCounters = new Map<string, number>();
  private fpsTrackers = new Map<string, { count: number; windowStart: number }>();
  private offlineTimers = new Map<string, NodeJS.Timeout>();

  private readonly OFFLINE_TIMEOUT_MS = 10000; // 10s no frame → offline
  private readonly FPS_WINDOW_MS = 1000;

  constructor(rt: RealtimeCore) {
    super();
    this.rt = rt;
  }

  /**
   * Register a camera before ingesting frames
   */
  registerCamera(opts: CameraOptions): void {
    const existing = this.cameras.get(opts.cameraId);
    if (existing) return; // already registered

    this.cameras.set(opts.cameraId, {
      ...opts,
      codec: opts.codec || 'UNKNOWN',
      framesReceived: 0,
      bytesReceived: 0,
      fps: 0,
      lastFrameAt: 0,
      width: opts.expectedWidth || 0,
      height: opts.expectedHeight || 0,
      isOnline: false,
    });

    this.frameCounters.set(opts.cameraId, 0);
    this.fpsTrackers.set(opts.cameraId, { count: 0, windowStart: Date.now() });

    this.emit('camera:registered', { cameraId: opts.cameraId });
  }

  /**
   * Ingest a raw binary frame from a camera.
   * Auto-detects codec if not registered.
   * Publishes to RealtimeCore topic: camera/<cameraId>/frame
   */
  ingestFrame(cameraId: string, rawBuffer: Buffer): CameraFrame | null {
    if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) return null;

    // Auto-register if not known
    if (!this.cameras.has(cameraId)) {
      this.registerCamera({ cameraId });
    }

    const cam = this.cameras.get(cameraId)!;
    const now = Date.now();

    // Detect codec from binary signature
    const codec = cam.codec !== 'UNKNOWN' ? cam.codec : detectCodec(rawBuffer);

    // Extract resolution
    let width = cam.width;
    let height = cam.height;
    if ((width === 0 || height === 0) && codec === 'MJPEG') {
      const res = getMjpegResolution(rawBuffer);
      width = res.width || width;
      height = res.height || height;
    }

    // Detect keyframe
    let isKeyFrame = false;
    if (codec === 'MJPEG') isKeyFrame = true; // MJPEG = every frame is a keyframe
    if (codec === 'H264') isKeyFrame = isH264KeyFrame(rawBuffer);

    // Increment counters
    const frameIndex = (this.frameCounters.get(cameraId) || 0) + 1;
    this.frameCounters.set(cameraId, frameIndex);

    // Update FPS tracker
    const tracker = this.fpsTrackers.get(cameraId)!;
    tracker.count++;
    const elapsed = now - tracker.windowStart;
    if (elapsed >= this.FPS_WINDOW_MS) {
      cam.fps = Math.round((tracker.count / elapsed) * 1000);
      tracker.count = 0;
      tracker.windowStart = now;
    }

    // Update stats
    cam.codec = codec;
    cam.width = width;
    cam.height = height;
    cam.framesReceived = frameIndex;
    cam.bytesReceived += rawBuffer.length;
    cam.lastFrameAt = now;
    cam.isOnline = true;

    // Build frame object
    const frame: CameraFrame = {
      cameraId,
      codec,
      width,
      height,
      timestamp: now,
      frameIndex,
      isKeyFrame,
      data: rawBuffer,
      sizeBytes: rawBuffer.length,
    };

    // Publish to RealtimeCore — high frequency binary push
    this.rt.pubPush(`camera/${cameraId}/frame`, rawBuffer);

    // Also publish metadata separately for lightweight subscribers
    this.rt.publish(`camera/${cameraId}/meta`, {
      cameraId,
      codec,
      width,
      height,
      timestamp: now,
      frameIndex,
      isKeyFrame,
      sizeBytes: rawBuffer.length,
      fps: cam.fps,
    });

    // Emit locally
    this.emit('frame', frame);
    this.emit(`frame:${cameraId}`, frame);

    // Reset offline timer
    this._resetOfflineTimer(cameraId);

    return frame;
  }

  /**
   * Subscribe to frames from a specific camera
   */
  subscribe(cameraId: string, fn: (frame: CameraFrame) => void): void {
    this.on(`frame:${cameraId}`, fn);
  }

  /**
   * Subscribe to ALL cameras
   */
  subscribeAll(fn: (frame: CameraFrame) => void): void {
    this.on('frame', fn);
  }

  /**
   * Unsubscribe from a camera
   */
  unsubscribe(cameraId: string, fn: (frame: CameraFrame) => void): void {
    this.off(`frame:${cameraId}`, fn);
  }

  /**
   * Get live stats for a camera
   */
  getStats(cameraId: string): CameraStats | undefined {
    const cam = this.cameras.get(cameraId);
    if (!cam) return undefined;
    return {
      cameraId: cam.cameraId,
      framesReceived: cam.framesReceived,
      bytesReceived: cam.bytesReceived,
      fps: cam.fps,
      lastFrameAt: cam.lastFrameAt,
      codec: cam.codec,
      width: cam.width,
      height: cam.height,
      isOnline: cam.isOnline,
    };
  }

  /**
   * Get stats for all cameras
   */
  getAllStats(): CameraStats[] {
    return Array.from(this.cameras.keys()).map(id => this.getStats(id)!);
  }

  /**
   * List registered camera IDs
   */
  listCameras(): string[] {
    return Array.from(this.cameras.keys());
  }

  /**
   * Mark a camera as offline manually
   */
  markOffline(cameraId: string): void {
    const cam = this.cameras.get(cameraId);
    if (cam) {
      cam.isOnline = false;
      this.emit('camera:offline', { cameraId });
      this.rt.publish(`camera/${cameraId}/status`, { cameraId, status: 'offline', timestamp: Date.now() });
    }
  }

  /**
   * Remove a camera from the module
   */
  removeCamera(cameraId: string): void {
    this.cameras.delete(cameraId);
    this.frameCounters.delete(cameraId);
    this.fpsTrackers.delete(cameraId);
    const timer = this.offlineTimers.get(cameraId);
    if (timer) clearTimeout(timer);
    this.offlineTimers.delete(cameraId);
    this.emit('camera:removed', { cameraId });
  }

  /**
   * Destroy the module and clean up
   */
  destroy(): void {
    for (const timer of this.offlineTimers.values()) clearTimeout(timer);
    this.offlineTimers.clear();
    this.cameras.clear();
    this.frameCounters.clear();
    this.fpsTrackers.clear();
    this.removeAllListeners();
  }

  private _resetOfflineTimer(cameraId: string): void {
    const existing = this.offlineTimers.get(cameraId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.markOffline(cameraId);
    }, this.OFFLINE_TIMEOUT_MS);

    this.offlineTimers.set(cameraId, timer);
  }
}

/**
 * Factory function
 */
export function createCameraModule(rt: RealtimeCore): CameraFrameModule {
  return new CameraFrameModule(rt);
}
