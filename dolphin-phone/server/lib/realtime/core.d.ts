import { EventEmitter } from 'events';
import { RealtimePlugin } from './plugins';
/**
 * File Metadata Interface
 */
interface FileMetadata {
    path: string;
    size: number;
    chunkSize: number;
    totalChunks: number;
    name: string;
    hash?: string;
    createdAt: number;
}
/**
 * RealtimeCore v2.0 - High performance unified pub/sub bus for Dolphin
 * Added Features: pubPush, subPull, pubFile, subFile, Resume, P2P Stream
 */
export declare class RealtimeCore extends EventEmitter {
    private config;
    private trie;
    private retained;
    private devices;
    private plugins;
    private pending;
    private msgId;
    private highFreqBuffers;
    private readonly MAX_BUFFER_SIZE;
    private fileRegistry;
    private fileProgress;
    private readonly DEFAULT_CHUNK_SIZE;
    private peerRegistry;
    private jsonCache;
    private readonly CACHE_TTL;
    private readonly MAX_CACHE_SIZE;
    private redisPub?;
    private redisSub?;
    private cleanupInterval?;
    private cacheCleanupInterval?;
    private bufferCleanupInterval?;
    constructor(config?: {
        maxMessageSize?: number;
        redisUrl?: string;
        acl?: {
            canSubscribe: (deviceId: string, topic: string) => boolean;
            canPublish: (deviceId: string, topic: string) => boolean;
        };
        enableJSONCache?: boolean;
        useBinaryProtocol?: boolean;
        debug?: boolean;
        maxBufferPerTopic?: number;
        defaultChunkSize?: number;
        enableP2P?: boolean;
    });
    private log;
    private toJSON;
    private getCacheKey;
    private setCache;
    private cleanJSONCache;
    private cleanupBuffers;
    private initRedis;
    subscribe(topic: string, fn: (data: any) => void, deviceId?: string): void;
    publish(topic: string, payload: any, opts?: {
        retain?: boolean;
        ttl?: number;
    }, deviceId?: string): void;
    private publishInternal;
    /**
     * pubPush: अति उच्च गतिको डाटाको लागि (IoT Sensors, Live Graphs)
     * - No JSON.stringify, No Redis, No ACL चेक
     * - सिधै Trie मा भएका Subscribers लाई पठाउने
     * - Memory-efficient: सीमित मात्र बफर राख्छ
     */
    pubPush(topic: string, payload: Buffer | Uint8Array | any): void;
    /**
     * subPull: क्लाइन्टले मागेपछि मात्र डाटा दिने (Data Saving)
     * @param deviceId - कसलाई पठाउने
     * @param topic - कुन टपिकको डाटा चाहियो
     * @param count - कति वटा पछिल्ला डाटा चाहियो (default: 10)
     */
    subPull(deviceId: string, topic: string, count?: number): void;
    /**
     * pubFile: ठूलो फाइललाई टुक्रा-टुक्रा (Chunks) मा पठाउन तयार गर्ने
     * - फाइललाई पूरै मेमोरीमा नराखी 'Stream' तयार पार्ने
     * - हरेक टुक्रा 64KB (हल्का)
     */
    pubFile(fileId: string, filePath: string, chunkSize?: number): FileMetadata | null;
    /**
     * subFile: फाइलको निश्चित टुक्रा (Chunk) तान्ने - Resume Support सहित
     * @param deviceId - कसलाई पठाउने
     * @param fileId - कुन फाइल
     * @param startChunk - कुन Chunk बाट सुरु गर्ने (Resume को लागि)
     */
    subFile(deviceId: string, fileId: string, startChunk?: number): Promise<boolean>;
    /**
     * resumeFile: पहिले रोकिएको ठाउँबाट फाइल फेरि सुरु गर्ने
     */
    resumeFile(deviceId: string, fileId: string): Promise<boolean>;
    /**
     * saveFileProgress: डाउनलोड प्रगति सेभ गर्ने
     */
    private saveFileProgress;
    /**
     * getFileProgress: पहिलेको प्रगति पुनः प्राप्त गर्ने (Resume को लागि)
     */
    getFileProgress(deviceId: string, fileId: string): number;
    /**
     * getFileInfo: फाइलको जानकारी लिने
     */
    getFileInfo(fileId: string): FileMetadata | undefined;
    /**
     * listFiles: सबै उपलब्ध फाइलहरूको सूची
     */
    listFiles(): Array<{
        fileId: string;
        name: string;
        size: number;
        totalChunks: number;
    }>;
    /**
     * announceToPeers: फाइलको उपलब्धता सबै पीयरलाई जानकारी दिने
     */
    announceToPeers(fileId: string, availableAtDeviceId: string): void;
    /**
     * getPeersForFile: फाइल भएका पीयरहरूको सूची
     */
    getPeersForFile(fileId: string): string[];
    /**
     * requestFromPeer: पीयरबाट सिधै डाटा माग गर्ने
     */
    requestFromPeer(deviceId: string, peerId: string, fileId: string, chunkIndex: number): boolean;
    /**
     * sendToPeer: पीयरलाई सिधै डाटा पठाउने (Server Pass-through)
     */
    sendToPeer(fromDeviceId: string, toDeviceId: string, payload: any): boolean;
    /**
     * isReady: डिभाइस अनलाइन छ र मेसेज लिन तयार छ कि छैन चेक गर्ने
     */
    isReady(deviceId: string): boolean;
    /**
     * isOnline: डिभाइस अनलाइन छ कि छैन (साधारण चेक)
     */
    isOnline(deviceId: string): boolean;
    /**
     * sendTo: सिधै डिभाइसलाई मेसेज पठाउने (No Pub/Sub overhead)
     */
    sendTo(deviceId: string, payload: any): boolean;
    /**
     * kick: खराब वा अनधिकृत डिभाइसलाई हटाउने
     */
    kick(deviceId: string, reason?: string): void;
    /**
     * broadcastToGroup: कुनै विशेष ग्रुपलाई मात्र मेसेज पठाउने
     */
    broadcastToGroup(groupName: string, payload: any): void;
    /**
     * getOnlineDevices: सबै अनलाइन डिभाइसहरूको लिस्ट दिने
     */
    getOnlineDevices(): Array<{
        id: string;
        lastSeen: number;
        group?: string;
    }>;
    /**
     * ping: डिभाइसलाई Alive छ कि छैन भनेर चेक गर्न Ping पठाउने
     */
    ping(deviceId: string): boolean;
    /**
     * privateSub: केवल आफ्नो निजी च्यानलमा आउने मेसेज सुन्नको लागि
     */
    privateSub(deviceId: string, fn: (data: any) => void): void;
    /**
     * privatePub: कुनै विशेष डिभाइसको निजी च्यानलमा मात्र मेसेज पठाउन
     */
    privatePub(targetId: string, payload: any, opts?: {
        retain?: boolean;
        ttl?: number;
    }): void;
    handle(raw: Buffer, socket?: any, deviceId?: string): Promise<void>;
    broadcast(topic: string, payload: any, opts?: {
        exclude?: string[];
    }): void;
    use(plugin: RealtimePlugin): void;
    register(deviceId: string, socket?: any, metadata?: any): void;
    unregister(deviceId: string): void;
    getSocket(deviceId: string): any;
    touch(deviceId: string): void;
    getStats(): {
        version: string;
        cacheSize: number;
        devices: number;
        retained: number;
        plugins: number;
        cacheEnabled: boolean;
        highFreqBuffers: number;
        files: number;
        activeTransfers: number;
        peers: number;
    };
    /**
     * Clean up resources - Call this when shutting down
     */
    destroy(): Promise<void>;
    private startCleanup;
}
export { TopicTrie } from './trie';
export { encode, decode, getSize } from './codec';
export { RealtimePlugin, RealtimeContext } from './plugins';
export { djson, toBuffer, toBase64 } from '../djson/djson';
