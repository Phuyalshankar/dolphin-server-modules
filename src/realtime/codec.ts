/**
 * Lightweight binary/JSON codec for Dolphin Realtime.
 * Optimized for small payloads and cross-platform compatibility.
 */
export function getSize(data: any): number {
  if (Buffer.isBuffer(data)) return data.length;
  if (typeof data === 'string') return Buffer.byteLength(data);
  return Buffer.byteLength(JSON.stringify(data));
}

/**
 * Encode data to Buffer.
 * Types:
 * 1: Int32
 * 2: String
 * 3: JSON
 * Default: Buffer as is
 */
export function encode(data: any): Buffer {
  if (Buffer.isBuffer(data)) return data;

  if (typeof data === 'number') {
    const b = Buffer.allocUnsafe(5);
    b[0] = 1;
    b.writeInt32BE(data, 1);
    return b;
  }

  if (typeof data === 'string') {
    const str = Buffer.from(data);
    const len = str.length;
    // Header: type(1 byte) + len(4 bytes)
    const b = Buffer.allocUnsafe(5);
    b[0] = 2;
    b.writeUInt32BE(len, 1);
    return Buffer.concat([b, str]);
  }

  const json = Buffer.from(JSON.stringify(data));
  const b = Buffer.allocUnsafe(1);
  b[0] = 3;
  return Buffer.concat([b, json]);
}

/**
 * Decode Buffer to data.
 */
export function decode(buf: Buffer): any {
  if (!buf || buf.length === 0) return null;
  const t = buf[0];
  if (t === 1) return buf.readInt32BE(1);
  if (t === 2) {
    const len = buf.readUInt32BE(1);
    return buf.slice(5, 5 + len).toString();
  }
  if (t === 3) return JSON.parse(buf.slice(1).toString());
  return buf;
}