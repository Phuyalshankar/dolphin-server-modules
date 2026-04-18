"use strict";
/**
 * Realtime Plugins for Dolphin.
 * Allows handling custom protocols (e.g. Modbus, HL7) seamlessly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONPlugin = exports.HL7Plugin = exports.ModbusPlugin = void 0;
exports.buildModbusFrame = buildModbusFrame;
exports.buildReadRegistersFrame = buildReadRegistersFrame;
exports.buildWriteRegisterFrame = buildWriteRegisterFrame;
// ============================================
// Modbus RTU Complete Parser
// ============================================
// Modbus Function Codes
const ModbusFunction = {
    READ_COILS: 0x01,
    READ_DISCRETE_INPUTS: 0x02,
    READ_HOLDING_REGISTERS: 0x03,
    READ_INPUT_REGISTERS: 0x04,
    WRITE_SINGLE_COIL: 0x05,
    WRITE_SINGLE_REGISTER: 0x06,
    WRITE_MULTIPLE_COILS: 0x0F,
    WRITE_MULTIPLE_REGISTERS: 0x10
};
/**
 * CRC16 calculation for Modbus
 */
function calculateCRC(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i];
        for (let bit = 0; bit < 8; bit++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            }
            else {
                crc = crc >> 1;
            }
        }
    }
    return crc;
}
/**
 * Complete Modbus RTU Frame Parser
 */
function parseModbusFrame(buffer) {
    if (buffer.length < 4) {
        return { error: 'Frame too short', length: buffer.length };
    }
    const slaveId = buffer[0];
    const functionCode = buffer[1];
    // Validate slave ID (1-247)
    if (slaveId < 1 || slaveId > 247) {
        return { error: 'Invalid slave ID', slaveId };
    }
    // CRC check
    const receivedCRC = buffer.readUInt16LE(buffer.length - 2);
    const calculatedCRC = calculateCRC(buffer.slice(0, buffer.length - 2));
    if (receivedCRC !== calculatedCRC) {
        return {
            error: 'CRC mismatch',
            receivedCRC,
            calculatedCRC,
            raw: buffer.toString('hex')
        };
    }
    const data = buffer.slice(2, buffer.length - 2);
    // Parse based on function code
    let parsedData = {};
    switch (functionCode) {
        case ModbusFunction.READ_HOLDING_REGISTERS:
        case ModbusFunction.READ_INPUT_REGISTERS:
            if (data.length > 0) {
                const byteCount = data[0];
                const registers = [];
                for (let i = 1; i < 1 + byteCount; i += 2) {
                    if (i + 1 < data.length) {
                        registers.push(data.readUInt16BE(i));
                    }
                }
                parsedData = {
                    type: 'registers',
                    byteCount,
                    registers,
                    count: registers.length,
                    firstRegister: registers[0],
                    singleValue: registers.length === 1 ? registers[0] : null
                };
            }
            break;
        case ModbusFunction.READ_COILS:
        case ModbusFunction.READ_DISCRETE_INPUTS:
            if (data.length > 0) {
                const byteCount = data[0];
                const coils = [];
                for (let i = 1; i < 1 + byteCount && i < data.length; i++) {
                    for (let bit = 0; bit < 8; bit++) {
                        const coilValue = (data[i] >> bit) & 0x01;
                        coils.push(coilValue === 1); // Convert to boolean properly
                    }
                }
                parsedData = {
                    type: 'coils',
                    byteCount,
                    coils: coils.slice(0, byteCount * 8),
                    firstCoil: coils[0] || false
                };
            }
            break;
        case ModbusFunction.WRITE_SINGLE_REGISTER:
            if (data.length >= 4) {
                parsedData = {
                    type: 'write-single-register',
                    address: data.readUInt16BE(0),
                    value: data.readUInt16BE(2)
                };
            }
            break;
        case ModbusFunction.WRITE_SINGLE_COIL:
            if (data.length >= 4) {
                const coilValue = data.readUInt16BE(2);
                parsedData = {
                    type: 'write-single-coil',
                    address: data.readUInt16BE(0),
                    value: coilValue === 0xFF00 // Compare properly
                };
            }
            break;
        case ModbusFunction.WRITE_MULTIPLE_REGISTERS:
            if (data.length >= 5) {
                const byteCount = data[4];
                const values = [];
                for (let i = 5; i < 5 + byteCount && i + 1 < data.length; i += 2) {
                    values.push(data.readUInt16BE(i));
                }
                parsedData = {
                    type: 'write-multiple-registers',
                    address: data.readUInt16BE(0),
                    quantity: data.readUInt16BE(2),
                    byteCount,
                    values
                };
            }
            break;
        default:
            // Check if it's an exception response
            if ((functionCode & 0x80) !== 0) {
                const exceptionCode = data[0];
                const exceptionMessages = {
                    0x01: 'Illegal Function',
                    0x02: 'Illegal Data Address',
                    0x03: 'Illegal Data Value',
                    0x04: 'Slave Device Failure',
                    0x05: 'Acknowledge',
                    0x06: 'Slave Device Busy'
                };
                parsedData = {
                    type: 'exception',
                    exceptionCode,
                    message: exceptionMessages[exceptionCode] || 'Unknown Exception'
                };
            }
            else {
                parsedData = {
                    type: 'unknown',
                    raw: data.toString('hex'),
                    functionCode: `0x${functionCode.toString(16)}`
                };
            }
    }
    const functionNames = {
        0x01: 'READ_COILS',
        0x02: 'READ_DISCRETE_INPUTS',
        0x03: 'READ_HOLDING_REGISTERS',
        0x04: 'READ_INPUT_REGISTERS',
        0x05: 'WRITE_SINGLE_COIL',
        0x06: 'WRITE_SINGLE_REGISTER',
        0x0F: 'WRITE_MULTIPLE_COILS',
        0x10: 'WRITE_MULTIPLE_REGISTERS'
    };
    return {
        protocol: 'modbus-rtu',
        slaveId,
        functionCode,
        functionName: functionNames[functionCode] || `UNKNOWN_0x${functionCode.toString(16)}`,
        data: parsedData,
        crc: { received: receivedCRC, calculated: calculatedCRC, valid: receivedCRC === calculatedCRC },
        raw: buffer.toString('hex'),
        length: buffer.length,
        timestamp: Date.now()
    };
}
/**
 * Convert Modbus registers to meaningful sensor values
 */
function registersToSensor(registers, schema) {
    if (!schema) {
        // Default schema (temperature on register 0, humidity on register 1)
        return {
            temperature: registers[0] !== undefined ? registers[0] / 10 : null,
            humidity: registers[1] !== undefined ? registers[1] / 10 : null,
            rawRegisters: registers
        };
    }
    const result = {};
    for (const [key, config] of Object.entries(schema)) {
        let value = registers[config.index] || 0;
        if (config.scale)
            value = value * config.scale;
        if (config.offset)
            value = value + config.offset;
        result[key] = value;
    }
    result.rawRegisters = registers;
    return result;
}
// ============================================
// Updated Plugins
// ============================================
/**
 * Complete Modbus Plugin
 * अब 8 bytes मात्र होइन, सबै Modbus frames ह्यान्डल गर्छ
 */
exports.ModbusPlugin = {
    name: 'modbus',
    match: (ctx) => {
        if (!ctx.raw || ctx.raw.length < 4)
            return false;
        const slaveId = ctx.raw[0];
        // Valid Modbus slave IDs: 1-247
        if (slaveId < 1 || slaveId > 247)
            return false;
        const funcCode = ctx.raw[1];
        const validFuncCodes = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x0F, 0x10];
        // Valid function code or exception response (has 0x80 bit set)
        const isValidFunc = validFuncCodes.includes(funcCode) || ((funcCode & 0x80) !== 0);
        if (!isValidFunc)
            return false;
        // Modbus RTU max frame size is 256 bytes
        return ctx.raw.length <= 256;
    },
    decode: (buf) => {
        return parseModbusFrame(buf);
    },
    onMessage: (ctx) => {
        const parsed = ctx.payload;
        if (parsed.error) {
            console.error(`[Modbus] Error: ${parsed.error}`, parsed);
            return;
        }
        // Publish to general modbus topic
        ctx.publish(`modbus/slave_${parsed.slaveId}`, {
            function: parsed.functionName,
            data: parsed.data,
            timestamp: parsed.timestamp
        });
        // If it's register data (sensor values)
        if (parsed.data?.type === 'registers' && parsed.data.registers) {
            const sensorData = registersToSensor(parsed.data.registers);
            // Publish as sensor data
            ctx.publish(`modbus/sensors/${parsed.slaveId}`, {
                slaveId: parsed.slaveId,
                ...sensorData,
                timestamp: parsed.timestamp
            });
        }
        // Log nicely
        console.log(`[Modbus] Slave ${parsed.slaveId} | ${parsed.functionName} | Data:`, parsed.data.type === 'registers' ? parsed.data.registers : parsed.data);
    }
};
/**
 * Sample HL7 Plugin
 */
exports.HL7Plugin = {
    name: 'hl7',
    match: (ctx) => {
        if (!ctx.raw)
            return false;
        return ctx.raw.includes(0x0b);
    },
    decode: (buf) => ({ msg: buf.toString().split('\r') })
};
/**
 * Standard JSON Plugin for Web
 */
exports.JSONPlugin = {
    name: 'json',
    match: (ctx) => {
        try {
            if (ctx.raw) {
                JSON.parse(ctx.raw.toString());
                return true;
            }
        }
        catch {
            return false;
        }
        return false;
    },
    decode: (buf) => JSON.parse(buf.toString())
};
/**
 * Modbus Frame Builder (Write operations को लागि)
 */
function buildModbusFrame(slaveId, functionCode, data) {
    const frame = Buffer.concat([
        Buffer.from([slaveId, functionCode]),
        data
    ]);
    const crc = calculateCRC(frame);
    const crcBuffer = Buffer.alloc(2);
    crcBuffer.writeUInt16LE(crc, 0);
    return Buffer.concat([frame, crcBuffer]);
}
/**
 * Read Holding Registers frame बनाउने
 */
function buildReadRegistersFrame(slaveId, startAddress, quantity) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(startAddress, 0);
    data.writeUInt16BE(quantity, 2);
    return buildModbusFrame(slaveId, 0x03, data);
}
/**
 * Write Single Register frame बनाउने
 */
function buildWriteRegisterFrame(slaveId, address, value) {
    const data = Buffer.alloc(4);
    data.writeUInt16BE(address, 0);
    data.writeUInt16BE(value, 2);
    return buildModbusFrame(slaveId, 0x06, data);
}
//# sourceMappingURL=plugins.js.map