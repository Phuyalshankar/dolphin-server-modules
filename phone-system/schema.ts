// phone-system/schema.ts
import mongoose from 'mongoose';

const DeviceSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    status: { 
        type: String, 
        enum: ['online', 'offline', 'busy', 'dnd', 'calling'],
        default: 'offline'
    },
    ip: String,
    lastSeen: { type: Number, default: Date.now },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
});

const CallLogSchema = new mongoose.Schema({
    from: { type: String, required: true },
    fromNumber: String,
    to: { type: String, required: true },
    toNumber: String,
    startTime: { type: Number, default: Date.now },
    endTime: Number,
    duration: Number,
    status: {
        type: String,
        enum: ['missed', 'completed', 'rejected', 'failed'],
        default: 'completed'
    },
    type: {
        type: String,
        enum: ['audio', 'video'],
        default: 'audio'
    }
});

const SpeedDialSchema = new mongoose.Schema({
    deviceId: { type: String, required: true }, // 'GLOBAL' for all devices
    key: { type: String, required: true },      // '1', '2', '3' etc.
    label: String,                            // 'Ward ICU', 'Nurses Station'
    target: { type: String, required: true },  // '101' or 'https://wa.me/...'
    type: {
        type: String,
        enum: ['internal', 'whatsapp', 'facebook', 'external'],
        default: 'internal'
    }
});

export const createPhoneSchemas = (conn: mongoose.Connection = mongoose.connection) => {
    return {
        Device: conn.model('Device', DeviceSchema),
        CallLog: conn.model('CallLog', CallLogSchema),
        SpeedDial: conn.model('SpeedDial', SpeedDialSchema)
    };
};
