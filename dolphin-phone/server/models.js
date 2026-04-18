const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    room: { type: String },
    status: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline' },
    lastSeen: { type: Date, default: Date.now }
});

const callHistorySchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    type: { type: String, enum: ['audio', 'video'], default: 'audio' },
    status: { type: String, enum: ['missed', 'completed', 'rejected', 'cancelled'], required: true },
    duration: { type: Number, default: 0 }, // in seconds
    timestamp: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = {
    Device: mongoose.model('Device', deviceSchema),
    CallHistory: mongoose.model('CallHistory', callHistorySchema),
    Message: mongoose.model('Message', messageSchema)
};
