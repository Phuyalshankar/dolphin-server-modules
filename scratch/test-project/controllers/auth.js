import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import { User } from '../models/User.js';

// This is a production-ready Auth Controller using Dolphin Modules
export const auth = createDolphinAuthController({
    secret: process.env.JWT_SECRET || 'your_ultra_secret_key',
    model: User, // In a real app, you'd pass a Database Adapter
    issuer: 'DolphinApp'
});

export const register = auth.register;
export const login = auth.login;
