import mongoose from 'mongoose';
import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';

export async function connectDB(models = {}) {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/dolphin_db';
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected');
    
    return createMongooseAdapter({
        models: { ...models }
    });
}