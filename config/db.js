import mongoose from 'mongoose';
export const connectDB = async (uri) => {
    try {
        await mongoose.connect(uri);
        console.log('✅ MongoDB Connected');
    } catch (e) {
        console.error('❌ DB Error:', e);
    }
};