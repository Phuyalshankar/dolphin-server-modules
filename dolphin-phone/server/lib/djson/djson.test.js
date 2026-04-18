"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// djson/test/djson.test.ts
const globals_1 = require("@jest/globals");
const djson_1 = __importStar(require("./djson"));
(0, globals_1.describe)('DJSON Library', () => {
    (0, globals_1.beforeEach)(() => {
        djson_1.default.configure({ strict: false, autoDetect: true });
    });
    (0, globals_1.describe)('JSON Parsing', () => {
        (0, globals_1.it)('should parse valid JSON', () => {
            const result = djson_1.default.parse('{"name":"test","value":123}');
            (0, globals_1.expect)(result).toEqual({ name: 'test', value: 123 });
        });
        (0, globals_1.it)('should parse JSON array', () => {
            const result = djson_1.default.parse('[1,2,3]');
            (0, globals_1.expect)(result).toEqual([1, 2, 3]);
        });
        (0, globals_1.it)('should handle already parsed object', () => {
            const obj = { foo: 'bar' };
            const result = djson_1.default.parse(obj);
            (0, globals_1.expect)(result).toBe(obj);
        });
        (0, globals_1.it)('should handle null values', () => {
            const result = djson_1.default.parse(null);
            (0, globals_1.expect)(result).toBeNull();
        });
    });
    (0, globals_1.describe)('QueryString Parsing', () => {
        (0, globals_1.it)('should parse querystring', () => {
            const result = djson_1.default.parse('name=John&age=30', 'querystring');
            (0, globals_1.expect)(result).toEqual({ name: 'John', age: 30 });
        });
        (0, globals_1.it)('should parse querystring with special characters', () => {
            const result = djson_1.default.parse('name=John%20Doe&city=NYC', 'querystring');
            (0, globals_1.expect)(result).toEqual({ name: 'John Doe', city: 'NYC' });
        });
    });
    (0, globals_1.describe)('Key-Value Parsing', () => {
        (0, globals_1.it)('should parse space-separated key-value pairs', () => {
            const result = djson_1.default.parse('temp=25.5 humidity=60', 'keyvalue');
            (0, globals_1.expect)(result).toEqual({ temp: 25.5, humidity: 60 });
        });
    });
    (0, globals_1.describe)('Hex Parsing', () => {
        (0, globals_1.it)('should parse hex string', () => {
            const result = djson_1.default.parse('48656c6c6f', 'hex');
            (0, globals_1.expect)(result._type).toBe('hex');
            (0, globals_1.expect)(result.ascii).toBe('Hello');
        });
        (0, globals_1.it)('should handle empty hex string', () => {
            const result = djson_1.default.parse('', 'hex');
            (0, globals_1.expect)(result._type).toBe('hex');
            (0, globals_1.expect)(result.hex).toBe('');
            (0, globals_1.expect)(result.length).toBe(0);
        });
    });
    (0, globals_1.describe)('Base64 Parsing', () => {
        (0, globals_1.it)('should parse base64 string', () => {
            const result = djson_1.default.parse('SGVsbG8gV29ybGQ=', 'base64');
            (0, globals_1.expect)(result._type).toBe('base64');
            (0, globals_1.expect)(result.ascii).toBe('Hello World');
        });
    });
    (0, globals_1.describe)('Auto Detection', () => {
        (0, globals_1.it)('should auto-detect JSON', () => {
            const result = djson_1.default.parse('{"auto":"detected"}');
            (0, globals_1.expect)(result).toEqual({ auto: 'detected' });
        });
        (0, globals_1.it)('should auto-detect querystring', () => {
            const result = djson_1.default.parse('key1=value1&key2=value2');
            (0, globals_1.expect)(result).toEqual({ key1: 'value1', key2: 'value2' });
        });
        (0, globals_1.it)('should auto-detect key-value pairs', () => {
            const result = djson_1.default.parse('temp=25.5 humidity=60');
            (0, globals_1.expect)(result).toEqual({ temp: 25.5, humidity: 60 });
        });
        (0, globals_1.it)('should auto-detect hex', () => {
            const result = djson_1.default.parse('48656c6c6f576f726c64');
            (0, globals_1.expect)(result._type).toBe('hex');
        });
        (0, globals_1.it)('should auto-detect base64', () => {
            const result = djson_1.default.parse('SGVsbG8gV29ybGQ=');
            (0, globals_1.expect)(result._type).toBe('base64');
        });
    });
    (0, globals_1.describe)('Safe Parsing', () => {
        (0, globals_1.it)('should return success for valid input', () => {
            const result = (0, djson_1.djsonSafe)('{"valid":true}');
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.data).toEqual({ valid: true });
        });
        (0, globals_1.it)('should return error for invalid JSON', () => {
            const result = (0, djson_1.djsonSafe)('{invalid: json}');
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBeDefined();
        });
        (0, globals_1.it)('should handle invalid hex string', () => {
            const result = djson_1.default.parseSafe('invalidhex', 'hex');
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Invalid Hex');
        });
        (0, globals_1.it)('should handle invalid base64', () => {
            const result = djson_1.default.parseSafe('!!!invalid!!!', 'base64');
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBe('Invalid Base64');
        });
    });
    (0, globals_1.describe)('Encoding', () => {
        const testData = { name: 'Test', value: 123 };
        (0, globals_1.it)('should encode to JSON', () => {
            const result = (0, djson_1.dencode)(testData, 'json');
            (0, globals_1.expect)(result).toBe('{"name":"Test","value":123}');
        });
        (0, globals_1.it)('should encode to querystring', () => {
            const result = (0, djson_1.toQueryString)(testData);
            (0, globals_1.expect)(result).toBe('name=Test&value=123');
        });
        (0, globals_1.it)('should encode to keyvalue', () => {
            const result = (0, djson_1.toKeyValue)(testData);
            (0, globals_1.expect)(result).toBe('name=Test value=123');
        });
        (0, globals_1.it)('should encode to hex', () => {
            const result = (0, djson_1.toHex)('Hello');
            (0, globals_1.expect)(result).toBe('48656c6c6f');
        });
        (0, globals_1.it)('should encode to base64', () => {
            const result = (0, djson_1.toBase64)('Hello World');
            (0, globals_1.expect)(result).toBe('SGVsbG8gV29ybGQ=');
        });
        (0, globals_1.it)('should encode to buffer', () => {
            const result = (0, djson_1.toBuffer)(testData);
            (0, globals_1.expect)(Buffer.isBuffer(result)).toBe(true);
        });
    });
    (0, globals_1.describe)('Shortcut Functions', () => {
        (0, globals_1.it)('djson() should work', () => {
            const result = (0, djson_1.djson)('{"shortcut":true}');
            (0, globals_1.expect)(result).toEqual({ shortcut: true });
        });
        (0, globals_1.it)('dencode() should work', () => {
            const result = (0, djson_1.dencode)({ test: 'data' }, 'keyvalue');
            (0, globals_1.expect)(result).toBe('test=data');
        });
    });
    (0, globals_1.describe)('Edge Cases', () => {
        (0, globals_1.it)('should handle empty string', () => {
            const result = djson_1.default.parse('');
            (0, globals_1.expect)(result).toEqual({ raw: '' });
        });
        (0, globals_1.it)('should handle very long string as plain text', () => {
            const longString = 'x'.repeat(10000);
            const result = djson_1.default.parse(longString);
            // When auto-detection fails, it returns { raw: string }
            (0, globals_1.expect)(result).toEqual({ raw: longString });
        });
        (0, globals_1.it)('should handle number input', () => {
            const result = djson_1.default.parse(123);
            (0, globals_1.expect)(result).toEqual({ raw: '123' });
        });
        (0, globals_1.it)('should handle boolean input', () => {
            const result = djson_1.default.parse(true);
            (0, globals_1.expect)(result).toEqual({ raw: 'true' });
        });
        (0, globals_1.it)('should handle Buffer input', () => {
            const buffer = Buffer.from('test data');
            const result = djson_1.default.parse(buffer);
            (0, globals_1.expect)(result).toEqual({ raw: 'test data' });
        });
    });
    (0, globals_1.describe)('Strict Mode', () => {
        (0, globals_1.it)('should throw error in strict mode on invalid input', () => {
            djson_1.default.configure({ strict: true });
            (0, globals_1.expect)(() => djson_1.default.parse('invalid json')).toThrow();
            djson_1.default.configure({ strict: false }); // Reset
        });
        (0, globals_1.it)('should return error object in non-strict mode', () => {
            djson_1.default.configure({ strict: false });
            const result = djson_1.default.parse('invalid json');
            (0, globals_1.expect)(result).toHaveProperty('error');
            (0, globals_1.expect)(result).toHaveProperty('raw');
        });
    });
    (0, globals_1.describe)('Type Conversion', () => {
        (0, globals_1.it)('should convert boolean strings to booleans', () => {
            const result = djson_1.default.parse('flag1=true&flag2=false', 'querystring');
            (0, globals_1.expect)(result.flag1).toBe(true);
            (0, globals_1.expect)(result.flag2).toBe(false);
        });
        (0, globals_1.it)('should convert null strings to null', () => {
            const result = djson_1.default.parse('value=null', 'querystring');
            (0, globals_1.expect)(result.value).toBeNull();
        });
        (0, globals_1.it)('should convert numeric strings to numbers', () => {
            const result = djson_1.default.parse('int=42 float=3.14 negative=-10', 'keyvalue');
            (0, globals_1.expect)(result.int).toBe(42);
            (0, globals_1.expect)(result.float).toBe(3.14);
            (0, globals_1.expect)(result.negative).toBe(-10);
        });
    });
});
//# sourceMappingURL=djson.test.js.map