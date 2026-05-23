import { createDolphinAuthController } from 'dolphin-server-modules/auth-controller';
import User from '../models/User.js';

export const authController = createDolphinAuthController({
  model: User,
  secret: process.env.JWT_SECRET || 'super_secret_dolphin_key',
  options: { expiresIn: '24h' }
});