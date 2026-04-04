// djson.ts
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

export class DJSON {
  private static opts: DJSONOptions = {
    autoDetect: true,
    strict: false,
  };

  static configure(o: Partial<DJSONOptions>): void {
    this.opts = { ...this.opts, ...o };
  }

  static parse(data: any, format?: InputFormat): any {
    const r = this.parseSafe(data, format);
    if (!r.success) {
      if (this.opts.strict) {
        throw new Error(r.error || 'DJSON parse failed');
      }
      return { error: r.error || 'Parse failed', raw: data };
    }
    return r.data;
  }

  static parseSafe(data: any, format?: InputFormat): ParseResult {
    const ts = Date.now();

    try {
      if (data == null) {
        return { success: true, data: null, format: 'plain', timestamp: ts };
      }

      if (typeof data === 'object' && !Buffer.isBuffer(data) && data !== null) {
        return { success: true, data, format: 'json', timestamp: ts };
      }

      let str = '';
      if (Buffer.isBuffer(data)) {
        str = data.toString('utf8');
      } else if (typeof data === 'string') {
        str = data;
      } else {
        str = String(data);
      }

      // Very long string as plain
      if (str.length > 1000 && !format) {
        return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
      }

      if (format) {
        return this.parseWithFormat(str, format, ts);
      }

      if (this.opts.autoDetect) {
        return this.autoDetect(str, data, ts);
      }

      return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
    } catch (e: any) {
      return { success: false, data: null, error: e.message || 'Parse failed', timestamp: ts };
    }
  }

  private static autoDetect(str: string, originalData: any, ts: number): ParseResult {
    // Handle empty string
    if (str.length === 0) {
      return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
    }

    // If original data was not a string (boolean, number, etc.), treat as plain
    if (typeof originalData !== 'string' && originalData !== null && originalData !== undefined) {
      return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
    }

    const trimmed = str.trim();
    
    // Try JSON first (strict detection)
    const isJsonLike = (trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                       (trimmed.startsWith('[') && trimmed.endsWith(']'));
    
    if (isJsonLike) {
      const r = this.parseJSON(str, ts);
      if (r.success) return r;
      return { success: false, data: null, error: 'Invalid JSON', timestamp: ts };
    }

    // Try query string (must have & and =)
    if (str.includes('=') && str.includes('&')) {
      const r = this.parseQS(str, ts);
      if (r.success && Object.keys(r.data).length > 0) return r;
    }

    // Try key-value (space separated with =)
    if (str.includes('=') && str.includes(' ') && !str.includes('&')) {
      const r = this.parseKV(str, ts);
      if (r.success && Object.keys(r.data).length > 0) return r;
    }

    // Try hex (even length, hex chars only, minimum 2 chars)
    if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0 && str.length >= 2) {
      const r = this.parseHex(str, ts);
      if (r.success) return r;
    }

    // Try base64 (valid base64 chars, length multiple of 4, minimum 4 chars)
    // Exclude common words that look like base64 but aren't
    const commonWords = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'];
    if (!commonWords.includes(str.toLowerCase()) && 
        /^[A-Za-z0-9+/=]+$/.test(str) && 
        str.length % 4 === 0 && 
        str.length >= 4) {
      const r = this.parseB64(str, ts);
      if (r.success) return r;
    }

    // CRITICAL: If we reach here, the input doesn't match ANY format
    // For 'invalid json', it's not JSON, not QS, not KV, not hex, not base64
    // So it should be considered INVALID input (not plain text)
    return { 
      success: false, 
      data: null, 
      error: 'Unable to detect format. Input does not match JSON, QueryString, KeyValue, Hex, or Base64', 
      timestamp: ts 
    };
  }

  private static parseWithFormat(str: string, fmt: InputFormat, ts: number): ParseResult {
    switch (fmt) {
      case 'json':        return this.parseJSON(str, ts);
      case 'querystring': return this.parseQS(str, ts);
      case 'keyvalue':    return this.parseKV(str, ts);
      case 'hex':         return this.parseHex(str, ts);
      case 'base64':      return this.parseB64(str, ts);
      case 'plain':
        return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
      default:
        return { success: true, data: { raw: str }, format: 'plain', timestamp: ts };
    }
  }

  private static parseJSON(str: string, ts: number): ParseResult {
    try {
      return { success: true, data: JSON.parse(str), format: 'json', timestamp: ts };
    } catch {
      return { success: false, data: null, error: 'Invalid JSON', timestamp: ts };
    }
  }

  private static parseQS(str: string, ts: number): ParseResult {
    try {
      const res: any = {};
      const pairs = str.split('&');
      let hasValidPairs = false;
      
      for (const pair of pairs) {
        if (pair.includes('=')) {
          const [k, v = ''] = pair.split('=');
          if (k && k.trim()) {
            hasValidPairs = true;
            res[decodeURIComponent(k.trim())] = this.parseValue(decodeURIComponent(v));
          }
        }
      }
      
      if (!hasValidPairs || Object.keys(res).length === 0) {
        return { success: false, data: null, error: 'Invalid Query String', timestamp: ts };
      }
      return { success: true, data: res, format: 'querystring', timestamp: ts };
    } catch {
      return { success: false, data: null, error: 'Invalid Query String', timestamp: ts };
    }
  }

  private static parseKV(str: string, ts: number): ParseResult {
    try {
      const res: any = {};
      const pairs = str.split(/\s+/);
      let hasValidPairs = false;
      
      for (const pair of pairs) {
        if (pair.includes('=')) {
          const [k, v = ''] = pair.split('=');
          if (k && k.trim()) {
            hasValidPairs = true;
            res[k.trim()] = this.parseValue(v);
          }
        }
      }
      
      if (!hasValidPairs || Object.keys(res).length === 0) {
        return { success: false, data: null, error: 'Invalid Key-Value', timestamp: ts };
      }
      return { success: true, data: res, format: 'keyvalue', timestamp: ts };
    } catch {
      return { success: false, data: null, error: 'Invalid Key-Value', timestamp: ts };
    }
  }

  private static parseHex(str: string, ts: number): ParseResult {
    if (str === '') {
      return {
        success: true,
        data: { _type: 'hex', hex: '', ascii: '', utf8: '', buffer: Buffer.from(''), length: 0 },
        format: 'hex',
        timestamp: ts
      };
    }
    if (!/^[0-9a-fA-F]+$/.test(str) || str.length % 2 !== 0) {
      return { success: false, data: null, error: 'Invalid Hex', timestamp: ts };
    }
    try {
      const buf = Buffer.from(str, 'hex');
      return {
        success: true,
        data: { _type: 'hex', hex: str, ascii: buf.toString('ascii'), utf8: buf.toString('utf8'), buffer: buf, length: buf.length },
        format: 'hex',
        timestamp: ts
      };
    } catch {
      return { success: false, data: null, error: 'Invalid Hex', timestamp: ts };
    }
  }

  private static parseB64(str: string, ts: number): ParseResult {
    // Skip common English words that happen to be valid base64
    const commonWords = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity', 'hello', 'world'];
    if (commonWords.includes(str.toLowerCase())) {
      return { success: false, data: null, error: 'Invalid Base64', timestamp: ts };
    }
    
    if (!/^[A-Za-z0-9+/=]+$/.test(str) || str.length % 4 !== 0) {
      return { success: false, data: null, error: 'Invalid Base64', timestamp: ts };
    }
    
    try {
      const buf = Buffer.from(str, 'base64');
      // Check if decoded result contains valid UTF-8 text (heuristic)
      const utf8Result = buf.toString('utf8');
      const asciiResult = buf.toString('ascii');
      
      // If decoded buffer is very short or contains only null bytes, might be invalid
      if (buf.length === 0) {
        return { success: false, data: null, error: 'Invalid Base64', timestamp: ts };
      }
      
      return {
        success: true,
        data: { _type: 'base64', base64: str, ascii: asciiResult, utf8: utf8Result, buffer: buf, length: buf.length },
        format: 'base64',
        timestamp: ts
      };
    } catch (e) {
      return { success: false, data: null, error: 'Invalid Base64', timestamp: ts };
    }
  }

  private static parseValue(v: string): any {
    const trimmed = v.trim();
    const low = trimmed.toLowerCase();
    if (low === 'true') return true;
    if (low === 'false') return false;
    if (low === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
    return trimmed;
  }

  // ==================== Encode ====================
  static encode(data: any, fmt: OutputFormat = 'json'): string | Buffer {
    switch (fmt) {
      case 'json':        return JSON.stringify(data);
      case 'querystring': return this.toQS(data);
      case 'keyvalue':    return this.toKV(data);
      case 'hex':         return this.toHex(data);
      case 'base64':      return this.toB64(data);
      case 'buffer':      return this.toBuffer(data);
      default:            return JSON.stringify(data);
    }
  }

  private static toQS(data: any): string {
    if (typeof data !== 'object' || data === null) return String(data);
    return Object.entries(data)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  private static toKV(data: any): string {
    if (typeof data !== 'object' || data === null) return String(data);
    return Object.entries(data)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  }

  private static toHex(data: any): string {
    if (Buffer.isBuffer(data)) return data.toString('hex');
    if (typeof data === 'string') return Buffer.from(data).toString('hex');
    return Buffer.from(JSON.stringify(data)).toString('hex');
  }

  private static toB64(data: any): string {
    if (Buffer.isBuffer(data)) return data.toString('base64');
    if (typeof data === 'string') return Buffer.from(data).toString('base64');
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private static toBuffer(data: any): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') return Buffer.from(data);
    return Buffer.from(JSON.stringify(data));
  }
}

// Shortcuts
export const djson = (data: any, format?: InputFormat) => DJSON.parse(data, format);
export const djsonSafe = (data: any, format?: InputFormat) => DJSON.parseSafe(data, format);
export const dencode = (data: any, format: OutputFormat = 'json') => DJSON.encode(data, format);

export const toBuffer = (data: any) => DJSON.encode(data, 'buffer') as Buffer;
export const toQueryString = (data: any) => DJSON.encode(data, 'querystring') as string;
export const toKeyValue = (data: any) => DJSON.encode(data, 'keyvalue') as string;
export const toHex = (data: any) => DJSON.encode(data, 'hex') as string;
export const toBase64 = (data: any) => DJSON.encode(data, 'base64') as string;

export default DJSON;