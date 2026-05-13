export type InputFormat = 'json' | 'querystring' | 'keyvalue' | 'hex' | 'base64' | 'plain';
export type OutputFormat = 'json' | 'querystring' | 'keyvalue' | 'hex' | 'base64' | 'buffer';
export interface DJSONOptions {
    strict?: boolean;
    autoDetect?: boolean;
}
export interface ParseResult {
    success: boolean;
    data: any;
    format?: InputFormat;
    error?: string;
    timestamp: number;
}
export declare class DJSON {
    private static opts;
    static configure(o: Partial<DJSONOptions>): void;
    static parse(data: any, format?: InputFormat): any;
    static parseSafe(data: any, format?: InputFormat): ParseResult;
    private static autoDetect;
    private static parseWithFormat;
    private static parseJSON;
    private static parseQS;
    private static parseKV;
    private static parseHex;
    private static parseB64;
    private static parseValue;
    static encode(data: any, fmt?: OutputFormat): string | Buffer;
    private static toQS;
    private static toKV;
    private static toHex;
    private static toB64;
    private static toBuffer;
}
export declare const djson: (data: any, format?: InputFormat) => any;
export declare const djsonSafe: (data: any, format?: InputFormat) => ParseResult;
export declare const dencode: (data: any, format?: OutputFormat) => string | Buffer<ArrayBufferLike>;
export declare const toBuffer: (data: any) => Buffer;
export declare const toQueryString: (data: any) => string;
export declare const toKeyValue: (data: any) => string;
export declare const toHex: (data: any) => string;
export declare const toBase64: (data: any) => string;
export default DJSON;
