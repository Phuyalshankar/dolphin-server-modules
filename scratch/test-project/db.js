const mongoose = require('mongoose');
const { createMongooseAdapter } = require('dolphin-server-modules/adapters/mongoose');

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db');
    console.log('✅ MongoDB Connected');
    
    return createMongooseAdapter({
        models: { /* Your Models Here */ }
    });
}

module.exports = connectDB;