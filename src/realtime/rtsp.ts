/**
 * RtspPullerModule
 * ─────────────────────────────────────────────────────────────
 * Pulls frames from RTSP cameras (CCTV, IP cameras) and feeds
 * them into CameraFrameModule.ingestFrame() without blocking.
 *
 * Backends:
 *   1. FFmpeg  — spawns `ffmpeg` child process (reliable, all codecs)
 *   2. Pure TCP — raw RTSP/RTP over TCP (no FFmpeg, MJPEG only)
 *
 * Usage:
 *   const puller = new RtspPullerModule(cameraModule);
 *   puller.addCamera('cam1', 'rtsp://admin:pass@192.168.1.10:554/stream');
 *   puller.removeCamera('cam1');
 *   puller.destroy();
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import { CameraFrameModule } from './camera.js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RtspBackend = 'ffmpeg' | 'tcp';

export interface RtspCameraConfig {
  /** Unique camera id */
  cameraId: string;
  /** Full RTSP URL: rtsp://user:pass@host:port/path */
  url: string;
  /** Backend to use. Default: 'ffmpeg' */
  backend?: RtspBackend;
  /** Max reconnect attempts. Default: Infinity */
  maxReconnects?: number;
  /** Delay between reconnects in ms. Default: 5000 */
  reconnectDelay?: number;
  /** Expected width (passed to CameraFrameModule) */
  expectedWidth?: number;
  /** Expected height (passed to CameraFrameModule) */
  expectedHeight?: number;
  /** FFmpeg extra args, e.g. ['-vf', 'scale=640:480'] */
  ffmpegArgs?: string[];
}

export interface RtspCameraStats {
  cameraId: string;
  url: string;
  backend: RtspBackend;
  state: 'connecting' | 'streaming' | 'reconnecting' | 'stopped' | 'error';
  framesForwarded: number;
  reconnectCount: number;
  lastFrameAt: number | null;
  errorMessage: string | null;
}

// ─────────────────────────────────────────────────────────────
// Internal per-camera handle
// ─────────────────────────────────────────────────────────────

interface CameraHandle {
  config: Required<RtspCameraConfig>;
  stats: RtspCameraStats;
  process?: ChildProcess;         // FFmpeg backend
  tcpSocket?: net.Socket;         // TCP backend
  reconnectTimer?: ReturnType<typeof setTimeout>;
  stopped: boolean;
}

// ─────────────────────────────────────────────────────────────
// RtspPullerModule
// ─────────────────────────────────────────────────────────────

export class RtspPullerModule extends EventEmitter {
  private cameras: Map<string, CameraHandle> = new Map();
  private camModule: CameraFrameModule;

  constructor(cameraModule: CameraFrameModule) {
    super();
    this.camModule = cameraModule;
  }

  // ───────────────────────────────────────────
  // Public API
  // ───────────────────────────────────────────

  addCamera(config: RtspCameraConfig): void {
    if (this.cameras.has(config.cameraId)) {
      this.removeCamera(config.cameraId);
    }

    const full: Required<RtspCameraConfig> = {
      backend: 'ffmpeg',
      maxReconnects: Infinity,
      reconnectDelay: 5000,
      expectedWidth: 0,
      expectedHeight: 0,
      ffmpegArgs: [],
      ...config,
    };

    const handle: CameraHandle = {
      config: full,
      stopped: false,
      stats: {
        cameraId: full.cameraId,
        url: full.url,
        backend: full.backend,
        state: 'connecting',
        framesForwarded: 0,
        reconnectCount: 0,
        lastFrameAt: null,
        errorMessage: null,
      },
    };

    this.cameras.set(full.cameraId, handle);

    // Register camera with width/height hints
    this.camModule.registerCamera({
      cameraId: full.cameraId,
      expectedWidth: full.expectedWidth || undefined,
      expectedHeight: full.expectedHeight || undefined,
    });

    this.emit('camera:added', { cameraId: full.cameraId });
    this.connect(handle);
  }

  removeCamera(cameraId: string): void {
    const handle = this.cameras.get(cameraId);
    if (!handle) return;

    handle.stopped = true;
    this.stopHandle(handle);
    this.cameras.delete(cameraId);
    this.emit('camera:removed', { cameraId });
  }

  listCameras(): string[] {
    return Array.from(this.cameras.keys());
  }

  getStats(cameraId: string): RtspCameraStats | undefined {
    return this.cameras.get(cameraId)?.stats;
  }

  getAllStats(): RtspCameraStats[] {
    return Array.from(this.cameras.values()).map(h => ({ ...h.stats }));
  }

  destroy(): void {
    for (const [id] of this.cameras) {
      this.removeCamera(id);
    }
    this.removeAllListeners();
  }

  // ───────────────────────────────────────────
  // Connection management
  // ───────────────────────────────────────────

  private connect(handle: CameraHandle): void {
    if (handle.stopped) return;

    handle.stats.state = 'connecting';
    handle.stats.errorMessage = null;
    this.emit('camera:connecting', { cameraId: handle.config.cameraId });

    if (handle.config.backend === 'ffmpeg') {
      this.connectFFmpeg(handle);
    } else {
      this.connectTcp(handle);
    }
  }

  private scheduleReconnect(handle: CameraHandle): void {
    if (handle.stopped) return;

    const { maxReconnects, reconnectDelay, cameraId } = handle.config;
    if (handle.stats.reconnectCount >= maxReconnects) {
      handle.stats.state = 'error';
      handle.stats.errorMessage = `Max reconnects (${maxReconnects}) reached`;
      this.camModule.markOffline(cameraId);
      this.emit('camera:error', { cameraId, error: handle.stats.errorMessage });
      return;
    }

    handle.stats.reconnectCount++;
    handle.stats.state = 'reconnecting';
    this.emit('camera:reconnecting', {
      cameraId,
      attempt: handle.stats.reconnectCount,
    });

    handle.reconnectTimer = setTimeout(() => {
      if (!handle.stopped) this.connect(handle);
    }, reconnectDelay);
  }

  private stopHandle(handle: CameraHandle): void {
    if (handle.reconnectTimer) {
      clearTimeout(handle.reconnectTimer);
      handle.reconnectTimer = undefined;
    }
    if (handle.process) {
      handle.process.stdout?.removeAllListeners();
      handle.process.stderr?.removeAllListeners();
      handle.process.removeAllListeners();
      handle.process.kill('SIGTERM');
      handle.process = undefined;
    }
    if (handle.tcpSocket) {
      handle.tcpSocket.removeAllListeners();
      handle.tcpSocket.destroy();
      handle.tcpSocket = undefined;
    }
    this.camModule.markOffline(handle.config.cameraId);
    handle.stats.state = 'stopped';
  }

  // ───────────────────────────────────────────
  // Backend 1: FFmpeg
  // ───────────────────────────────────────────

  private connectFFmpeg(handle: CameraHandle): void {
    const { url, cameraId, ffmpegArgs } = handle.config;

    /*
     * FFmpeg command:
     *   ffmpeg -rtsp_transport tcp -i <url>
     *          -f mjpeg -q:v 3 -r 10 -
     *
     * This outputs MJPEG frames to stdout (binary).
     * We read stdout as a stream and find JPEG boundaries
     * (FF D8 FF ... FF D9) to extract individual frames.
     */
    const args = [
      '-loglevel', 'error',
      '-rtsp_transport', 'tcp',
      '-i', url,
      ...ffmpegArgs,
      '-f', 'mjpeg',
      '-q:v', '3',
      '-r', '15',
      'pipe:1',
    ];

    let proc: ChildProcess;
    try {
      proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      handle.stats.errorMessage = `ffmpeg not found: ${(err as Error).message}`;
      handle.stats.state = 'error';
      this.emit('camera:error', { cameraId, error: handle.stats.errorMessage });
      return;
    }

    handle.process = proc;

    // Parse MJPEG frames from stdout
    let buf = Buffer.alloc(0);

    proc.stdout?.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);

      // Find complete MJPEG frames: FF D8 FF ... FF D9
      let start = -1;
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i] === 0xFF && buf[i + 1] === 0xD8) {
          start = i;
        }
        if (start !== -1 && buf[i] === 0xFF && buf[i + 1] === 0xD9) {
          const frame = Buffer.alloc(i + 2 - start);
          buf.copy(frame, 0, start, i + 2);
          this.forwardFrame(handle, frame);
          buf = buf.slice(i + 2);
          start = -1;
          i = -1; // restart scan
        }
      }

      // Prevent buffer bloat (>10MB = drop)
      if (buf.length > 10 * 1024 * 1024) {
        buf = Buffer.alloc(0);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf-8').trim();
      if (msg) {
        handle.stats.errorMessage = msg.slice(0, 200);
        this.emit('camera:warn', { cameraId, message: msg.slice(0, 200) });
      }
    });

    proc.on('error', (err) => {
      handle.stats.errorMessage = err.message;
      if (!handle.stopped) this.scheduleReconnect(handle);
    });

    proc.on('close', (code) => {
      handle.process = undefined;
      if (!handle.stopped) {
        this.scheduleReconnect(handle);
      }
    });

    // Mark streaming once first frame arrives
    // (handled in forwardFrame)
  }

  // ───────────────────────────────────────────
  // Backend 2: Pure TCP RTSP (MJPEG over RTSP)
  // ───────────────────────────────────────────

  private connectTcp(handle: CameraHandle): void {
    const { url, cameraId } = handle.config;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      handle.stats.errorMessage = `Invalid RTSP URL: ${url}`;
      handle.stats.state = 'error';
      this.emit('camera:error', { cameraId, error: handle.stats.errorMessage });
      return;
    }

    const host = parsed.hostname;
    const port = parseInt(parsed.port || '554', 10);
    const path = parsed.pathname + (parsed.search || '');
    const auth = parsed.username
      ? `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`
      : null;

    const socket = new net.Socket();
    handle.tcpSocket = socket;

    let cseq = 1;
    let sessionId: string | null = null;
    let rtpBuffer = Buffer.alloc(0);
    let mjpegBuffer = Buffer.alloc(0);
    let streamStarted = false;

    const send = (data: string) => {
      if (!socket.destroyed) socket.write(data);
    };

    const sendOptions = () => {
      send(
        `OPTIONS ${url} RTSP/1.0\r\n` +
        `CSeq: ${cseq++}\r\n` +
        (auth ? `Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n` : '') +
        `User-Agent: DolphinCamera/1.0\r\n\r\n`
      );
    };

    const sendDescribe = () => {
      send(
        `DESCRIBE ${url} RTSP/1.0\r\n` +
        `CSeq: ${cseq++}\r\n` +
        `Accept: application/sdp\r\n` +
        (auth ? `Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n` : '') +
        `User-Agent: DolphinCamera/1.0\r\n\r\n`
      );
    };

    const sendSetup = () => {
      send(
        `SETUP ${url}/trackID=1 RTSP/1.0\r\n` +
        `CSeq: ${cseq++}\r\n` +
        `Transport: RTP/AVP/TCP;unicast;interleaved=0-1\r\n` +
        (sessionId ? `Session: ${sessionId}\r\n` : '') +
        (auth ? `Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n` : '') +
        `User-Agent: DolphinCamera/1.0\r\n\r\n`
      );
    };

    const sendPlay = () => {
      send(
        `PLAY ${url} RTSP/1.0\r\n` +
        `CSeq: ${cseq++}\r\n` +
        `Session: ${sessionId}\r\n` +
        `Range: npt=0.000-\r\n` +
        (auth ? `Authorization: Basic ${Buffer.from(auth).toString('base64')}\r\n` : '') +
        `User-Agent: DolphinCamera/1.0\r\n\r\n`
      );
    };

    socket.connect(port, host, () => {
      sendOptions();
    });

    socket.on('data', (chunk: Buffer) => {
      rtpBuffer = Buffer.concat([rtpBuffer, chunk]);

      // Process interleaved RTP ($ marker) and RTSP responses
      while (rtpBuffer.length > 0) {
        if (rtpBuffer[0] === 0x24 /* '$' */) {
          // Interleaved RTP frame: $ channel(1) length(2) data
          if (rtpBuffer.length < 4) break;
          const channel = rtpBuffer[1];
          const frameLen = rtpBuffer.readUInt16BE(2);
          if (rtpBuffer.length < 4 + frameLen) break;

          if (channel === 0) {
            // RTP video channel — extract payload
            const rtp = rtpBuffer.slice(4, 4 + frameLen);
            if (rtp.length >= 12) {
              const payload = rtp.slice(12); // skip 12-byte RTP header
              // Accumulate MJPEG chunks
              mjpegBuffer = Buffer.concat([mjpegBuffer, payload]);

              // Detect JPEG boundaries
              for (let i = 0; i < mjpegBuffer.length - 1; i++) {
                if (mjpegBuffer[i] === 0xFF && mjpegBuffer[i + 1] === 0xD9) {
                  const frame = Buffer.alloc(i + 2);
                  mjpegBuffer.copy(frame, 0, 0, i + 2);
                  if (frame[0] === 0xFF && frame[1] === 0xD8) {
                    this.forwardFrame(handle, frame);
                  }
                  mjpegBuffer = mjpegBuffer.slice(i + 2);
                  break;
                }
              }
              if (mjpegBuffer.length > 2 * 1024 * 1024) mjpegBuffer = Buffer.alloc(0);
            }
          }
          rtpBuffer = rtpBuffer.slice(4 + frameLen);
        } else {
          // RTSP response — find end of headers (\r\n\r\n)
          const headerEnd = rtpBuffer.indexOf('\r\n\r\n');
          if (headerEnd === -1) break;
          const response = rtpBuffer.slice(0, headerEnd + 4).toString('utf-8');
          rtpBuffer = rtpBuffer.slice(headerEnd + 4);

          // Extract Session id
          const sesMatch = response.match(/Session:\s*([^\r\n;]+)/i);
          if (sesMatch) sessionId = sesMatch[1].trim();

          if (response.includes('200 OK')) {
            if (!streamStarted && response.includes('Public:')) {
              sendDescribe();
            } else if (response.includes('Content-Type: application/sdp') || response.includes('Content-Base:')) {
              sendSetup();
            } else if (response.includes('Transport:')) {
              sendPlay();
              streamStarted = true;
              handle.stats.state = 'streaming';
              this.emit('camera:streaming', { cameraId });
            }
          } else if (response.includes('401')) {
            handle.stats.errorMessage = 'Authentication failed (401)';
            handle.stats.state = 'error';
            this.emit('camera:error', { cameraId, error: handle.stats.errorMessage });
            socket.destroy();
          } else if (response.includes('404')) {
            handle.stats.errorMessage = 'Stream not found (404)';
            handle.stats.state = 'error';
            this.emit('camera:error', { cameraId, error: handle.stats.errorMessage });
            socket.destroy();
          }
        }
      }
    });

    socket.on('error', (err) => {
      handle.stats.errorMessage = err.message;
      if (!handle.stopped) this.scheduleReconnect(handle);
    });

    socket.on('close', () => {
      handle.tcpSocket = undefined;
      if (!handle.stopped) this.scheduleReconnect(handle);
    });

    socket.setTimeout(10000, () => {
      socket.destroy();
      if (!handle.stopped) this.scheduleReconnect(handle);
    });
  }

  // ───────────────────────────────────────────
  // Frame forwarding to CameraFrameModule
  // ───────────────────────────────────────────

  private forwardFrame(handle: CameraHandle, frame: Buffer): void {
    if (handle.stopped || !frame || frame.length === 0) return;

    if (handle.stats.state !== 'streaming') {
      handle.stats.state = 'streaming';
      this.emit('camera:streaming', { cameraId: handle.config.cameraId });
    }

    const result = this.camModule.ingestFrame(handle.config.cameraId, frame);
    if (result) {
      handle.stats.framesForwarded++;
      handle.stats.lastFrameAt = Date.now();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

export function createRtspPuller(cameraModule: CameraFrameModule): RtspPullerModule {
  return new RtspPullerModule(cameraModule);
}
