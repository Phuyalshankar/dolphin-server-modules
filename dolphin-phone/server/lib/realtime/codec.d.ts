/**
 * Lightweight binary/JSON codec for Dolphin Realtime.
 * Optimized for small payloads and cross-platform compatibility.
 */
export declare function getSize(data: any): number;
/**
 * Encode data to Buffer.
 * Types:
 * 1: Int32
 * 2: String
 * 3: JSON
 * Default: Buffer as is
 */
export declare function encode(data: any): Buffer;
/**
 * Decode Buffer to data.
 */
export declare function decode(buf: Buffer): any;
