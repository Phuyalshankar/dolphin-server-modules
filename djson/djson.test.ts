// djson/test/djson.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import DJSON, { djson, djsonSafe, dencode, toBuffer, toQueryString, toKeyValue, toHex, toBase64 } from './djson';

describe('DJSON Library', () => {
  beforeEach(() => {
    DJSON.configure({ strict: false, autoDetect: true });
  });

  describe('JSON Parsing', () => {
    it('should parse valid JSON', () => {
      const result = DJSON.parse('{"name":"test","value":123}');
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should parse JSON array', () => {
      const result = DJSON.parse('[1,2,3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle already parsed object', () => {
      const obj = { foo: 'bar' };
      const result = DJSON.parse(obj);
      expect(result).toBe(obj);
    });

    it('should handle null values', () => {
      const result = DJSON.parse(null);
      expect(result).toBeNull();
    });
  });

  describe('QueryString Parsing', () => {
    it('should parse querystring', () => {
      const result = DJSON.parse('name=John&age=30', 'querystring');
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should parse querystring with special characters', () => {
      const result = DJSON.parse('name=John%20Doe&city=NYC', 'querystring');
      expect(result).toEqual({ name: 'John Doe', city: 'NYC' });
    });
  });

  describe('Key-Value Parsing', () => {
    it('should parse space-separated key-value pairs', () => {
      const result = DJSON.parse('temp=25.5 humidity=60', 'keyvalue');
      expect(result).toEqual({ temp: 25.5, humidity: 60 });
    });
  });

  describe('Hex Parsing', () => {
    it('should parse hex string', () => {
      const result = DJSON.parse('48656c6c6f', 'hex');
      expect(result._type).toBe('hex');
      expect(result.ascii).toBe('Hello');
    });

    it('should handle empty hex string', () => {
      const result = DJSON.parse('', 'hex');
      expect(result._type).toBe('hex');
      expect(result.hex).toBe('');
      expect(result.length).toBe(0);
    });
  });

  describe('Base64 Parsing', () => {
    it('should parse base64 string', () => {
      const result = DJSON.parse('SGVsbG8gV29ybGQ=', 'base64');
      expect(result._type).toBe('base64');
      expect(result.ascii).toBe('Hello World');
    });
  });

  describe('Auto Detection', () => {
    it('should auto-detect JSON', () => {
      const result = DJSON.parse('{"auto":"detected"}');
      expect(result).toEqual({ auto: 'detected' });
    });

    it('should auto-detect querystring', () => {
      const result = DJSON.parse('key1=value1&key2=value2');
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should auto-detect key-value pairs', () => {
      const result = DJSON.parse('temp=25.5 humidity=60');
      expect(result).toEqual({ temp: 25.5, humidity: 60 });
    });

    it('should auto-detect hex', () => {
      const result = DJSON.parse('48656c6c6f576f726c64');
      expect(result._type).toBe('hex');
    });

    it('should auto-detect base64', () => {
      const result = DJSON.parse('SGVsbG8gV29ybGQ=');
      expect(result._type).toBe('base64');
    });
  });

  describe('Safe Parsing', () => {
    it('should return success for valid input', () => {
      const result = djsonSafe('{"valid":true}');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ valid: true });
    });

    it('should return error for invalid JSON', () => {
      const result = djsonSafe('{invalid: json}');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid hex string', () => {
      const result = DJSON.parseSafe('invalidhex', 'hex');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Hex');
    });

    it('should handle invalid base64', () => {
      const result = DJSON.parseSafe('!!!invalid!!!', 'base64');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Base64');
    });
  });

  describe('Encoding', () => {
    const testData = { name: 'Test', value: 123 };

    it('should encode to JSON', () => {
      const result = dencode(testData, 'json');
      expect(result).toBe('{"name":"Test","value":123}');
    });

    it('should encode to querystring', () => {
      const result = toQueryString(testData);
      expect(result).toBe('name=Test&value=123');
    });

    it('should encode to keyvalue', () => {
      const result = toKeyValue(testData);
      expect(result).toBe('name=Test value=123');
    });

    it('should encode to hex', () => {
      const result = toHex('Hello');
      expect(result).toBe('48656c6c6f');
    });

    it('should encode to base64', () => {
      const result = toBase64('Hello World');
      expect(result).toBe('SGVsbG8gV29ybGQ=');
    });

    it('should encode to buffer', () => {
      const result = toBuffer(testData);
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('Shortcut Functions', () => {
    it('djson() should work', () => {
      const result = djson('{"shortcut":true}');
      expect(result).toEqual({ shortcut: true });
    });

    it('dencode() should work', () => {
      const result = dencode({ test: 'data' }, 'keyvalue');
      expect(result).toBe('test=data');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const result = DJSON.parse('');
      expect(result).toEqual({ raw: '' });
    });

    it('should handle very long string as plain text', () => {
      const longString = 'x'.repeat(10000);
      const result = DJSON.parse(longString);
      // When auto-detection fails, it returns { raw: string }
      expect(result).toEqual({ raw: longString });
    });

    it('should handle number input', () => {
      const result = DJSON.parse(123);
      expect(result).toEqual({ raw: '123' });
    });

    it('should handle boolean input', () => {
      const result = DJSON.parse(true);
      expect(result).toEqual({ raw: 'true' });
    });

    it('should handle Buffer input', () => {
      const buffer = Buffer.from('test data');
      const result = DJSON.parse(buffer);
      expect(result).toEqual({ raw: 'test data' });
    });
  });

  describe('Strict Mode', () => {
    it('should throw error in strict mode on invalid input', () => {
      DJSON.configure({ strict: true });
      expect(() => DJSON.parse('invalid json')).toThrow();
      DJSON.configure({ strict: false }); // Reset
    });

    it('should return error object in non-strict mode', () => {
      DJSON.configure({ strict: false });
      const result = DJSON.parse('invalid json');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('raw');
    });
  });

  describe('Type Conversion', () => {
    it('should convert boolean strings to booleans', () => {
      const result = DJSON.parse('flag1=true&flag2=false', 'querystring');
      expect(result.flag1).toBe(true);
      expect(result.flag2).toBe(false);
    });

    it('should convert null strings to null', () => {
      const result = DJSON.parse('value=null', 'querystring');
      expect(result.value).toBeNull();
    });

    it('should convert numeric strings to numbers', () => {
      const result = DJSON.parse('int=42 float=3.14 negative=-10', 'keyvalue');
      expect(result.int).toBe(42);
      expect(result.float).toBe(3.14);
      expect(result.negative).toBe(-10);
    });
  });
});