import { createMongooseAdapter } from 'dolphin-server-modules/adapters/mongoose';
import { User, RefreshToken } from '../models/User.js';

export const db = createMongooseAdapter({
  User,
  RefreshToken,
  models: {
    User
  },
  leanByDefault: true
});

